import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DEV_MODE_LIMITED_DESCRIPTION, DEV_MODE_LIMITED_TITLE } from '@/lib/demoMode';

const NO_TABS_PREFIXES = ['/auth'];
const NO_TABS_ROUTES = new Set(['/']);

export function AppShell() {
  const { user, isDevMode } = useAuth();
  const location = useLocation();
  const hideForRoute = NO_TABS_PREFIXES.some(prefix => location.pathname.startsWith(prefix));
  const hideForExactRoute = NO_TABS_ROUTES.has(location.pathname);
  const showBottomNav = !hideForRoute && !hideForExactRoute;

  useEffect(() => {
    if (!user || isDevMode) return;
    supabase.rpc('cleanup_retracted_messages', { p_limit: 100 });
  }, [isDevMode, user]);

  return (
    <div className="app-shell">
      <div className={cn('app-shell__content', showBottomNav && 'app-shell__content--with-nav')}>
        {isDevMode && (
          <div className="border-b border-border/60 bg-muted/80 px-4 py-2 text-center text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{DEV_MODE_LIMITED_TITLE}.</span>{' '}
            {DEV_MODE_LIMITED_DESCRIPTION}
          </div>
        )}
        <Outlet />
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
