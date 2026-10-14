import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'teacher';

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  school_id: string;
  created_at: string;
};

export type School = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  school_code: string;
  created_at: string;
};

type AppContextValue = {
  currentUser: User | null;
  userProfile: UserProfile | null;
  school: School | null;
  schoolId: string | null;
  loading: boolean;
  refreshProfile: (sessionUser?: User) => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

async function fetchProfileAndSchool(userId: string): Promise<{
  profile: UserProfile | null;
  school: School | null;
}> {
  const { data, error } = await supabase
    .from('users')
    .select('*, schools(*)')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return { profile: null, school: null };
  }

  // Separate the joined 'schools' payload from the profile columns
  const { schools, ...profileData } = data as Record<string, unknown> & { schools: unknown };
  const schoolPayload = Array.isArray(schools) ? schools[0] : schools;

  return {
    profile: profileData as UserProfile,
    school: (schoolPayload as School) || null,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  // Each profile load gets a sequence number so a slow, older response (e.g. the
  // SIGNED_IN event fired before registration finished) can't overwrite a newer one.
  const seq = useRef(0);

  const loadFor = useCallback(async (user: User | null): Promise<UserProfile | null> => {
    const mine = ++seq.current;
    if (!user) {
      setCurrentUser(null);
      setUserProfile(null);
      setSchool(null);
      return null;
    }
    const { profile, school: sch } = await fetchProfileAndSchool(user.id);
    if (mine === seq.current) {
      setCurrentUser(user);
      setUserProfile(profile);
      setSchool(sch);
    }
    return profile;
  }, []);

  const refreshProfile = useCallback(
    async (sessionUser?: User): Promise<UserProfile | null> => {
      const user = sessionUser || (await supabase.auth.getUser()).data.user;
      return loadFor(user ?? null);
    },
    [loadFor]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      // Defer: calling Supabase inside this callback can deadlock the auth client.
      setTimeout(() => {
        void loadFor(session?.user ?? null).finally(() => setLoading(false));
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, [loadFor]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
    setSchool(null);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      userProfile,
      school,
      schoolId: userProfile?.school_id ?? null,
      loading,
      refreshProfile,
      signOut,
    }),
    [currentUser, userProfile, school, loading, refreshProfile, signOut]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
