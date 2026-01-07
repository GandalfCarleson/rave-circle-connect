import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, MapPin, Music, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GenreChip } from '@/components/GenreChip';
import { RadiusSlider } from '@/components/RadiusSlider';
import { BottomNav } from '@/components/BottomNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { AvatarUpload } from '@/components/AvatarUpload';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GENRES } from '@/lib/constants';

interface ProfileData {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  radius_km: number;
  is_discoverable: boolean;
  show_events_on_profile: boolean;
}

const BIO_MAX_LENGTH = 200;

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    username: '',
    avatar_url: null,
    bio: '',
    city: '',
    radius_km: 50,
    is_discoverable: true,
    show_events_on_profile: true,
  });
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchGenres();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setProfile({
        name: data.name,
        username: data.username,
        avatar_url: data.avatar_url,
        bio: data.bio || '',
        city: data.city,
        radius_km: data.radius_km || 50,
        is_discoverable: data.is_discoverable ?? true,
        show_events_on_profile: data.show_events_on_profile ?? true,
      });
    }
    setLoading(false);
  };

  const fetchGenres = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_preferences')
      .select('genre')
      .eq('user_id', user.id);
    
    if (data) {
      setSelectedGenres(data.map(p => p.genre));
    }
  };

  const updateProfile = async (updates: Partial<ProfileData>) => {
    if (!user) return;
    setProfile(prev => ({ ...prev, ...updates }));
    
    await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);
  };

  const toggleGenre = async (genre: string) => {
    if (!user) return;
    
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(prev => prev.filter(g => g !== genre));
      await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('genre', genre);
    } else {
      setSelectedGenres(prev => [...prev, genre]);
      await supabase
        .from('user_preferences')
        .insert({ user_id: user.id, genre, intensity: 3 });
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        name: profile.name,
        username: profile.username,
        bio: profile.bio,
        city: profile.city,
        radius_km: profile.radius_km,
        is_discoverable: profile.is_discoverable,
        show_events_on_profile: profile.show_events_on_profile,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Profile saved!',
        description: 'Your changes have been saved',
      });
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <AnimatedBackground />
      
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-display font-bold">Profile</h1>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Avatar & Basic Info */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-neon rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-start gap-4 mb-6">
            <AvatarUpload
              userId={user!.id}
              currentAvatarUrl={profile.avatar_url}
              onUpload={(url) => setProfile(prev => ({ ...prev, avatar_url: url }))}
            />
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-lg truncate">{profile.name || 'Set your name'}</h2>
              <p className="text-muted-foreground text-sm">@{profile.username || 'username'}</p>
              {profile.bio && (
                <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{profile.bio}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={profile.name || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
                className="mt-1.5 bg-muted border-border/50"
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={profile.username || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                placeholder="username"
                className="mt-1.5 bg-muted border-border/50"
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value.slice(0, BIO_MAX_LENGTH) }))}
                placeholder="Tell us about yourself..."
                className="mt-1.5 bg-muted border-border/50 resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {(profile.bio?.length || 0)}/{BIO_MAX_LENGTH}
              </p>
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={profile.city || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Your city"
                className="mt-1.5 bg-muted border-border/50"
              />
            </div>
          </div>
        </motion.section>

        {/* Radius */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-neon rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold">Event Radius</h3>
          </div>
          <RadiusSlider
            value={profile.radius_km}
            onChange={(value) => updateProfile({ radius_km: value })}
            city={profile.city || undefined}
          />
        </motion.section>

        {/* Music Preferences */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-neon rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-secondary" />
            <h3 className="font-display font-semibold">Music Preferences</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Select the genres you love
          </p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(genre => (
              <GenreChip
                key={genre}
                genre={genre}
                isActive={selectedGenres.includes(genre)}
                onClick={() => toggleGenre(genre)}
              />
            ))}
          </div>
        </motion.section>

        {/* Settings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-neon rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-accent" />
            <h3 className="font-display font-semibold">Settings</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Discoverable for new crews</Label>
                <p className="text-xs text-muted-foreground">Let others find you</p>
              </div>
              <Switch
                checked={profile.is_discoverable}
                onCheckedChange={(checked) => updateProfile({ is_discoverable: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show events on profile</Label>
                <p className="text-xs text-muted-foreground">Display events you're going to</p>
              </div>
              <Switch
                checked={profile.show_events_on_profile}
                onCheckedChange={(checked) => updateProfile({ show_events_on_profile: checked })}
              />
            </div>
          </div>
        </motion.section>

        {/* Connected Accounts (Placeholder) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-neon rounded-xl border border-border/50 p-6 opacity-60"
        >
          <h3 className="font-display font-semibold mb-4">Connected Accounts</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-sm">Meta (Facebook/Instagram)</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Connect
            </Button>
          </div>
        </motion.section>

        {/* Save Button */}
        <Button
          onClick={saveProfile}
          disabled={saving}
          className="w-full"
          variant="neon"
          size="lg"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Profile'}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}