import React, { useEffect, useState } from 'react';
import { Switch, Route, Router as WouterRouter, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { getSession } from '@/session';

import Login from '@/pages/Login';
import WorkspaceSelection from '@/pages/WorkspaceSelection';
import SubspaceSelection from '@/pages/SubspaceSelection';
import WritersRoom from '@/pages/WritersRoom';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RouteGuard({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  const session = getSession();

  useEffect(() => {
    if (!session) {
      setLocation('/login');
    }
  }, [session, setLocation]);

  if (!session) return null;
  return <Component />;
}

function Router() {
  const session = getSession();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      if (session?.currentWorkspace && session?.currentSubspace) {
        setLocation(`/writers-room?subspace=${session.currentSubspace}`);
      } else if (session?.currentWorkspace) {
        setLocation('/workspaces/wr/subspaces');
      } else if (session) {
        setLocation('/workspaces');
      } else {
        setLocation('/login');
      }
    }
  }, [session, setLocation]);

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/workspaces" component={() => <RouteGuard component={WorkspaceSelection} />} />
      <Route path="/workspaces/wr/subspaces" component={() => <RouteGuard component={SubspaceSelection} />} />
      <Route path="/writers-room" component={() => <RouteGuard component={WritersRoom} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
