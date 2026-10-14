import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when .env is missing — the UI shows a setup message instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.');
}

// createClient throws on an empty URL, which used to blank the whole app (even the landing page).
export const supabase = createClient(
  isSupabaseConfigured ? url : 'http://localhost.invalid',
  isSupabaseConfigured ? anonKey : 'missing-anon-key'
);
