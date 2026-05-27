import React, { useState, useEffect } from 'react';
import { useListPosts, getListPostsQueryKey } from '@workspace/api-client-react';
import { getSession, setSession } from '@/session';
import { StatusPill } from './StatusPill';
import { SkeletonCard } from './SkeletonCard';
import { Input } from '@/components/ui/input';
import { Search, Plus, Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { NewPostModal } from './NewPostModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export function Feed() {
  const session = getSession();
  const queryClient = useQueryClient();
  const isMyJournal = session?.currentSubspace === 'c2';
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const params = {
    ...(isMyJournal && session?.userId ? { authorId: session.userId } : {}),
    ...(filter !== 'All' ? { status: filter.toLowerCase() } : {})
  };

  const { data: posts, isLoading } = useListPosts(params, {
    query: {
      queryKey: getListPostsQueryKey(params)
    }
  });

  const filteredPosts = posts?.filter(p => 
    p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    p.authorName.toLowerCase().includes(debouncedSearch.toLowerCase())
  ) || [];

  const handleSelect = (postId: string) => {
    setSession({ selectedPostId: postId });
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-border/50">
      <div className="p-4 border-b border-border/50 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sidebar-foreground">
            {isMyJournal ? 'My Journal' : 'Main Journal'}
          </h2>
          {isMyJournal && (
            <Button size="icon" variant="ghost" onClick={() => setIsNewPostOpen(true)} className="h-8 w-8 text-primary">
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search posts..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 text-sm h-9"
          />
        </div>
        <div className="flex gap-2 text-xs">
          {['All', 'Draft', 'In-Review', 'Published'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-2 py-1 rounded-full border transition-colors", 
                filter === f ? "bg-primary/20 border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          Array.from({length: 8}).map((_, i) => <SkeletonCard key={i} />)
        ) : filteredPosts.length === 0 ? (
          <div className="text-center p-4 text-sm text-muted-foreground">No posts found</div>
        ) : (
          filteredPosts.map(post => {
            const isSelected = session?.selectedPostId === post.id;
            return (
              <div 
                key={post.id}
                onClick={() => handleSelect(post.id)}
                className={cn(
                  "p-3 rounded-lg cursor-pointer transition-colors border",
                  isSelected 
                    ? "bg-raised border-primary/50 shadow-[inset_2px_0_0_0_hsl(var(--primary))]" 
                    : "bg-surface border-border hover:border-border/80 hover:bg-raised/50"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm leading-tight line-clamp-2">{post.title || 'Untitled'}</h3>
                  <StatusPill status={post.status} className="scale-75 origin-top-right" />
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{post.excerpt || 'No excerpt'}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-foreground/80">{post.authorName}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                  </div>
                  {(post.annotationCount > 0 || post.noteCount > 0) && (
                    <div className="flex items-center gap-1 text-primary/80">
                      <Paperclip className="w-3 h-3" />
                      <span>{post.annotationCount + post.noteCount}</span>
                    </div>
                  )}
                </div>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {post.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 bg-background rounded-sm border border-border/50 text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <NewPostModal open={isNewPostOpen} onOpenChange={setIsNewPostOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(params) })} />
    </div>
  );
}
