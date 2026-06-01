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

  useEffect(() => {
    if (!session?.userId) setLocation('/login');
    else if (session.currentWorkspace !== 'WR') setLocation('/workspaces');
  }, [session, setLocation]);

  // Subspace change → hard-reset active post
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

  // My Journal: enforce authorship
  useEffect(() => {
    if (activeSubspace === 'c2' && selectedPostId && session?.userId) {
      const isAuthor = session.isAuthorOfSelected;
      if (!isAuthor) {
        setSession({ selectedPostId: '', isAuthorOfSelected: false });
        refresh();
      }
    }
  }, [activeSubspace, selectedPostId, session?.userId, session?.isAuthorOfSelected, refresh]);

  // Mobile: auto-switch to content on post select
  useEffect(() => {
    if (selectedPostId) setMobileView('content');
  }, [selectedPostId]);

  if (!session?.userId || session.currentWorkspace !== 'WR') return null;

  const showFeed = activeSubspace === 'c1' || activeSubspace === 'c2';
  const postSelected = showFeed && !!selectedPostId;
  const isMyJournal = activeSubspace === 'c2';
  const isMainJournal = activeSubspace === 'c1';
  const isBoard = activeSubspace === 'c3';

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
      <main className="flex-1 overflow-hidden hidden md:flex relative">
        {/* Board — full width, no panels */}
        {isBoard && (
          <div className="absolute inset-0">
            <Pinboard />
          </div>
        )}

        {/* Feed + Content + ANB — two-panel system */}
        {showFeed && (
          <>
            {/* Feed: full width when no post, hidden when post selected — slide transition */}
            <div
              className={cn(
                'absolute inset-y-0 left-0 bg-sidebar border-r border-border/40 flex flex-col overflow-hidden',
                'transition-all duration-300 ease-in-out z-10',
                postSelected ? 'w-0 opacity-0 pointer-events-none' : 'w-full opacity-100'
              )}
            >
              <Feed onPostSelect={handlePostSelect} isMyJournal={isMyJournal} />
            </div>

            {/* Content + ANB: hidden until post selected, slides in from right */}
            <div
              className={cn(
                'absolute inset-y-0 right-0 flex',
                'transition-all duration-300 ease-in-out',
                postSelected ? 'left-0 opacity-100' : 'left-full opacity-0 pointer-events-none'
              )}
            >
              <div className="flex-1 min-w-0 bg-background flex flex-col relative overflow-hidden">
                {!postSelected && <EmptyCenter subspace={activeSubspace} />}
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
              </div>

              {/* ANB panel — fixed width, right side */}
              <div className="w-[240px] shrink-0 border-l border-border/40 bg-sidebar flex flex-col overflow-hidden">
                <ANBPanel />
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── MOBILE layout ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden md:hidden relative">
        <div className="flex-1 relative overflow-hidden">
          {/* Feed / Board panel */}
          <div
            className={cn(
              'absolute inset-0 transition-transform duration-300 ease-in-out bg-sidebar',
              mobileView === 'feed' ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            {showFeed && <Feed onPostSelect={handlePostSelect} isMyJournal={isMyJournal} />}
            {isBoard && <Pinboard />}
          </div>

          {/* Content panel */}
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

          {/* ANB slide-up sheet — only for journal views */}
          {showFeed && (
            <div
              className={cn(
                'absolute inset-0 bg-sidebar transition-transform duration-300 ease-in-out z-10',
                mobileView === 'anb' ? 'translate-y-0' : 'translate-y-full'
              )}
            >
              <ANBPanel onClose={() => setMobileView(postSelected ? 'content' : 'feed')} />
            </div>
          )}
        </div>

        {/* Mobile bottom nav */}
        <nav className="h-14 bg-surface/95 backdrop-blur border-t border-border/40 flex items-center shrink-0 z-30">
          <MobileTab
            icon={<Newspaper className="w-5 h-5" />}
            label={isBoard ? 'Board' : 'Feed'}
            active={mobileView === 'feed'}
            onClick={() => setMobileView('feed')}
          />
          <MobileTab
            icon={<span className="text-base leading-none">▦</span>}
            label="Read"
            active={mobileView === 'content'}
            disabled={!postSelected && showFeed}
            onClick={() => (postSelected || isBoard) ? setMobileView('content') : undefined}
          />
          {showFeed && (
            <MobileTab
              icon={<span className="text-base leading-none">≡</span>}
              label="Notes"
              active={mobileView === 'anb'}
              onClick={() => setMobileView('anb')}
            />
          )}
        </nav>
      </div>
    </div>
  );
}

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
