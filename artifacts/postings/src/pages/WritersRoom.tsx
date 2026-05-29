import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { getSession, setSession } from '@/session';
import { Feed } from '@/components/Feed';
import { PostViewer } from '@/components/PostViewer';
import { PostEditor } from '@/components/PostEditor';
import { Pinboard } from '@/components/Pinboard';
import { ANBPanel } from '@/components/ANBPanel';
import schememark from '@assets/Schememark_02_1779887427469.png';
import { cn } from '@/lib/utils';
import { PenTool, Layout, Newspaper } from 'lucide-react';

type MobileView = 'feed' | 'content' | 'anb';

export default function WritersRoom() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const subspaceParam = params.get('subspace');

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('feed');
  const prevSubspaceRef = useRef<string | null>(null);

  const session = getSession();
  const activeSubspace = subspaceParam || session?.currentSubspace || 'c1';
  const selectedPostId = session?.selectedPostId || '';

  // ── Guard: auth + workspace ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.userId) setLocation('/login');
    else if (session.currentWorkspace !== 'WR') setLocation('/workspaces');
  }, [session, setLocation]);

  // ── Subspace change → hard-reset active post ────────────────────────────────
  useEffect(() => {
    const prev = prevSubspaceRef.current;
    if (prev !== null && prev !== activeSubspace) {
      setSession({ selectedPostId: '', isAuthorOfSelected: false });
      setAnnotationOpen(false);
      setMobileView('feed');
      refresh();
    }
    prevSubspaceRef.current = activeSubspace;
  }, [activeSubspace, refresh]);

  // ── My Journal: enforce authorship ──────────────────────────────────────────
  useEffect(() => {
    if (activeSubspace === 'c2' && selectedPostId && session?.userId) {
      // PostViewer enforces this via isMyJournal check; also clear in case of stale session
      const isAuthor = session.isAuthorOfSelected;
      if (!isAuthor) {
        setSession({ selectedPostId: '', isAuthorOfSelected: false });
        refresh();
      }
    }
  }, [activeSubspace, selectedPostId, session?.userId, session?.isAuthorOfSelected, refresh]);

  // ── Mobile: auto-switch to content on post select ───────────────────────────
  useEffect(() => {
    if (selectedPostId) setMobileView('content');
  }, [selectedPostId]);

  if (!session?.userId || session.currentWorkspace !== 'WR') return null;

  const showFeed = activeSubspace === 'c1' || activeSubspace === 'c2';
  const postSelected = showFeed && !!selectedPostId;
  const isMyJournal = activeSubspace === 'c2';
  const isMainJournal = activeSubspace === 'c1';

  const handlePostSelect = (id: string) => {
    setSession({ selectedPostId: id, isAuthorOfSelected: isMyJournal });
    refresh();
  };

  const handleBack = () => {
    setSession({ selectedPostId: '', isAuthorOfSelected: false });
    setAnnotationOpen(false);
    setMobileView('feed');
    refresh();
  };

  const handleNavigateToBoard = () => {
    setSession({ currentSubspace: 'c3' });
    setLocation('/writers-room?subspace=c3');
  };

  const subspaceLabel: Record<string, string> = {
    c1: 'Main Journal',
    c2: 'My Journal',
    c3: 'Pin Board',
  };

  // Single Board/Annotate action button (only for c1, not c2/c3)
  const actionBtn = isMainJournal ? (
    postSelected ? (
      <button
        onClick={() => setAnnotationOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest border border-primary/30 text-primary hover:bg-primary/10 rounded-sm transition-all"
      >
        <PenTool className="w-3 h-3" /> Annotate
      </button>
    ) : (
      <button
        onClick={handleNavigateToBoard}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 rounded-sm transition-all"
      >
        <Layout className="w-3 h-3" /> Board
      </button>
    )
  ) : null;

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-11 flex items-center justify-between px-4 border-b border-border/40 shrink-0 bg-surface/80 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <img src={schememark} alt="Scheme" className="h-4 object-contain opacity-70" />
        </div>
        <div className="flex items-center text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-widest gap-2">
          <button className="hover:text-foreground transition-colors" onClick={() => setLocation('/workspaces')}>
            Postings
          </button>
          <span className="text-border/50">/</span>
          <button className="hover:text-foreground transition-colors" onClick={() => setLocation('/workspaces/wr/subspaces')}>
            WR
          </button>
          <span className="text-border/50">/</span>
          <span className="text-primary">{subspaceLabel[activeSubspace] ?? activeSubspace}</span>
        </div>
        <div className="flex items-center gap-3">
          {actionBtn}
          <span className="text-xs font-medium text-muted-foreground hidden md:block">{session.userName}</span>
        </div>
      </header>

      {/* ── DESKTOP layout ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden hidden md:flex">
        {/* Feed rail */}
        {showFeed && (
          <div
            className={cn(
              'shrink-0 border-r border-border/40 bg-sidebar flex flex-col overflow-hidden',
              'transition-[width] duration-300 ease-in-out',
              postSelected ? 'w-[200px]' : 'w-[280px]'
            )}
          >
            <Feed onPostSelect={handlePostSelect} isMyJournal={isMyJournal} />
          </div>
        )}

        {/* Center */}
        <div className="flex-1 min-w-0 bg-background flex flex-col relative overflow-hidden">
          {showFeed && !postSelected && (
            <EmptyCenter subspace={activeSubspace} />
          )}
          {isMainJournal && postSelected && (
            <PostViewer
              onBack={handleBack}
              isAnnotating={annotationOpen}
              onAnnotatingChange={setAnnotationOpen}
            />
          )}
          {isMyJournal && postSelected && (
            <PostEditor onBack={handleBack} />
          )}
          {activeSubspace === 'c3' && <Pinboard />}
        </div>

        {/* ANB panel — slides in when post is selected */}
        <div
          className={cn(
            'shrink-0 border-l border-border/40 bg-sidebar flex flex-col overflow-hidden',
            'transition-[width] duration-300 ease-in-out',
            (postSelected || activeSubspace === 'c3') ? 'w-[240px]' : 'w-0'
          )}
        >
          <ANBPanel />
        </div>
      </main>

      {/* ── MOBILE layout ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden md:hidden relative">
        {/* Panel stack */}
        <div className="flex-1 relative overflow-hidden">
          {/* Feed */}
          <div
            className={cn(
              'absolute inset-0 transition-transform duration-300 ease-in-out bg-sidebar',
              mobileView === 'feed' ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            {showFeed && <Feed onPostSelect={handlePostSelect} isMyJournal={isMyJournal} />}
            {activeSubspace === 'c3' && <Pinboard />}
          </div>

          {/* Content */}
          <div
            className={cn(
              'absolute inset-0 transition-transform duration-300 ease-in-out bg-background',
              mobileView === 'content' ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            {!postSelected && showFeed && <EmptyCenter subspace={activeSubspace} />}
            {isMainJournal && postSelected && (
              <PostViewer
                onBack={handleBack}
                isAnnotating={annotationOpen}
                onAnnotatingChange={setAnnotationOpen}
              />
            )}
            {isMyJournal && postSelected && <PostEditor onBack={handleBack} />}
          </div>

          {/* ANB slide-up sheet */}
          <div
            className={cn(
              'absolute inset-0 bg-sidebar transition-transform duration-300 ease-in-out z-10',
              mobileView === 'anb' ? 'translate-y-0' : 'translate-y-full'
            )}
          >
            <ANBPanel onClose={() => setMobileView(postSelected ? 'content' : 'feed')} />
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="h-14 bg-surface/95 backdrop-blur border-t border-border/40 flex items-center shrink-0 safe-area-bottom z-30">
          <MobileTab
            icon={<Newspaper className="w-5 h-5" />}
            label={activeSubspace === 'c3' ? 'Board' : 'Feed'}
            active={mobileView === 'feed'}
            onClick={() => setMobileView('feed')}
          />
          <MobileTab
            icon={<span className="text-base leading-none">▦</span>}
            label="Read"
            active={mobileView === 'content'}
            disabled={!postSelected && showFeed}
            onClick={() => postSelected || activeSubspace === 'c3' ? setMobileView('content') : undefined}
          />
          <MobileTab
            icon={<span className="text-base leading-none">≡</span>}
            label="Notes"
            active={mobileView === 'anb'}
            onClick={() => setMobileView('anb')}
          />
        </nav>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyCenter({ subspace }: { subspace: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none text-muted-foreground">
      <div className="text-5xl opacity-[0.06] font-bold tracking-tighter">SCHEME</div>
      <p className="text-[10px] uppercase tracking-widest opacity-30">
        {subspace === 'c2' ? 'Select a draft to edit' : 'Select a post to read'}
      </p>
    </div>
  );
}

function MobileTab({
  icon, label, active, disabled, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 flex flex-col items-center justify-center gap-1 h-full min-h-[44px] transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
        disabled ? 'opacity-30' : 'active:bg-raised/50'
      )}
    >
      {icon}
      <span className="text-[9px] uppercase tracking-widest font-semibold">{label}</span>
    </button>
  );
}
