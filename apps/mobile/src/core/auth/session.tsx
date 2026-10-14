import type { Session } from '@skkil-time/auth';
import { type ReactNode, createContext, use, useEffect, useState } from 'react';

import { auth } from '@/core/api/client';
import { queryClient } from '@/core/api/query-client';

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  });
  useEffect(() => {
    void auth
      .session()
      .then((session) => setState({ session, loading: false }));
    return auth.subscribe((session) => {
      if (!session) queryClient.clear();
      setState({ session, loading: false });
    });
  }, []);
  return <SessionContext value={state}>{children}</SessionContext>;
}

export const useSession = () => use(SessionContext);
