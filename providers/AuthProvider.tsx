import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getLocalDisplayName, subscribeLocalDisplayNameChanges } from '../lib/localDb';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profileDisplayName: string | null;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profileDisplayName: null,
  isInitialized: false,
});

function resolveProfileDisplayName(user: User | null, localDisplayName?: string | null) {
  const trimmedLocalDisplayName = localDisplayName?.trim() ?? '';

  if (trimmedLocalDisplayName.length > 0) {
    return trimmedLocalDisplayName;
  }

  if (!user) {
    return null;
  }

  try {
    const cachedDisplayName = getLocalDisplayName(user.id)?.trim() ?? '';

    if (cachedDisplayName.length > 0) {
      return cachedDisplayName;
    }
  } catch {
    // Fall back to auth metadata when the local DB is unavailable.
  }

  const metadata = user.user_metadata ?? {};
  const displayName = typeof metadata.display_name === 'string' ? metadata.display_name.trim() : '';

  if (displayName.length > 0) {
    return displayName;
  }

  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';

  if (fullName.length > 0) {
    return fullName;
  }

  const emailPrefix = user.email?.split('@')[0]?.trim() ?? '';

  return emailPrefix.length > 0 ? emailPrefix : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const currentUserRef = useRef<User | null>(null);

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

        const nextUser = nextSession?.user ?? null;

        currentUserRef.current = nextUser;
        setSession(nextSession);
        setUser(nextUser);
        setProfileDisplayName(resolveProfileDisplayName(nextUser));
      } catch {
        if (!isMounted) {
          return;
        }

        currentUserRef.current = null;
        setSession(null);
        setUser(null);
        setProfileDisplayName(null);
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

        const nextUser = session?.user ?? null;

        currentUserRef.current = nextUser;
        setSession(session);
        setUser(nextUser);
        setProfileDisplayName(resolveProfileDisplayName(nextUser));
      }
    );

    const unsubscribeDisplayNameChanges = subscribeLocalDisplayNameChanges(({ userId, displayName }) => {
      const currentUser = currentUserRef.current;

      if (!currentUser || currentUser.id !== userId) {
        return;
      }

      setProfileDisplayName(resolveProfileDisplayName(currentUser, displayName));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      unsubscribeDisplayNameChanges();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profileDisplayName, isInitialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
