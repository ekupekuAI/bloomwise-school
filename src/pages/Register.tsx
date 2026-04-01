import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

type Mode = 'admin' | 'teacher';

const Register = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useApp();
  const [mode, setMode] = useState<Mode>('admin');
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signErr) throw signErr;
      if (!data.session) {
        toast.message(
          'Check your email to confirm your account, then sign in.',
          { duration: 6000 }
        );
        navigate('/login');
        return;
      }

      if (mode === 'admin') {
        const { error: rpcErr } = await supabase.rpc('register_new_school', {
          p_school_name: schoolName.trim(),
          p_address: address.trim(),
          p_phone: phone.trim(),
          p_email: schoolEmail.trim(),
          p_full_name: fullName.trim(),
          p_logo_url: null,
        });
        if (rpcErr) {
          await supabase.auth.signOut();
          throw rpcErr;
        }
        toast.success('School and admin account created');
      } else {
        const { error: rpcErr } = await supabase.rpc('register_teacher', {
          p_school_code: schoolCode.trim(),
          p_full_name: fullName.trim(),
        });
        if (rpcErr) {
          await supabase.auth.signOut();
          throw rpcErr;
        }
        toast.success('Teacher profile linked to school');
      }

      await refreshProfile();
      navigate(mode === 'admin' ? '/admin' : '/teacher', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo className="h-14 w-14 rounded-2xl shadow-md ring-1 ring-border" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create account</h1>
          <p className="text-muted-foreground text-sm mt-1">SmartSchool Manager</p>
        </div>
        <div className="card-elevated p-6">
          <div className="flex rounded-lg border overflow-hidden mb-4">
            {(['admin', 'teacher'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'admin' ? 'New school (Admin)' : 'Join as teacher'}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  className="mt-1.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  className="mt-1.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="reg-name">Full name</Label>
                <Input
                  id="reg-name"
                  className="mt-1.5"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>

            {mode === 'admin' ? (
              <>
                <div>
                  <Label htmlFor="sch-name">School name</Label>
                  <Input
                    id="sch-name"
                    className="mt-1.5"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sch-addr">Address</Label>
                  <Textarea
                    id="sch-addr"
                    className="mt-1.5"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sch-phone">School phone</Label>
                    <Input
                      id="sch-phone"
                      className="mt-1.5"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sch-mail">School email</Label>
                    <Input
                      id="sch-mail"
                      type="email"
                      className="mt-1.5"
                      value={schoolEmail}
                      onChange={(e) => setSchoolEmail(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="sch-code">School code</Label>
                <Input
                  id="sch-code"
                  className="mt-1.5 font-mono"
                  placeholder="From your administrator"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Please wait…' : 'Sign up'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
