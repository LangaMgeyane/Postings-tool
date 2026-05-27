import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';

export function ANBPanel() {
  const session = getSession();
  const [activeTab, setActiveTab] = useState<'notes' | 'comments' | 'board'>('notes');
  const postId = session?.selectedPostId;

  return (
    <div className="flex flex-col h-full bg-sidebar border-l border-border/50 text-sidebar-foreground">
      <div className="flex h-14 border-b border-border/50">
        {(['notes', 'comments', 'board'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto relative">
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

  if (!postId) return <div className="p-4 text-center text-sm text-muted-foreground">Select a post to view notes</div>;
  if (isLoading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading notes...</div>;

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnotation.mutateAsync({ postId, annId: id });
      queryClient.invalidateQueries({ queryKey: getListAnnotationsQueryKey(postId) });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  if (!annotations?.length) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No annotations yet</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {annotations.map(ann => (
        <div key={ann.id} className="relative group p-3 bg-surface border border-border rounded-lg text-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-primary">
                {ann.type === 'drawing' ? <PenTool className="w-3 h-3" /> :
                 ann.type === 'text' ? <Type className="w-3 h-3" /> :
                 <MessageSquare className="w-3 h-3" />}
              </span>
              <span className="font-semibold">{ann.authorName}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(ann.createdAt))}</span>
          </div>
          <p className="text-muted-foreground leading-snug">
            {ann.texts?.[0]?.text ?? ann.text ?? 'Drawing'}
          </p>
          {(session?.userId === ann.authorId) && (
            <button 
              onClick={() => handleDelete(ann.id)}
              className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
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
  const [text, setText] = useState('');
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
    if (!text.trim() || !postId) return;
    try {
      await createComment.mutateAsync({ postId, data: { text: text.trim() } });
      setText('');
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

  if (!postId) return <div className="p-4 text-center text-sm text-muted-foreground">Select a post to view comments</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? <div className="text-center text-sm text-muted-foreground">Loading...</div> : 
         !comments?.length ? <div className="text-center text-sm text-muted-foreground">No comments yet</div> :
         comments.map(c => (
           <div key={c.id} className="relative group text-sm">
             <div className="flex items-center gap-2 mb-1">
               <span className="font-semibold text-foreground">{c.authorName}</span>
               <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt))}</span>
             </div>
             <p className="text-muted-foreground">{c.text}</p>
             {(session?.userId === c.authorId) && (
               <button 
                 onClick={() => handleDelete(c.id)}
                 className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
               >
                 <X className="w-3 h-3" />
               </button>
             )}
           </div>
         ))
        }
      </div>
      <div className="p-4 border-t border-border/50 bg-sidebar">
        <Textarea 
          value={text} 
          onChange={e => setText(e.target.value)}
          placeholder="Write a comment..."
          maxLength={500}
          className="min-h-[80px] bg-background border-border text-sm mb-2 resize-none"
        />
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">{text.length}/500</span>
          <Button size="sm" onClick={handleSubmit} disabled={!text.trim() || createComment.isPending}>
            {createComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BoardTab() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex-1 bg-surface border border-border rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
        {/* Placeholder for mini canvas snapshot. Could use actual canvas but static styling works for now */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
        <div className="w-12 h-16 bg-card border border-border rounded shadow-lg transform rotate-12 -translate-x-4 absolute" />
        <div className="w-16 h-12 bg-amber-900 border border-amber-700/50 rounded shadow-lg transform -rotate-6 translate-x-4 absolute" />
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line x1="45%" y1="45%" x2="55%" y2="55%" stroke="#444" strokeWidth="2" />
        </svg>
      </div>
      <Button className="w-full" onClick={() => setLocation('/writers-room?subspace=c3')}>
        Open Board <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
