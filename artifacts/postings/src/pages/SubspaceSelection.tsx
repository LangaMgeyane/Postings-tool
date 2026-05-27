import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getSession, setSession } from '@/session';
import schememark from '@assets/Schememark_02_1779887427469.png';
import { BookOpen, PenTool, LayoutTemplate, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SubspaceSelection() {
  const [, setLocation] = useLocation();
  const session = getSession();

  useEffect(() => {
    if (!session?.userId) {
      setLocation('/login');
    } else if (session.currentWorkspace !== 'WR') {
      setLocation('/workspaces');
    }
  }, [session, setLocation]);

  if (!session?.userId || session.currentWorkspace !== 'WR') return null;

  const subspaces = [
    {
      id: 'c1',
      name: 'Main Journal',
      description: 'The central feed of all working posts. Read, review, and annotate.',
      icon: BookOpen,
      color: 'text-primary'
    },
    {
      id: 'c2',
      name: 'My Journal',
      description: 'Your personal desk. Draft new posts and edit your work.',
      icon: PenTool,
      color: 'text-amber-500'
    },
    {
      id: 'c3',
      name: 'Pin Board',
      description: 'Infinite canvas for organizing thoughts, references, and connections.',
      icon: LayoutTemplate,
      color: 'text-blue-400'
    }
  ];

  const handleSelect = (id: string) => {
    setSession({ currentSubspace: id });
    setLocation(`/writers-room?subspace=${id}`);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground bg-noise relative">
      <header className="h-16 px-6 flex items-center gap-4 border-b border-border/50 z-10">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/workspaces')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <img src={schememark} alt="Mark" className="h-6 object-contain" />
          <div className="flex items-center text-sm font-medium text-muted-foreground">
            <span>Writers Room</span>
            <span className="mx-2 text-border">/</span>
            <span className="text-foreground">Subspaces</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="w-full max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-sans tracking-tight">Select Subspace</h1>
            <p className="text-muted-foreground mt-2">Choose your context for this session.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subspaces.map((sub) => {
              const Icon = sub.icon;
              return (
                <div
                  key={sub.id}
                  onClick={() => handleSelect(sub.id)}
                  className="flex flex-col p-6 rounded-xl border border-border bg-surface hover:bg-raised hover:border-primary/50 cursor-pointer transition-all duration-200 group"
                >
                  <div className="mb-6">
                    <Icon className={cn("w-8 h-8", sub.color)} />
                  </div>
                  <h3 className="text-xl font-semibold font-sans group-hover:text-primary transition-colors">{sub.name}</h3>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    {sub.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
