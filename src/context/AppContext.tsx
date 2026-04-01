import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

async function fetchProfileAndSchool(userId: string): Promise<{
  profile: UserProfile | null;
  school: School | null;
}> {
  const { data: profile, error: pErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (pErr || !profile) {
    return { profile: null, school: null };
  }

  const typed = profile as UserProfile;
  const { data: school, error: sErr } = await supabase
    .from('schools')
    .select('*')
    .eq('id', typed.school_id)
    .maybeSingle();

  if (sErr || !school) {
    return { profile: typed, school: null };
  }

  return { profile: typed, school: school as School };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCurrentUser(null);
      setUserProfile(null);
      setSchool(null);
      return;
    }
    setCurrentUser(user);
    const { profile, school: sch } = await fetchProfileAndSchool(user.id);
    setUserProfile(profile);
    setSchool(sch);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshProfile();
      if (mounted) setLoading(false);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          setCurrentUser(null);
          setUserProfile(null);
          setSchool(null);
          return;
        }
        setCurrentUser(session.user);
        const { profile, school: sch } = await fetchProfileAndSchool(
          session.user.id
        );
        setUserProfile(profile);
        setSchool(sch);
      }
    );
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

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
