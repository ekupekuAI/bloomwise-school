import { isSupabaseConfigured } from '@/lib/supabase';

/** Shown on auth screens when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
export function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Backend not configured</p>
      <p className="mt-1">
        Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code>, set{' '}
        <code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>{' '}
        from your Supabase project (Settings → API), then restart the dev server.
      </p>
    </div>
  );
}
