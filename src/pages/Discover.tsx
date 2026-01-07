import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Users, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GroupCard } from '@/components/GroupCard';
import { EventCard } from '@/components/EventCard';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: string;
  name: string;
  city: string | null;
  is_private: boolean;
  member_count: number;
}

interface Event {
  id: string;
  name: string;
  venue_name: string | null;
  city: string | null;
  start_datetime: string;
  min_price: number | null;
  image_url: string | null;
  event_type: string | null;
  genres: string[];
}

export default function Discover() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<Group[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch open groups
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .eq('is_private', false)
      .limit(5);

    if (groups) {
      const groupsWithCounts = await Promise.all(
        groups.map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          return { ...group, member_count: count || 0 };
        })
      );
      setOpenGroups(groupsWithCounts);
    }

    // Fetch recommended events
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .gte('start_datetime', new Date().toISOString())
      .order('start_datetime', { ascending: true })
      .limit(5);

    if (events) {
      setRecommendedEvents(events);
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-display font-bold">Discover</h1>
          <p className="text-sm text-muted-foreground">Find new crews and events</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Open Groups Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Open Crews</h2>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="card-neon rounded-xl border border-border/50 p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-muted rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : openGroups.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card-neon rounded-xl border border-border/50 p-6 text-center"
            >
              <Compass className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No open crews yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your own crew and make it public!
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {openGroups.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GroupCard
                    id={group.id}
                    name={group.name}
                    city={group.city || undefined}
                    isPrivate={group.is_private}
                    memberCount={group.member_count}
                    onClick={() => navigate(`/groups/${group.id}`)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Recommended Events Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-secondary" />
            <h2 className="font-display font-semibold text-lg">Recommended Events</h2>
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="card-neon rounded-xl border border-border/50 p-4 animate-pulse">
                  <div className="h-48 bg-muted rounded-lg mb-4" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recommendedEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card-neon rounded-xl border border-border/50 p-6 text-center"
            >
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No upcoming events</p>
              <p className="text-xs text-muted-foreground mt-1">
                Events will appear here soon!
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {recommendedEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <EventCard
                    id={event.id}
                    name={event.name}
                    venueName={event.venue_name || undefined}
                    city={event.city || undefined}
                    startDatetime={event.start_datetime}
                    minPrice={event.min_price || undefined}
                    imageUrl={event.image_url || undefined}
                    eventType={event.event_type || undefined}
                    genres={event.genres || []}
                    onView={() => navigate(`/events/${event.id}`)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
