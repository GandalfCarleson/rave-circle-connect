import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Loader2, Music, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GenreChip } from '@/components/GenreChip';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GENRES } from '@/lib/constants';

const emailSchema = z.string().email('Please enter a valid email');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

type SignupStep = 'account' | 'genres' | 'location';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = useState<SignupStep>('account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; genres?: string; location?: string }>({});

  const {
    signIn,
    signUp,
    user,
    isDevMode,
    enableDevMode,
    disableDevMode,
    resetDevSession,
    updateDevProfile,
    setDevGenres,
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const demoEmail = import.meta.env.DEV ? import.meta.env.VITE_DEMO_EMAIL : undefined;
  const demoPassword = import.meta.env.DEV ? import.meta.env.VITE_DEMO_PASSWORD : undefined;
  const hasDemoCredentials = Boolean(demoEmail && demoPassword);

  useEffect(() => {
    if (user) {
      navigate('/feed');
    }
  }, [user, navigate]);

  const validateStep1 = () => {
    const newErrors: typeof errors = {};

    const nameResult = nameSchema.safeParse(name);
    if (!nameResult.success) {
      newErrors.name = nameResult.error.errors[0].message;
    }

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: typeof errors = {};
    
    if (selectedGenres.length === 0) {
      newErrors.genres = 'Please select at least one genre';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: typeof errors = {};

    if (!city.trim() && (latitude === null || longitude === null)) {
      newErrors.location = 'Please enter a city or use your current location';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateLogin = () => {
    const newErrors: typeof errors = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (signupStep === 'account') {
      if (validateStep1()) {
        setSignupStep('genres');
        setErrors({});
      }
      return;
    }
    if (signupStep === 'genres') {
      if (validateStep2()) {
        setSignupStep('location');
        setErrors({});
      }
    }
  };

  const MAX_GENRES = 3;

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => {
      if (prev.includes(genre)) {
        return prev.filter(g => g !== genre);
      }
      if (prev.length >= MAX_GENRES) {
        toast({
          title: 'Maximum reached',
          description: `You can select up to ${MAX_GENRES} genres`,
          variant: 'destructive',
        });
        return prev;
      }
      return [...prev, genre];
    });
    if (errors.genres) {
      setErrors(prev => ({ ...prev, genres: undefined }));
    }
  };

  const handleUseLocation = () => {
    if (locating) return;
    if (!navigator.geolocation) {
      setErrors(prev => ({ ...prev, location: 'Geolocation is not supported by your browser' }));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setErrors(prev => ({ ...prev, location: undefined }));
        try {
          const params = new URLSearchParams({
            format: 'jsonv2',
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude),
            zoom: '10',
            addressdetails: '1',
          });
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
            headers: { 'Accept-Language': 'en' },
          });
          if (response.ok) {
            const data = await response.json();
            const address = data?.address || {};
            const detectedCity =
              address.city ||
              address.town ||
              address.village ||
              address.hamlet ||
              address.municipality;
            if (detectedCity) {
              setCity(prev => (prev.trim() ? prev : String(detectedCity)));
            }
          }
        } catch {
          // Ignore reverse geocode failures; user can type manually.
        } finally {
          setLocating(false);
        }
      },
      () => {
        setErrors(prev => ({ ...prev, location: 'Unable to access your location. Please enter your city.' }));
        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  };

  const handlePasswordReset = async () => {
    const emailToUse = resetEmail.trim() || email.trim();
    const emailResult = emailSchema.safeParse(emailToUse);
    if (!emailResult.success) {
      setErrors(prev => ({ ...prev, email: emailResult.error.errors[0].message }));
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);

    if (error) {
      toast({
        title: 'Reset failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Check your inbox',
      description: 'We sent a password reset link to your email.',
    });
    setShowReset(false);
  };

  const fillDemoCredentials = () => {
    if (!hasDemoCredentials) return;
    setMode('login');
    setSignupStep('account');
    setShowReset(false);
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrors({});
    toast({
      title: 'Demo account ready',
      description: 'Login still uses Supabase and a real session.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'login') {
      if (!validateLogin()) return;
      
      setLoading(true);
      try {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Login failed',
            description: error.message || 'Invalid email or password',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Welcome back!',
            description: 'Successfully logged in',
          });
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Signup flow
      if (signupStep === 'account' || signupStep === 'genres') {
        handleNextStep();
        return;
      }

      if (!validateStep3()) return;

      setLoading(true);
      try {
        const { error } = await signUp(email, password, name || undefined);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Account exists',
              description: 'This email is already registered. Try logging in instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Signup failed',
              description: error.message,
              variant: 'destructive',
            });
          }
          return;
        }

        if (isDevMode) {
          updateDevProfile({
            name: name.trim() || undefined,
            username: username.trim() || undefined,
            city: city.trim() || undefined,
            latitude,
            longitude,
          });
          setDevGenres(selectedGenres);
          toast({
            title: 'Dev signup complete',
            description: 'Dev session created locally.',
          });
          return;
        }
        // Wait for session then save preferences and profile details
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          toast({
            title: 'Check your email',
            description: 'Confirm your email to finish signup.',
          });
          return;
        }

        if (session.user) {
          const profileUpdates: {
            username?: string;
            city?: string;
            latitude?: number | null;
            longitude?: number | null;
          } = {};

          if (username.trim()) profileUpdates.username = username.trim();
          if (city.trim()) profileUpdates.city = city.trim();
          if (latitude !== null && longitude !== null) {
            profileUpdates.latitude = latitude;
            profileUpdates.longitude = longitude;
          }

          if (Object.keys(profileUpdates).length > 0) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update(profileUpdates)
              .eq('user_id', session.user.id);
            if (profileError) {
              toast({
                title: 'Profile setup failed',
                description: profileError.message,
                variant: 'destructive',
              });
              return;
            }
          }

          const preferences = selectedGenres.map(genre => ({
            user_id: session.user.id,
            genre,
            intensity: 3,
          }));

          if (preferences.length > 0) {
            const { error: preferencesError } = await supabase
              .from('user_preferences')
              .insert(preferences);
            if (preferencesError) {
              toast({
                title: 'Preference setup failed',
                description: preferencesError.message,
                variant: 'destructive',
              });
              return;
            }
          }
        }

        toast({
          title: 'Welcome to RaveCircle!',
          description: 'Your account has been created',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const resetToLogin = () => {
    setMode('login');
    setSignupStep('account');
    setErrors({});
  };

  const logoTapCountRef = useRef(0);
  const logoTapTimeoutRef = useRef<number | null>(null);

  const handleLogoTap = () => {
    if (!import.meta.env.DEV) return;
    logoTapCountRef.current += 1;
    if (logoTapTimeoutRef.current) {
      window.clearTimeout(logoTapTimeoutRef.current);
    }
    logoTapTimeoutRef.current = window.setTimeout(() => {
      logoTapCountRef.current = 0;
    }, 1200);

    if (logoTapCountRef.current >= 7) {
      logoTapCountRef.current = 0;
      if (isDevMode) {
        disableDevMode();
        resetDevSession();
        toast({ title: 'Dev mode disabled' });
      } else {
        enableDevMode();
        toast({ title: 'Dev mode enabled' });
      }
    }
  };
  const resetToSignup = () => {
    setMode('signup');
    setSignupStep('account');
    setErrors({});
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      {/* Animated background */}
      <div className="animated-bg" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 mb-3"
          >
            <img
              src="/icon-512.png"
              alt="RaveCircle"
              className="h-full w-full object-contain"
              draggable={false}
            />
          </motion.div>
          <h1 className="text-3xl font-display font-bold text-gradient">RaveCircle</h1>
          <p className="text-muted-foreground mt-2">Your crew, your events, your vibe</p>
        </div>

        {import.meta.env.DEV && (
          <div className="text-center mb-6">
            <button
              type="button"
              onClick={() => {
                if (isDevMode) {
                  disableDevMode();
                  resetDevSession();
                  toast({ title: 'Dev mode disabled' });
                } else {
                  enableDevMode();
                  toast({ title: 'Dev mode enabled' });
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {isDevMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
            </button>
            {isDevMode && (
              <p className="mt-2 text-xs text-muted-foreground">
                Dev Mode only previews local auth/profile. Use a real demo account for events and crews.
              </p>
            )}
          </div>
        )}
        {/* Auth Card */}
        <div className="card-neon rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
          {hasDemoCredentials && !isDevMode && (
            <Button
              type="button"
              variant="outline"
              className="mb-4 w-full"
              onClick={fillDemoCredentials}
            >
              Use Demo Account
            </Button>
          )}
          {/* Mode Toggle - Only show for step 1 */}
          {(mode === 'login' || signupStep === 'account') && (
            <div className="flex bg-muted rounded-lg p-1 mb-6">
              <button
                onClick={resetToLogin}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-primary text-primary-foreground shadow-neon-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Login
              </button>
              <button
                onClick={resetToSignup}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mode === 'signup'
                    ? 'bg-primary text-primary-foreground shadow-neon-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Step indicator for signup */}
          {mode === 'signup' && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`w-2 h-2 rounded-full transition-all ${signupStep === 'account' ? 'bg-primary w-6' : 'bg-muted-foreground/50'}`} />
              <div className={`w-2 h-2 rounded-full transition-all ${signupStep === 'genres' ? 'bg-primary w-6' : 'bg-muted-foreground/50'}`} />
              <div className={`w-2 h-2 rounded-full transition-all ${signupStep === 'location' ? 'bg-primary w-6' : 'bg-muted-foreground/50'}`} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'login' ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {showReset ? (
                    <>
                      <div>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="pl-10 h-12 bg-muted border-border/50 focus:border-primary input-glow"
                          />
                        </div>
                        {errors.email && (
                          <p className="text-destructive text-xs mt-1">{errors.email}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="neon"
                        className="w-full h-12"
                        onClick={handlePasswordReset}
                        disabled={resetLoading}
                      >
                        {resetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowReset(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Back to login
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-12 bg-muted border-border/50 focus:border-primary input-glow"
                          />
                        </div>
                        {errors.email && (
                          <p className="text-destructive text-xs mt-1">{errors.email}</p>
                        )}
                      </div>

                      <div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 h-12 bg-muted border-border/50 focus:border-primary input-glow"
                          />
                        </div>
                        {errors.password && (
                          <p className="text-destructive text-xs mt-1">{errors.password}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowReset(true);
                          setResetEmail(email);
                          setErrors(prev => ({ ...prev, email: undefined }));
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Forgot password?
                      </button>
                    </>
                  )}
                </motion.div>
              ) : signupStep === 'account' ? (
                <motion.div
                  key="signup-step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 h-12 bg-muted border-border/50 focus:border-primary input-glow"
                      />
                    </div>
                    {errors.name && (
                      <p className="text-destructive text-xs mt-1">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                      <Input
                        type="text"
                        placeholder="username (optional)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="pl-10 h-12 bg-muted border-border/50 focus:border-primary input-glow"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 bg-muted border-border/50 focus:border-primary input-glow"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-destructive text-xs mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 h-12 bg-muted border-border/50 focus:border-primary input-glow"
                      />
                    </div>
                    {errors.password && (
                      <p className="text-destructive text-xs mt-1">{errors.password}</p>
                    )}
                  </div>
                </motion.div>
              ) : signupStep === 'genres' ? (
                <motion.div
                  key="signup-step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/30 to-primary/30 mb-3">
                      <Music className="w-6 h-6 text-secondary" />
                    </div>
                    <h3 className="font-display font-semibold text-lg">What's your vibe?</h3>
                    <p className="text-muted-foreground text-sm">Choose up to 3 genres</p>
                  </div>

                  {/* Selection counter */}
                  <div className="flex justify-center">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedGenres.length === 0 
                        ? 'bg-muted text-muted-foreground' 
                        : selectedGenres.length === MAX_GENRES 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-secondary/20 text-secondary'
                    }`}>
                      <span>{selectedGenres.length} / {MAX_GENRES} selected</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {GENRES.map(genre => (
                      <GenreChip
                        key={genre}
                        genre={genre}
                        isActive={selectedGenres.includes(genre)}
                        onClick={() => toggleGenre(genre)}
                      />
                    ))}
                  </div>

                  {errors.genres && (
                    <p className="text-destructive text-xs text-center">{errors.genres}</p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="signup-step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 mb-3">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-lg">Where are you based?</h3>
                    <p className="text-muted-foreground text-sm">Choose your hometown so we can find events around you.</p>
                  </div>

                  <div>
                    <Input
                      type="text"
                      placeholder="City / Hometown"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (errors.location) {
                          setErrors(prev => ({ ...prev, location: undefined }));
                        }
                      }}
                      className="h-12 bg-muted border-border/50 focus:border-primary input-glow"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseLocation}
                    disabled={locating}
                    className="w-full h-12"
                  >
                    {locating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Use my current location'
                    )}
                  </Button>

                  {(latitude !== null && longitude !== null) && (
                    <p className="text-xs text-muted-foreground text-center">
                      Location saved from your device.
                    </p>
                  )}

                  {errors.location && (
                    <p className="text-destructive text-xs text-center">{errors.location}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              {mode === 'signup' && signupStep !== 'account' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setErrors({});
                    setSignupStep(signupStep === 'genres' ? 'account' : 'genres');
                  }}
                  className="h-12"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              
              <Button
                type="submit"
                disabled={
                  loading ||
                  (mode === 'login' && showReset) ||
                  (mode === 'signup' && signupStep === 'genres' && selectedGenres.length === 0) ||
                  (mode === 'signup' && signupStep === 'location' && !city.trim() && (latitude === null || longitude === null))
                }
                className="flex-1 h-12"
                variant="neon"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : mode === 'login' ? (
                  'Login'
                ) : signupStep === 'account' ? (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : signupStep === 'genres' ? (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Create Account
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
            
            {mode === 'signup' && signupStep === 'genres' && selectedGenres.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Select at least 1 genre to continue
              </p>
            )}
            {mode === 'signup' && signupStep === 'location' && !city.trim() && (latitude === null || longitude === null) && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Enter a city or use your current location to continue
              </p>
            )}
          </form>

          {import.meta.env.DEV && isDevMode && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <button
                type="button"
                onClick={() => {
                  resetDevSession();
                  resetToSignup();
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Reset Dev Session
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}



















