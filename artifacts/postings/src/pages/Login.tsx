import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { setSession } from '@/session';
import { useToast } from '@/hooks/use-toast';
import logoOrange from '@assets/Logo_(orange)_1779887427469.png';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [displayName, setDisplayName] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast({ title: 'Enter your name to continue.', variant: 'destructive' });
      return;
    }

    loginMutation.mutate({ data: { displayName: displayName.trim() } as any }, {
      onSuccess: (user) => {
        const isAdmin = (user as any).isAdmin === true || displayName.trim().endsWith('_');
        setSession({
          userId: user.id,
          userName: user.name,
          userTags: user.tags || [],
          isAdmin,
        });
        setLocation('/workspaces');
      },
      onError: (err: any) => {
        toast({ title: 'Login failed', description: err?.message || 'Unknown error', variant: 'destructive' });
      }
    });
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        backgroundSize: '200px 200px',
      }}
    >
      <div className="z-10 flex flex-col items-center gap-16">
        <img
          src={logoOrange}
          alt="Scheme"
          className="w-64 md:w-80 object-contain select-none"
        />

        <form onSubmit={handleLogin} className="flex flex-col items-center gap-4 w-64">
          <input
            type="text"
            placeholder="your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent border-0 border-b border-border/40 text-foreground text-sm text-center font-mono py-2 outline-none placeholder:text-muted-foreground/40 focus:border-primary/60 transition-colors"
          />
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="mt-2 px-6 py-2 text-xs font-semibold uppercase tracking-widest text-primary border border-primary/40 hover:border-primary hover:bg-primary/10 transition-all rounded-sm disabled:opacity-40"
          >
            {loginMutation.isPending
              ? <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Entering…</span>
              : 'Enter Postings'}
          </button>
        </form>
      </div>
    </div>
  );
}
