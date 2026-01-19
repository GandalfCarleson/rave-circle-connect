import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AnimatedBackground } from '@/components/AnimatedBackground';

export default function Settings() {
  const { user, loading: authLoading, isDevMode, resetDevSession } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Use at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please confirm your new password.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;

    if (!email) {
      setSaving(false);
      toast({
        title: 'Unable to verify account',
        description: 'Please sign in again.',
        variant: 'destructive',
      });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setSaving(false);
      toast({
        title: 'Current password incorrect',
        description: signInError.message,
        variant: 'destructive',
      });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (updateError) {
      toast({
        title: 'Failed to update password',
        description: updateError.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Password updated',
      description: 'Your password has been changed.',
    });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <AnimatedBackground />
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-display font-bold">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 relative z-10">
        {!isDevMode && (
          <section className="card-neon rounded-xl border border-border/50 p-6">
            <h2 className="font-display font-semibold mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1.5 bg-muted border-border/50"
                />
              </div>
              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 bg-muted border-border/50"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5 bg-muted border-border/50"
                />
              </div>
              <Button type="submit" variant="neon" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update password'}
              </Button>
            </form>
          </section>
        )}

        {isDevMode && (
          <section className="card-neon rounded-xl border border-border/50 p-6">
            <h2 className="font-display font-semibold mb-2">Dev Session</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Reset the local dev user and return to signup.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                resetDevSession();
                navigate('/auth');
              }}
            >
              Reset Dev Session
            </Button>
          </section>
        )}

        <section className="card-neon rounded-xl border border-border/50 p-6 opacity-70">
          <h2 className="font-display font-semibold mb-2">Coming soon</h2>
          <p className="text-sm text-muted-foreground">
            Notifications, privacy, and account preferences will appear here.
          </p>
        </section>
      </div>
    </div>
  );
}
