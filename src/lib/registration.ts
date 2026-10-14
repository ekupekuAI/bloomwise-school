import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type PendingRegistration =
  | { mode: 'admin'; full_name: string; school_name: string; address: string; phone: string; email: string }
  | { mode: 'teacher'; full_name: string; school_code: string };

/** Creates the school / teacher profile from the details saved at sign-up. */
export async function completeRegistration(reg: PendingRegistration) {
  if (reg.mode === 'admin') {
    return supabase.rpc('register_new_school', {
      p_school_name: reg.school_name,
      p_address: reg.address,
      p_phone: reg.phone,
      p_email: reg.email,
      p_full_name: reg.full_name,
      p_logo_url: null,
    });
  }
  return supabase.rpc('register_teacher', {
    p_school_code: reg.school_code,
    p_full_name: reg.full_name,
  });
}

/** When email confirmation is on, sign-up has no session, so the profile is finished on first login. */
export function pendingRegistrationOf(user: User): PendingRegistration | null {
  const p = user.user_metadata?.pending_registration as PendingRegistration | undefined;
  return p && (p.mode === 'admin' || p.mode === 'teacher') ? p : null;
}
