import React, { useState } from 'react';
import { useGetPost, getGetPostQueryKey } from '@workspace/api-client-react';
import { getSession } from '@/session';
import { StatusPill } from './StatusPill';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { AnnotationOverlay } from './AnnotationOverlay';
import { NoteModal } from './NoteModal';
import { PenTool, MessageSquarePlus, Maximize2, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface PostViewerProps {
  onBack?: () => void;
}

export function PostViewer({ onBack }: PostViewerProps) {
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

  if (!postId) return null;

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading post...</div>;
  }

  if (!post) return <div className="p-8 text-destructive text-sm">Post not found</div>;

  const isAuthor = session?.userId === post.authorId;

  return (
    <div className="h-full flex flex-col relative">
      {/* Action bar */}
      <div className="h-12 border-b border-border/40 flex items-center justify-between px-4 shrink-0 bg-surface/60 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <StatusPill status={post.status} />
          {post.category && (
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              {post.category}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsAddingNote(true)}
          >
            <MessageSquarePlus className="w-3.5 h-3.5 mr-1.5" />
            Note
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setIsAnnotating(true)}
            disabled={isAuthor}
            title={isAuthor ? "Cannot annotate your own post" : "Annotate this post"}
          >
            <PenTool className="w-3.5 h-3.5 mr-1.5" />
            Annotate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setLocation('/writers-room?subspace=c3')}
          >
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            Board
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-10 lg:px-16">
        <div className="max-w-2xl mx-auto space-y-8 pb-24">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              {post.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground/70 font-medium">{post.authorName}</span>
              <span className="opacity-40">·</span>
              <span>{formatDistanceToNow(new Date(post.updatedAt || post.createdAt))} ago</span>
            </div>
            {post.tags && post.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {post.tags.map(t => (
                  <span
                    key={t}
                    className="px-2 py-0.5 bg-surface border border-border/40 rounded text-[10px] font-mono text-muted-foreground uppercase tracking-wider"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div
            className="prose prose-invert max-w-none leading-relaxed text-base text-foreground/85 prose-p:mb-5 prose-headings:font-bold"
            dangerouslySetInnerHTML={{
              __html: post.body || '<p class="italic text-muted-foreground">No content yet.</p>'
            }}
          />
        </div>
      </div>

      {isAnnotating && (
        <AnnotationOverlay post={post} onClose={() => setIsAnnotating(false)} />
      )}

      <NoteModal
        postId={post.id}
        open={isAddingNote}
        onOpenChange={setIsAddingNote}
      />
    </div>
  );
}
