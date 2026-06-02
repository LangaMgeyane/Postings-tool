import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCreateNote, getListAnnotationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/session';
import { useToast } from '@/hooks/use-toast';
import { MessageSquarePlus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NOTE_TYPES = ['editorial', 'factual', 'style', 'general'] as const;
type NoteType = typeof NOTE_TYPES[number];

interface TextSelectionNoteProps {
  postId: string;
  containerRef: React.RefObject<HTMLElement>;
}

export function TextSelectionNote({ postId, containerRef }: TextSelectionNoteProps) {
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('editorial');
  
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const session = getSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createNote = useCreateNote();

  // Listen for text selection
  const handleSelectionChange = useCallback(() => {
    if (showInput) return; // Don't update while input is open
    
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }

    // Check if selection is within our container
    const container = containerRef.current;
    if (!container) return;

    const range = sel.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const node = commonAncestor.nodeType === Node.TEXT_NODE 
      ? commonAncestor.parentElement 
      : commonAncestor;
    
    if (!node || !container.contains(node)) {
      setSelection(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Position relative to viewport
    setSelection({
      text: sel.toString().trim(),
      rect: new DOMRect(
        rect.left,
        rect.top - 40, // Position above selection
        rect.width,
        rect.height
      ),
    });
  }, [containerRef, showInput]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // Close on click outside
  useEffect(() => {
    if (!showInput) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (inputPanelRef.current && !inputPanelRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInput]);

  // Focus textarea when input panel opens
  useEffect(() => {
    if (showInput) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [showInput]);

  const handleOpenInput = () => {
    setShowInput(true);
  };

  const handleCancel = () => {
    setShowInput(false);
    setNoteText('');
    setNoteType('editorial');
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleSubmit = async () => {
    if (!noteText.trim() || !session || !selection) return;
    
    try {
      await createNote.mutateAsync({
        postId,
        data: {
          text: noteText.trim(),
          noteType,
          anchorText: selection.text,
          authorId: session.userId,
          authorName: session.userName,
        } as any
      });
      toast({ title: 'Note added' });
      handleCancel();
      queryClient.invalidateQueries({ queryKey: getListAnnotationsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to add note', description: e.message, variant: 'destructive' });
    }
  };

  if (!selection) return null;

  // Calculate position - clamp to viewport
  const top = Math.max(10, selection.rect.top);
  const left = Math.max(10, Math.min(selection.rect.left, window.innerWidth - 300));

  return (
    <>
      {/* Floating "Add Note" trigger */}
      {!showInput && (
        <button
          onClick={handleOpenInput}
          className="fixed z-[60] flex items-center gap-1.5 px-2.5 py-1.5 bg-surface/95 backdrop-blur border border-border/60 rounded shadow-lg text-xs font-medium text-foreground hover:bg-raised transition-colors"
          style={{
            top: `${top}px`,
            left: `${left}px`,
          }}
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-primary" />
          <span>Add Note</span>
        </button>
      )}

      {/* Note input panel */}
      {showInput && (
        <div
          ref={inputPanelRef}
          className="fixed z-[60] w-72 bg-surface border border-border/60 rounded-lg shadow-2xl overflow-hidden"
          style={{
            top: `${top}px`,
            left: `${left}px`,
          }}
        >
          {/* Anchor text quote */}
          <div className="px-3 pt-3 pb-2 bg-raised/30 border-b border-border/30">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">Selected text</p>
            <p className="text-xs text-foreground/70 italic line-clamp-2">&ldquo;{selection.text}&rdquo;</p>
          </div>

          <div className="p-3 space-y-3">
            {/* Note type selector */}
            <div className="flex gap-1 flex-wrap">
              {NOTE_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setNoteType(t)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded-full border transition-all capitalize",
                    noteType === t
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Note textarea */}
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Type your note..."
              className="w-full min-h-[80px] bg-background/50 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/40 rounded p-2 resize-none outline-none focus:border-border/70 transition-colors"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 text-xs text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!noteText.trim() || createNote.isPending}
                className="h-7 text-xs"
              >
                {createNote.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
