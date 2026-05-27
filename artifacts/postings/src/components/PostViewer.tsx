import React, { useState } from 'react';
import { useGetPost, getGetPostQueryKey } from '@workspace/api-client-react';
import { getSession } from '@/session';
import { StatusPill } from './StatusPill';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { AnnotationOverlay } from './AnnotationOverlay';
import { NoteModal } from './NoteModal';
import { PenTool, MessageSquarePlus, Maximize2 } from 'lucide-react';
import { useLocation } from 'wouter';

export function PostViewer() {
  const session = getSession();
  const [, setLocation] = useLocation();
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);

  const postId = session?.selectedPostId;

  const { data: post, isLoading } = useGetPost(postId || '', {
    query: {
      enabled: !!postId,
      queryKey: getGetPostQueryKey(postId || '')
    }
  });

  if (!postId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-4">
        <BookOpen className="w-12 h-12 opacity-20" />
        <p>Select a post to view</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8">Loading post...</div>;
  }

  if (!post) return <div className="p-8 text-destructive">Post not found</div>;

  const isAuthor = session?.userId === post.authorId;

  return (
    <div className="h-full flex flex-col relative">
      <div className="h-14 border-b border-border/50 flex items-center justify-between px-6 shrink-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <StatusPill status={post.status} />
          {post.category && <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">{post.category}</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAddingNote(true)} className="h-8">
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsAnnotating(true)} disabled={isAuthor} className="h-8">
            <PenTool className="w-4 h-4 mr-2" />
            Annotate
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLocation('/writers-room?subspace=c3')} className="h-8">
            <Maximize2 className="w-4 h-4 mr-2" />
            View Board
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-3xl mx-auto space-y-8 pb-32">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold font-sans tracking-tight mb-4">{post.title}</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{post.authorName}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
            </div>
            {post.tags && post.tags.length > 0 && (
              <div className="flex gap-2 mt-4">
                {post.tags.map(t => (
                  <span key={t} className="px-2 py-1 bg-surface border border-border rounded-md text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div 
            className="prose prose-invert prose-orange max-w-none font-serif leading-relaxed text-lg"
            dangerouslySetInnerHTML={{ __html: post.body || '<p class="text-muted-foreground italic">No content</p>' }}
          />
        </div>
      </div>

      {isAnnotating && (
        <AnnotationOverlay 
          post={post} 
          onClose={() => setIsAnnotating(false)} 
        />
      )}
      
      <NoteModal 
        postId={post.id}
        open={isAddingNote}
        onOpenChange={setIsAddingNote}
      />
    </div>
  );
}

function BookOpen(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  );
}
