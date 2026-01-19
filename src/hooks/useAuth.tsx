import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  createDevSession,
  loadDevSession,
  saveDevSession,
  clearDevSession,
  isDevModeEnabled,
  setDevModeEnabled,
  updateDevProfile as updateDevProfileStore,
  setDevGenres as setDevGenresStore,
  type DevProfile,
  type DevSession,
} from '@/services/devAuth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDevMode: boolean;
  devProfile: DevProfile | null;
  enableDevMode: () => void;
  disableDevMode: () => void;
  resetDevSession: () => void;
  updateDevProfile: (updates: DevProfile) => void;
  setDevGenres: (genres: string[]) => void;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toMockUser = (session: DevSession): User => {
  return {
    id: session.user.id,
    email: session.user.email,
    user_metadata: session.user.user_metadata || {},
  } as User;
};

const toMockSession = (session: DevSession): Session => {
  return {
    user: toMockUser(session),
    access_token: 'dev-access',
    refresh_token: 'dev-refresh',
    token_type: 'bearer',
  } as Session;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(() => isDevModeEnabled());
  const [devProfile, setDevProfile] = useState<DevProfile | null>(null);

  const applyDevSession = (devSession: DevSession | null) => {
    if (!devSession) {
      setUser(null);
      setSession(null);
      setDevProfile(null);
      setLoading(false);
      return;
    }
    setUser(toMockUser(devSession));
    setSession(toMockSession(devSession));
    setDevProfile(devSession.profile || null);
    setLoading(false);
  };

  useEffect(() => {
    if (isDevMode) {
      applyDevSession(loadDevSession());
      return;
    }

    setDevProfile(null);
    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isDevMode]);

  const enableDevMode = () => {
    if (!import.meta.env.DEV) return;
    setDevModeEnabled(true);
    setIsDevMode(true);
    applyDevSession(loadDevSession());
  };

  const disableDevMode = () => {
    setDevModeEnabled(false);
    clearDevSession();
    setIsDevMode(false);
  };

  const resetDevSession = () => {
    clearDevSession();
    if (isDevMode) {
      applyDevSession(null);
    }
  };

  const updateDevProfile = (updates: DevProfile) => {
    if (!isDevMode) return;
    const next = updateDevProfileStore(updates);
    setDevProfile(next?.profile || null);
  };

  const setDevGenres = (genres: string[]) => {
    if (!isDevMode) return;
    const next = setDevGenresStore(genres);
    setDevProfile(next?.profile || null);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    if (isDevMode) {
      const devSession = createDevSession(email, name);
      saveDevSession(devSession);
      applyDevSession(devSession);
      return { error: null };
    }

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (isDevMode) {
      const existing = loadDevSession();
      const devSession = existing || createDevSession(email);
      saveDevSession(devSession);
      applyDevSession(devSession);
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    if (isDevMode) {
      clearDevSession();
      applyDevSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isDevMode,
      devProfile,
      enableDevMode,
      disableDevMode,
      resetDevSession,
      updateDevProfile,
      setDevGenres,
      signUp,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
