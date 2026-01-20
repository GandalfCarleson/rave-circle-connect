import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { EventCard } from '@/components/EventCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { resolveEventsBySupabaseIds } from '@/services/eventResolver';
import type { ExternalEvent } from '@/services/externalEventsService';

export default function SavedEvents() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSavedEvents();
    }
  }, [user]);

  const fetchSavedEvents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_pinned_events')
      .select('event_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const eventIds = (data || []).map((row) => row.event_id);
    if (eventIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const resolved = await resolveEventsBySupabaseIds(eventIds);
    setEvents(resolved);
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <AnimatedBackground />
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-display font-bold">Saved events</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 relative z-10">
        {events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No saved events yet — pin events from the feed to find them here.</p>
          </div>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.externalId || event.id}
              id={event.id}
              name={event.name}
              venueName={event.venueName}
              city={event.city}
              startDatetime={event.startDateTime}
              endDatetime={event.endDateTime}
              minPrice={event.minPrice}
              imageUrl={event.imageUrl}
              eventType={event.eventType}
              genres={event.genres}
              onView={() => event.supabaseId && navigate(`/events/${event.supabaseId}`)}
            />
          ))
        )}
      </div>

    </div>
  );
}
