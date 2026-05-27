import React, { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { getSession, setSession } from '@/session';
import { Feed } from '@/components/Feed';
import { PostViewer } from '@/components/PostViewer';
import { PostEditor } from '@/components/PostEditor';
import { Pinboard } from '@/components/Pinboard';
import { ANBPanel } from '@/components/ANBPanel';
import schememark from '@assets/Schememark_02_1779887427469.png';
import { cn } from '@/lib/utils';

export default function WritersRoom() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const subspaceParam = params.get('subspace');

  // Re-read session reactively on any subspace/post change
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const session = getSession();

  useEffect(() => {
    if (!session?.userId) {
      setLocation('/login');
    } else if (session.currentWorkspace !== 'WR') {
      setLocation('/workspaces');
    }
  }, [session, setLocation]);

  if (!session?.userId || session.currentWorkspace !== 'WR') return null;

  const activeSubspace = subspaceParam || session.currentSubspace || 'c1';
  const selectedPostId = session?.selectedPostId;
  const showFeed = activeSubspace === 'c1' || activeSubspace === 'c2';

  // Panel states:
  // C3: no feed, pinboard fills center
  // C1/C2, no post: feed full width in center, no content panel
  // C1/C2, post selected: feed as narrow rail, content panel fills
  const postSelected = showFeed && !!selectedPostId;
  const feedCollapsed = postSelected; // feed shrinks to a rail

  const subspaceLabel: Record<string, string> = {
    c1: 'Main Journal',
    c2: 'My Journal',
    c3: 'Pin Board',
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-11 flex items-center justify-between px-4 border-b border-border/40 shrink-0 bg-surface/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src={schememark} alt="Scheme" className="h-4 object-contain opacity-80" />
        </div>
        <div className="flex items-center text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-widest gap-2">
          <button
            className="hover:text-foreground transition-colors"
            onClick={() => setLocation('/workspaces')}
          >
            Postings
          </button>
          <span className="text-border/60">/</span>
          <button
            className="hover:text-foreground transition-colors"
            onClick={() => setLocation('/workspaces/wr/subspaces')}
          >
            Writers Room
          </button>
          <span className="text-border/60">/</span>
          <span className="text-primary">{subspaceLabel[activeSubspace] ?? activeSubspace}</span>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          {session.userName}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* LEFT — Feed panel (C1/C2 only) */}
        {showFeed && (
          <div
            className={cn(
              "shrink-0 border-r border-border/40 bg-sidebar flex flex-col overflow-hidden transition-all duration-300",
              feedCollapsed ? "w-[220px]" : "w-[280px]"
            )}
          >
            <Feed
              onPostSelect={(id) => {
                setSession({ selectedPostId: id });
                refresh();
              }}
            />
          </div>
        )}

        {/* CENTER — Content panel */}
        <div className="flex-1 min-w-0 bg-background flex flex-col relative overflow-hidden">
          {activeSubspace === 'c1' && !selectedPostId && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 select-none">
              <div className="text-4xl opacity-10 font-bold tracking-tighter">SCHEME</div>
              <p className="text-xs uppercase tracking-widest opacity-40">Select a post to read</p>
            </div>
          )}
          {activeSubspace === 'c1' && selectedPostId && (
            <PostViewer onBack={() => { setSession({ selectedPostId: '' }); refresh(); }} />
          )}
          {activeSubspace === 'c2' && !selectedPostId && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 select-none">
              <div className="text-4xl opacity-10 font-bold tracking-tighter">SCHEME</div>
              <p className="text-xs uppercase tracking-widest opacity-40">Select a draft to edit</p>
            </div>
          )}
          {activeSubspace === 'c2' && selectedPostId && (
            <PostEditor onBack={() => { setSession({ selectedPostId: '' }); refresh(); }} />
          )}
          {activeSubspace === 'c3' && <Pinboard />}
        </div>

        {/* RIGHT — ANB panel */}
        <div className="w-[240px] shrink-0 border-l border-border/40 bg-sidebar flex flex-col">
          <ANBPanel />
        </div>
      </main>
    </div>
  );
}
