import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { setSession } from '@/session';
import { useToast } from '@/hooks/use-toast';
import logoOrange from '@assets/Logo_(orange)_1779887427469.png';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [slackHandle, setSlackHandle] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const loginMutation = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slackHandle.trim()) {
      toast({ title: 'Error', description: 'Please enter a Slack handle.', variant: 'destructive' });
      return;
    }

    loginMutation.mutate({ data: { slackHandle } }, {
      onSuccess: (user) => {
        setSession({
          userId: user.id,
          userName: user.name,
          userTags: user.tags || [],
        });
        setLocation('/workspaces');
      },
      onError: (err: any) => {
        toast({ title: 'Login failed', description: err?.message || 'Unknown error', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-noise relative bg-background">
      <div className="z-10 w-full max-w-sm px-6 flex flex-col items-center space-y-12">
        <img src={logoOrange} alt="Scheme Logo" className="h-8 object-contain" />
        
        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div className="space-y-2">
            <Input 
              type="text" 
              placeholder="@username" 
              value={slackHandle}
              onChange={(e) => setSlackHandle(e.target.value)}
              className="bg-surface border-border text-foreground h-12 text-lg text-center font-mono placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Enter Postings
          </Button>
        </form>
      </div>
    </div>
  );
}
