import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isInitialized: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      try {
        const {
          data: { session: nextSession },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      } catch {
        if (!isMounted) {
          return;
        }

        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    void initializeSession();

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, isInitialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
