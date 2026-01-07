import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings2, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/EventCard';
import { GenreChip } from '@/components/GenreChip';
import { RadiusSlider } from '@/components/RadiusSlider';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { GENRES, EVENT_TYPES, DATE_FILTERS } from '@/lib/constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

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

interface Profile {
  city: string | null;
  radius_km: number;
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({ city: null, radius_km: 50 });
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedEventToShare, setSelectedEventToShare] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEvents();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('city, radius_km')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('start_datetime', new Date().toISOString())
      .order('start_datetime', { ascending: true })
      .limit(20);
    
    if (data && !error) {
      setEvents(data);
    }
    setLoading(false);
  };

  const updateRadius = async (radius: number) => {
    if (!user) return;
    setProfile(prev => ({ ...prev, radius_km: radius }));
    await supabase
      .from('profiles')
      .update({ radius_km: radius })
      .eq('user_id', user.id);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const filteredEvents = events.filter(event => {
    if (selectedGenres.length > 0 && !event.genres?.some(g => selectedGenres.includes(g))) {
      return false;
    }
    if (selectedTypes.length > 0 && event.event_type && !selectedTypes.includes(event.event_type)) {
      return false;
    }
    return true;
  });

  const handleShare = (eventId: string) => {
    setSelectedEventToShare(eventId);
    setShareModalOpen(true);
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-display font-bold">Discover Events</h1>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings2 className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card border-border">
                <SheetHeader>
                  <SheetTitle className="font-display">Location Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <RadiusSlider
                    value={profile.radius_km}
                    onChange={updateRadius}
                    city={profile.city || 'Set your city'}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Location indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span className="text-primary font-medium">{profile.city || 'All locations'}</span>
            <span>•</span>
            <span>{profile.radius_km === 0 ? 'Anywhere' : `within ${profile.radius_km} km`}</span>
          </div>

          {/* Date filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {DATE_FILTERS.map(filter => (
              <button
                key={filter.value}
                onClick={() => setSelectedDate(selectedDate === filter.value ? '' : filter.value)}
                className={`genre-chip whitespace-nowrap ${selectedDate === filter.value ? 'active' : ''}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        
        {/* Event types */}
        <div className="flex flex-wrap gap-2 mb-3">
          {EVENT_TYPES.map(type => (
            <GenreChip
              key={type}
              genre={type.charAt(0).toUpperCase() + type.slice(1)}
              isActive={selectedTypes.includes(type)}
              onClick={() => toggleType(type)}
            />
          ))}
        </div>

        {/* Genres */}
        <div className="flex flex-wrap gap-2">
          {GENRES.slice(0, 8).map(genre => (
            <GenreChip
              key={genre}
              genre={genre}
              isActive={selectedGenres.includes(genre)}
              onClick={() => toggleGenre(genre)}
            />
          ))}
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-lg mx-auto px-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-neon rounded-xl border border-border/50 p-4 animate-pulse">
                <div className="h-48 bg-muted rounded-lg mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-display font-semibold text-lg mb-2">No events found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try widening your radius or adjusting filters
            </p>
            <Button variant="neon-outline" onClick={() => {
              setSelectedGenres([]);
              setSelectedTypes([]);
            }}>
              Clear Filters
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event, index) => (
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
                  onShare={() => handleShare(event.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Share to Group</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-sm text-center">
              Select a group to share this event
            </p>
            <div className="mt-4 text-center text-muted-foreground text-sm">
              Join or create a group first!
            </div>
            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={() => {
                setShareModalOpen(false);
                navigate('/groups');
              }}
            >
              Go to Groups
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
