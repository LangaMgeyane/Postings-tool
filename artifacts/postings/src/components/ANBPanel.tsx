import React, { useState, useRef } from 'react';
import {
  useListAnnotations,
  useListComments,
  useDeleteAnnotation,
  useDeleteComment,
  useCreateComment,
  getListAnnotationsQueryKey,
  getListCommentsQueryKey
} from '@workspace/api-client-react';
import { getSession } from '@/session';
import { formatDistanceToNow } from 'date-fns';
import { X, PenTool, Type, MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

export function ANBPanel() {
  const session = getSession();
  const [activeTab, setActiveTab] = useState<'notes' | 'comments' | 'board'>('notes');
  const postId = session?.selectedPostId;

  return (
    <div className="flex flex-col h-full bg-sidebar border-l border-border/50 text-sidebar-foreground">
      <div className="flex h-11 border-b border-border/50 shrink-0">
        {(['notes', 'comments', 'board'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 text-[10px] font-semibold uppercase tracking-widest transition-colors",
              activeTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'notes' && <NotesTab postId={postId} />}
        {activeTab === 'comments' && <CommentsTab postId={postId} />}
        {activeTab === 'board' && <BoardTab />}
      </div>
    </div>
  );
}

function NotesTab({ postId }: { postId?: string }) {
  const session = getSession();
  const queryClient = useQueryClient();
  const deleteAnnotation = useDeleteAnnotation();
  const { toast } = useToast();

  const { data: annotations, isLoading } = useListAnnotations(postId || '', {
    query: {
      enabled: !!postId,
      queryKey: getListAnnotationsQueryKey(postId || '')
    }
  });

  if (!postId) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground mt-8">
        Select a post to view notes
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>;
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnotation.mutateAsync({ postId, annId: id });
      queryClient.invalidateQueries({ queryKey: getListAnnotationsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  if (!annotations?.length) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground mt-8">
        No annotations yet
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {annotations.map(ann => (
        <div key={ann.id} className="relative group p-3 bg-surface/50 border border-border/40 rounded text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-primary/80">
                {ann.type === 'drawing' ? <PenTool className="w-3 h-3" /> :
                 ann.type === 'text' ? <Type className="w-3 h-3" /> :
                 <MessageSquare className="w-3 h-3" />}
              </span>
              {ann.noteType && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm">
                  {ann.noteType}
                </span>
              )}
              <span className="font-semibold text-foreground/80">{ann.authorName}</span>
            </div>
            <span className="text-[9px] text-muted-foreground">
              {formatDistanceToNow(new Date(ann.createdAt))} ago
            </span>
          </div>
          <p className="text-muted-foreground leading-snug line-clamp-3">
            {ann.texts?.[0]?.text ?? ann.text ?? '(drawing)'}
          </p>
          {session?.userId === ann.authorId && (
            <button
              onClick={() => handleDelete(ann.id)}
              className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function CommentsTab({ postId }: { postId?: string }) {
  const session = getSession();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [charCount, setCharCount] = useState(0);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const { toast } = useToast();

  const { data: comments, isLoading } = useListComments(postId || '', {
    query: {
      enabled: !!postId,
      queryKey: getListCommentsQueryKey(postId || '')
    }
  });

  const handleSubmit = async () => {
    const text = textareaRef.current?.value?.trim();
    if (!text || !postId || !session) return;

    try {
      await createComment.mutateAsync({
        postId,
        data: {
          text,
          authorId: session.userId,
          authorName: session.userName,
        } as any
      });
      if (textareaRef.current) {
        textareaRef.current.value = '';
        setCharCount(0);
      }
      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to post', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!postId) return;
    try {
      await deleteComment.mutateAsync({ postId, commentId: id });
      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  if (!postId) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground mt-8">
        Select a post to view comments
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="text-center text-xs text-muted-foreground">Loading...</div>
        ) : !comments?.length ? (
          <div className="text-center text-xs text-muted-foreground mt-8">No comments yet</div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="relative group text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-semibold text-foreground/90">{c.authorName}</span>
                <span className="text-[9px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.createdAt))} ago
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{c.text}</p>
              {session?.userId === c.authorId && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-border/50 shrink-0">
        <textarea
          ref={textareaRef}
          placeholder="Write a comment..."
          maxLength={500}
          onChange={e => setCharCount(e.target.value.length)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="w-full bg-background/60 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/40 rounded p-2 resize-none min-h-[64px] outline-none focus:border-border transition-colors"
        />
        <div className="flex justify-between items-center mt-1.5">
          <span className={cn(
            "text-[9px] transition-colors",
            charCount > 450 ? "text-primary" : "text-muted-foreground"
          )}>
            {charCount}/500
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={charCount === 0 || createComment.isPending}
            className="h-7 text-xs px-3"
          >
            {createComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BoardTab() {
  const [, setLocation] = useLocation();

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 bg-surface/40 border border-border/30 rounded mb-3 overflow-hidden relative min-h-[120px]">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '16px 16px'
          }}
        />
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <line x1="30%" y1="40%" x2="55%" y2="40%" stroke="#333" strokeWidth="1" />
          <line x1="55%" y1="40%" x2="45%" y2="65%" stroke="#333" strokeWidth="1" />
        </svg>
        <div className="absolute" style={{ left: '18%', top: '25%' }}>
          <div className="w-[80px] h-[52px] bg-card border border-border/50 rounded-sm shadow" style={{ borderLeft: '3px solid #22c55e' }}>
            <div className="p-1.5 text-[7px] text-foreground/60 leading-tight font-medium">Monoculture</div>
          </div>
        </div>
        <div className="absolute" style={{ left: '44%', top: '22%' }}>
          <div className="w-[80px] h-[52px] bg-card border border-border/50 rounded-sm shadow" style={{ borderLeft: '3px solid #22c55e' }}>
            <div className="p-1.5 text-[7px] text-foreground/60 leading-tight font-medium">Authentic</div>
          </div>
        </div>
        <div className="absolute" style={{ left: '30%', top: '55%' }}>
          <div className="w-[72px] h-[36px] bg-[#2a2000] border border-amber-900/50 rounded-sm shadow">
            <div className="p-1 text-[7px] text-amber-400/70 leading-tight">Theme cluster…</div>
          </div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs border-border/50 text-muted-foreground hover:text-foreground"
        onClick={() => setLocation('/writers-room?subspace=c3')}
      >
        Open Board <ArrowRight className="w-3 h-3 ml-2" />
      </Button>
    </div>
  );
}
