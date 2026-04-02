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

  // Typecasting to separate data from the joined 'schools' payload
  const { schools, ...profileData } = data as any;
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

  const refreshProfile = useCallback(async (sessionUser?: User): Promise<UserProfile | null> => {
    const user = sessionUser || (await supabase.auth.getUser()).data.user;
    if (!user) {
      setCurrentUser(null);
      setUserProfile(null);
      setSchool(null);
      return null;
    }
    const { profile, school: sch } = await fetchProfileAndSchool(user.id);
    setCurrentUser(user);
    setUserProfile(profile);
    setSchool(sch);
    return profile;
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
        const { profile, school: sch } = await fetchProfileAndSchool(
          session.user.id
        );
        setCurrentUser(session.user);
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
