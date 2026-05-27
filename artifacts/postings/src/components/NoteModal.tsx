import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateNote } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListAnnotationsQueryKey } from '@workspace/api-client-react';
import { getSession } from '@/session';
import { cn } from '@/lib/utils';

const NOTE_TYPES = ['editorial', 'factual', 'style', 'general'] as const;
type NoteType = typeof NOTE_TYPES[number];

interface NoteModalProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteModal({ postId, open, onOpenChange }: NoteModalProps) {
  const [text, setText] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('editorial');
  const { toast } = useToast();
  const session = getSession();
  const createNote = useCreateNote();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!text.trim() || !session) return;
    try {
      await createNote.mutateAsync({
        postId,
        data: {
          text: text.trim(),
          noteType,
          authorId: session.userId,
          authorName: session.userName,
        } as any
      });
      toast({ title: 'Note added' });
      setText('');
      setNoteType('editorial');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: getListAnnotationsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to add note', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-surface border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">Add Note</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {NOTE_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setNoteType(t)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-all capitalize",
                  noteType === t
                    ? "bg-primary/20 border-primary text-primary"
                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your note here..."
            className="min-h-[100px] bg-background border-border/60 resize-none"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!text.trim() || createNote.isPending} className="bg-primary text-primary-foreground">
            {createNote.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
