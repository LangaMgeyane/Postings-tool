import React, { useState, useEffect } from 'react';
import { useListPosts, getListPostsQueryKey } from '@workspace/api-client-react';
import { getSession } from '@/session';
import { StatusPill } from './StatusPill';
import { SkeletonCard } from './SkeletonCard';
import { Input } from '@/components/ui/input';
import { Search, Plus, Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { NewPostModal } from './NewPostModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface FeedProps {
  onPostSelect?: (postId: string) => void;
}

const FILTER_OPTS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'In Review', value: 'in-review' },
  { label: 'Published', value: 'published' },
];

export function Feed({ onPostSelect }: FeedProps) {
  const session = getSession();
  const queryClient = useQueryClient();
  const isMyJournal = session?.currentSubspace === 'c2';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const params = {
    ...(isMyJournal && session?.userId ? { authorId: session.userId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const { data: rawPosts, isLoading } = useListPosts(params, {
    query: { queryKey: getListPostsQueryKey(params) }
  });

  // Sort by updatedAt descending client-side (backend also does this, belt-and-suspenders)
  const posts = [...(rawPosts || [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const filteredPosts = posts.filter(p => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.authorName.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  const handleSelect = (postId: string) => {
    onPostSelect?.(postId);
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="px-3 pt-3 pb-2 border-b border-border/40 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isMyJournal ? 'My Journal' : 'Main Journal'}
          </h2>
          {isMyJournal && (
            <button
              onClick={() => setIsNewPostOpen(true)}
              className="p-1 text-muted-foreground hover:text-primary transition-colors"
              title="New draft"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 h-7 text-xs bg-background/40 border-border/30 placeholder:text-muted-foreground/30"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-2 py-0.5 text-[9px] uppercase tracking-wider rounded-full border transition-all",
                statusFilter === f.value
                  ? "bg-primary/15 border-primary/50 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">No posts found</div>
        ) : (
          filteredPosts.map(post => {
            const isSelected = session?.selectedPostId === post.id;
            return (
              <div
                key={post.id}
                onClick={() => handleSelect(post.id)}
                className={cn(
                  "p-3 rounded cursor-pointer transition-all border",
                  isSelected
                    ? "bg-raised border-border/60 shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                    : "bg-transparent border-transparent hover:bg-surface/60 hover:border-border/30"
                )}
              >
                <div className="flex justify-between items-start gap-1 mb-1.5">
                  <h3 className="font-semibold text-xs leading-tight line-clamp-2 flex-1">
                    {post.title || 'Untitled'}
                  </h3>
                  <StatusPill status={post.status} className="scale-75 origin-top-right shrink-0" />
                </div>
                <p className="text-[10px] text-muted-foreground mb-1.5 line-clamp-2 leading-snug">
                  {post.excerpt || 'No excerpt'}
                </p>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-foreground/60">{post.authorName}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(post.updatedAt))} ago</span>
                  </div>
                  {(post.annotationCount > 0 || post.noteCount > 0) && (
                    <div className="flex items-center gap-0.5 text-primary/60">
                      <Paperclip className="w-2.5 h-2.5" />
                      <span>{post.annotationCount + post.noteCount}</span>
                    </div>
                  )}
                </div>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {post.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[8px] px-1.5 py-0.5 bg-background/60 rounded border border-border/30 text-muted-foreground font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <NewPostModal
        open={isNewPostOpen}
        onOpenChange={setIsNewPostOpen}
        onSuccess={(postId) => {
          handleSelect(postId);
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(params) });
        }}
      />
    </div>
  );
}
