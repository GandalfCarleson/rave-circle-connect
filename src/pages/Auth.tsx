import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Loader2, Zap, Music, ChevronRight, ChevronLeft } from 'lucide-react';
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

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; genres?: string }>({});

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    if (validateStep1()) {
      setSignupStep(2);
      setErrors({});
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
      if (signupStep === 1) {
        handleNextStep();
        return;
      }
      
      if (!validateStep2()) return;

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

        // Wait for session then save preferences
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Update profile with username if provided
          if (username.trim()) {
            await supabase
              .from('profiles')
              .update({ username: username.trim() })
              .eq('user_id', session.user.id);
          }

          // Save genre preferences
          const preferences = selectedGenres.map(genre => ({
            user_id: session.user.id,
            genre,
            intensity: 3,
          }));

          if (preferences.length > 0) {
            await supabase
              .from('user_preferences')
              .insert(preferences);
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
    setSignupStep(1);
    setErrors({});
  };

  const resetToSignup = () => {
    setMode('signup');
    setSignupStep(1);
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
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4"
          >
            <Zap className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-3xl font-display font-bold text-gradient">RaveCircle</h1>
          <p className="text-muted-foreground mt-2">Your crew, your events, your vibe</p>
        </div>

        {/* Auth Card */}
        <div className="card-neon rounded-2xl border border-border/50 p-6 backdrop-blur-xl">
          {/* Mode Toggle - Only show for step 1 */}
          {(mode === 'login' || signupStep === 1) && (
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
              <div className={`w-2 h-2 rounded-full transition-all ${signupStep === 1 ? 'bg-primary w-6' : 'bg-muted-foreground/50'}`} />
              <div className={`w-2 h-2 rounded-full transition-all ${signupStep === 2 ? 'bg-primary w-6' : 'bg-muted-foreground/50'}`} />
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
              ) : signupStep === 1 ? (
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
              ) : (
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
                    <p className="text-muted-foreground text-sm">Choose up to 3 genres that define your sound</p>
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
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              {mode === 'signup' && signupStep === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSignupStep(1)}
                  className="h-12"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              
              <Button
                type="submit"
                disabled={loading || (mode === 'signup' && signupStep === 2 && selectedGenres.length === 0)}
                className="flex-1 h-12"
                variant="neon"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : mode === 'login' ? (
                  'Login'
                ) : signupStep === 1 ? (
                  <>
                    Next
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
            
            {mode === 'signup' && signupStep === 2 && selectedGenres.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Select at least 1 genre to continue
              </p>
            )}
          </form>

          {/* Meta OAuth Placeholder */}
          <div className="mt-6 pt-6 border-t border-border/50">
            <Button
              variant="outline"
              disabled
              className="w-full h-12 opacity-50 cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
              Continue with Meta – coming soon
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Facebook & Instagram login coming soon
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}