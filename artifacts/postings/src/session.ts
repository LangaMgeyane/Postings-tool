export interface SessionState {
  userId: string;
  userName: string;
  userTags: string[];
  currentWorkspace: string;
  currentSubspace: string;
  selectedPostId: string;
  isAuthorOfSelected: boolean;
  sessionCode: string;
  isAdmin: boolean;
}

export function getSession(): SessionState | null {
  const params = new URLSearchParams(window.location.search);
  const s = params.get('s');
  if (s) {
    try {
      const decoded = JSON.parse(atob(s));
      sessionStorage.setItem('scheme_session', JSON.stringify(decoded));
      return decoded;
    } catch (e) {
      console.error('Failed to parse session from URL', e);
    }
  }
  const stored = sessionStorage.getItem('scheme_session');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function setSession(s: Partial<SessionState>): void {
  const current = getSession() || {} as SessionState;
  const next = { ...current, ...s };
  
  if (next.userId && next.currentWorkspace) {
      next.sessionCode = buildSessionCode(next);
  }
  
  sessionStorage.setItem('scheme_session', JSON.stringify(next));
  
  const url = new URL(window.location.href);
  url.searchParams.set('s', btoa(JSON.stringify(next)));
  window.history.replaceState({}, '', url);
}

export function clearSession(): void {
  sessionStorage.removeItem('scheme_session');
  const url = new URL(window.location.href);
  url.searchParams.delete('s');
  window.history.replaceState({}, '', url);
}

export function buildSessionCode(s: SessionState): string {
  return `${s.userId}-${s.currentWorkspace}-${s.currentSubspace || 'NONE'}-${s.selectedPostId || 'NONE'}`;
}
