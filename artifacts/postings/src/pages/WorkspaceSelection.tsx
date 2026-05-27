import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getSession, setSession, clearSession } from '@/session';
import logoOrange from '@assets/Logo_(orange)_1779887427469.png';
import ccmMark from '@assets/ccm_1779887427469.png';
import { Button } from '@/components/ui/button';
import { LogOut, Lock, Edit3, Newspaper, GalleryHorizontalEnd } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkspaceSelection() {
  const [, setLocation] = useLocation();
  const session = getSession();

  useEffect(() => {
    if (!session?.userId) {
      setLocation('/login');
    }
  }, [session, setLocation]);

  if (!session?.userId) return null;

  const workspaces = [
    {
      id: 'WR',
      name: 'Writers Room',
      description: 'Draft, annotate, and collaborate on early posts.',
      icon: Edit3,
      locked: false,
      status: 'Active',
    },
    {
      id: 'ET',
      name: 'Editors Table',
      description: 'Review submitted posts and manage the publication schedule.',
      icon: Newspaper,
      locked: true,
      status: 'Coming Soon',
    },
    {
      id: 'RG',
      name: 'Review Gallery',
      description: 'Final layout review and asset curation for print.',
      icon: GalleryHorizontalEnd,
      locked: true,
      status: 'Coming Soon',
    }
  ];

  const handleSelect = (id: string, locked: boolean) => {
    if (locked) return;
    setSession({ currentWorkspace: id });
    setLocation('/workspaces/wr/subspaces');
  };

  const handleLogout = () => {
    clearSession();
    setLocation('/login');
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground bg-noise relative">
      <header className="h-16 px-6 flex items-center justify-between border-b border-border/50 z-10">
        <img src={logoOrange} alt="Scheme" className="h-5 object-contain" />
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">{session.userName}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="w-full max-w-5xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-sans tracking-tight">Select Workspace</h1>
            <p className="text-muted-foreground mt-2">Where are you working today?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workspaces.map((ws) => {
              const Icon = ws.icon;
              return (
                <div
                  key={ws.id}
                  onClick={() => handleSelect(ws.id, ws.locked)}
                  className={cn(
                    "flex flex-col p-6 rounded-xl border transition-all duration-200 text-left",
                    ws.locked 
                      ? "border-border/30 bg-surface/30 opacity-60 cursor-not-allowed" 
                      : "border-border bg-surface hover:bg-raised hover:border-primary/50 cursor-pointer group"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("p-3 rounded-lg", ws.locked ? "bg-muted" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors")}>
                      <Icon className="w-6 h-6" />
                    </div>
                    {ws.locked ? (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                        {ws.status}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-semibold font-sans mt-4">{ws.name}</h3>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    {ws.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      
      <div className="fixed bottom-6 right-6 opacity-20 pointer-events-none mix-blend-screen z-0">
        <img src={ccmMark} alt="" className="w-32" />
      </div>
    </div>
  );
}
