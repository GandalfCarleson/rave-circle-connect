import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Users, Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/feed');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent mb-8 shadow-neon"
        >
          <Zap className="w-12 h-12 text-primary-foreground" />
        </motion.div>

        <h1 className="text-5xl font-display font-bold mb-4">
          <span className="text-gradient">RaveCircle</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Your crew, your events, your vibe
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { icon: Calendar, label: 'Events' },
            { icon: Users, label: 'Crews' },
            { icon: MapPin, label: 'Local' },
          ].map(({ icon: Icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{label}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          <Button
            onClick={() => navigate('/auth')}
            variant="neon"
            size="xl"
            className="w-full"
          >
            Get Started
          </Button>
          <p className="text-xs text-muted-foreground">
            Discover events • Build your crew • Never miss a rave
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
