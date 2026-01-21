import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const NO_TABS_PREFIXES = ['/auth'];
const NO_TABS_ROUTES = new Set(['/']);

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const hideForRoute = NO_TABS_PREFIXES.some(prefix => location.pathname.startsWith(prefix));
  const hideForExactRoute = NO_TABS_ROUTES.has(location.pathname);
  const showBottomNav = !hideForRoute && !hideForExactRoute;

  useEffect(() => {
    if (!user) return;
    supabase.rpc('cleanup_retracted_messages', { p_limit: 100 });
  }, [user]);

  return (
    <div className="app-shell">
      <div className={cn('app-shell__content', showBottomNav && 'app-shell__content--with-nav')}>
        <Outlet />
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
