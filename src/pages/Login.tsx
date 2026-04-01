import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile, userProfile, currentUser, loading } = useApp();

  const from =
    (location.state as { from?: string } | null)?.from ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !currentUser || !userProfile) return;
    const defaultPath = userProfile.role === 'admin' ? '/admin' : '/teacher';
    const ok =
      from &&
      from !== '/login' &&
      from !== '/register' &&
      !from.startsWith('/register');
    navigate(ok ? from : defaultPath, { replace: true });
  }, [loading, currentUser, userProfile, from, navigate]);

  if (!loading && currentUser && userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Redirecting…
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await refreshProfile();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No session');
      const { data: row } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!row) {
        toast.error('Profile missing. Complete registration first.');
        await supabase.auth.signOut();
        return;
      }
      const role = row.role as 'admin' | 'teacher';
      toast.success('Signed in');
      const defaultPath = role === 'admin' ? '/admin' : '/teacher';
      const ok =
        from &&
        from !== '/login' &&
        from !== '/register' &&
        !from.startsWith('/register');
      navigate(ok ? from : defaultPath, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo className="h-14 w-14 rounded-2xl shadow-md ring-1 ring-border" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to SmartSchool Manager</p>
        </div>
        <div className="card-elevated p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.com"
                className="mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New school?{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Register
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
