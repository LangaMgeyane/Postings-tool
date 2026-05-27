import React, { useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { getSession } from '@/session';
import { Feed } from '@/components/Feed';
import { PostViewer } from '@/components/PostViewer';
import { PostEditor } from '@/components/PostEditor';
import { Pinboard } from '@/components/Pinboard';
import { ANBPanel } from '@/components/ANBPanel';
import schememark from '@assets/Schememark_02_1779887427469.png';

export default function WritersRoom() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const subspaceParam = params.get('subspace');
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

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden">
      <header className="h-12 flex items-center justify-between px-4 border-b border-border/50 shrink-0 bg-surface">
        <div className="flex items-center gap-3">
          <img src={schememark} alt="Scheme" className="h-5 object-contain" />
        </div>
        <div className="flex items-center text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
          <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => setLocation('/workspaces')}>Workspace</span>
          <span className="mx-2 text-border">/</span>
          <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => setLocation('/workspaces/wr/subspaces')}>WR</span>
          <span className="mx-2 text-border">/</span>
          <span className="text-primary">{activeSubspace.toUpperCase()}</span>
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {session.userName}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Feed (only C1/C2) */}
        {(activeSubspace === 'c1' || activeSubspace === 'c2') && (
          <div className="w-[280px] shrink-0 border-r border-border/50 bg-sidebar flex flex-col">
            <Feed />
          </div>
        )}

        {/* Center Panel - Content */}
        <div className="flex-1 min-w-0 bg-background relative flex flex-col">
          {activeSubspace === 'c1' && <PostViewer />}
          {activeSubspace === 'c2' && <PostEditor />}
          {activeSubspace === 'c3' && <Pinboard />}
        </div>

        {/* Right Panel - ANB */}
        <div className="w-[280px] shrink-0 border-l border-border/50 bg-sidebar flex flex-col">
          <ANBPanel />
        </div>
      </main>
    </div>
  );
}
