import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setLoading(false);
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Use at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please confirm your new password.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast({
        title: 'Reset failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Password updated',
      description: 'You can now sign in with your new password.',
    });
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6 text-center">
        <div className="card-neon rounded-xl border border-border/50 p-6 max-w-md">
          <h1 className="font-display font-semibold text-lg mb-2">Reset link expired</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Please request a new password reset email.
          </p>
          <Button variant="neon" onClick={() => navigate('/auth')}>
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
      <div className="card-neon rounded-xl border border-border/50 p-6 w-full max-w-md">
        <h1 className="font-display font-semibold text-xl mb-2">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose a new password for your account.
        </p>
        <form onSubmit={handleReset} className="space-y-4">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-muted border-border/50"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-12 bg-muted border-border/50"
          />
          <Button type="submit" variant="neon" className="w-full h-12" disabled={saving}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
