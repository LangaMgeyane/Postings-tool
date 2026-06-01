import React, { useState } from 'react';
import { useGetPost, usePublishPost, getGetPostQueryKey, getListPostsQueryKey } from '@workspace/api-client-react';
import { getSession } from '@/session';
import { StatusPill } from './StatusPill';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { AnnotationOverlay } from './AnnotationOverlay';
import { NoteModal } from './NoteModal';
import { MessageSquarePlus, ArrowLeft, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface PostViewerProps {
  onBack?: () => void;
  isAnnotating?: boolean;
  onAnnotatingChange?: (open: boolean) => void;
}

export function PostViewer({ onBack, isAnnotating = false, onAnnotatingChange }: PostViewerProps) {
  const session = getSession();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const postId = session?.selectedPostId;
  const isMyJournal = session?.currentSubspace === 'c2';
  const isAdmin = session?.isAdmin === true;

  const { data: post, isLoading } = useGetPost(postId || '', {
    query: {
      enabled: !!postId,
      queryKey: getGetPostQueryKey(postId || '')
    }
  });

  const publishPost = usePublishPost();

  if (!postId) return null;

  // My Journal authorship enforcement
  if (isMyJournal && post && post.authorId !== session?.userId) return null;

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading…</div>;
  }

  if (!post) return null;

  const canPublish = isAdmin && post.status === 'in-review';

  const handlePublish = async () => {
    const confirmed = window.confirm(`Publish "${post.title}"? It will be marked as ready for the Review Gallery.`);
    if (!confirmed) return;
    try {
      await publishPost.mutateAsync({ postId: post.id });
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(post.id) });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      toast({ title: 'Published', description: `"${post.title}" is now published.` });
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Action bar */}
      <div className="h-12 border-b border-border/40 flex items-center justify-between px-4 shrink-0 bg-surface/60 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors mr-1 p-1 min-w-[44px] min-h-[44px] flex items-center"
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
        <div className="flex items-center gap-2">
          {canPublish && (
            <Button
              size="sm"
              className="h-8 text-xs bg-green-600 hover:bg-green-500 text-white border-0"
              onClick={handlePublish}
              disabled={publishPost.isPending}
            >
              <BookOpen className="w-3 h-3 mr-1.5" />
              Publish
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground min-w-[44px]"
            onClick={() => setIsAddingNote(true)}
          >
            <MessageSquarePlus className="w-3.5 h-3.5 mr-1.5" />
            Note
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-10 md:px-12">
        <div className="max-w-2xl mx-auto space-y-8 pb-24">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
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
                    className="px-2 py-0.5 bg-surface border border-border/40 rounded text-[9px] font-mono text-muted-foreground uppercase tracking-wider"
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

      {isAnnotating && onAnnotatingChange && (
        <AnnotationOverlay post={post} onClose={() => onAnnotatingChange(false)} />
      )}

      <NoteModal
        postId={post.id}
        open={isAddingNote}
        onOpenChange={setIsAddingNote}
      />
    </div>
  );
}
