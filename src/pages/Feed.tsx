import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings2, Calendar, Filter, MapPin, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/EventCard';
import { GenreChip } from '@/components/GenreChip';
import { RadiusSlider } from '@/components/RadiusSlider';
import { BottomNav } from '@/components/BottomNav';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GENRES, EVENT_TYPES, DATE_FILTERS } from '@/lib/constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  latitude: number | null;
  longitude: number | null;
}

interface Profile {
  city: string | null;
  radius_km: number;
  latitude: number | null;
  longitude: number | null;
}

interface Group {
  id: string;
  name: string;
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDemoEvents, setAddingDemoEvents] = useState(false);
  const [profile, setProfile] = useState<Profile>({ city: null, radius_km: 50, latitude: null, longitude: null });
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedEventToShare, setSelectedEventToShare] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEvents();
      fetchUserGroups();
      requestLocation();
    }
  }, [user]);

  const requestLocation = useCallback(async () => {
    if (!user || !navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationStatus('granted');
        const { latitude, longitude } = position.coords;
        
        // Update profile with coordinates
        await supabase
          .from('profiles')
          .update({ latitude, longitude })
          .eq('user_id', user.id);
        
        setProfile(prev => ({ ...prev, latitude, longitude }));
      },
      () => {
        setLocationStatus('denied');
      }
    );
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('city, radius_km, latitude, longitude')
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
      .limit(50);
    
    if (data && !error) {
      setEvents(data);
    }
    setLoading(false);
  };

  const fetchUserGroups = async () => {
    if (!user) return;
    
    const { data: memberGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);
    
    if (memberGroups && memberGroups.length > 0) {
      const groupIds = memberGroups.map(m => m.group_id);
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);
      
      if (groups) {
        setUserGroups(groups);
      }
    }
  };

  const addDemoEvents = async () => {
    setAddingDemoEvents(true);
    
    const demoEvents = [
      {
        name: 'Berghain Anniversary',
        description: 'The legendary club celebrates another year of pure techno.',
        venue_name: 'Berghain',
        city: 'Berlin',
        latitude: 52.5112,
        longitude: 13.4418,
        start_datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        end_datetime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 20,
        event_type: 'club' as const,
        genres: ['Techno', 'Industrial'],
        image_url: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800',
      },
      {
        name: 'Awakenings Festival',
        description: 'Europe\'s premier techno festival returns.',
        venue_name: 'Spaarnwoude',
        city: 'Amsterdam',
        latitude: 52.4211,
        longitude: 4.7022,
        start_datetime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        end_datetime: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 85,
        event_type: 'festival' as const,
        genres: ['Techno', 'House'],
        image_url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
      },
      {
        name: 'Movement Detroit',
        description: 'The birthplace of techno hosts its annual celebration.',
        venue_name: 'Hart Plaza',
        city: 'Detroit',
        latitude: 42.3286,
        longitude: -83.0450,
        start_datetime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_datetime: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 150,
        event_type: 'festival' as const,
        genres: ['Techno', 'House', 'EDM'],
        image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
      },
      {
        name: 'Warehouse Rave',
        description: 'Underground techno in a secret Stockholm location.',
        venue_name: 'Secret Location',
        city: 'Stockholm',
        latitude: 59.3293,
        longitude: 18.0686,
        start_datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 25,
        event_type: 'rave' as const,
        genres: ['Techno', 'Trance'],
        image_url: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800',
      },
      {
        name: 'Drum & Bass Arena',
        description: 'The best DnB DJs under one roof.',
        venue_name: 'Fabrik',
        city: 'Madrid',
        latitude: 40.4168,
        longitude: -3.7038,
        start_datetime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 30,
        event_type: 'club' as const,
        genres: ['Drum & Bass'],
        image_url: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800',
      },
      {
        name: 'Tomorrowland Winter',
        description: 'EDM meets the French Alps.',
        venue_name: 'Alpe d\'Huez',
        city: 'Alpe d\'Huez',
        latitude: 45.0911,
        longitude: 6.0693,
        start_datetime: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        end_datetime: new Date(Date.now() + 52 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 350,
        event_type: 'festival' as const,
        genres: ['EDM', 'House', 'Trance'],
        image_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800',
      },
      {
        name: 'Defqon.1',
        description: 'The world\'s largest hardstyle festival.',
        venue_name: 'Evenemententerrein',
        city: 'Biddinghuizen',
        latitude: 52.4538,
        longitude: 5.7050,
        start_datetime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        end_datetime: new Date(Date.now() + 63 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 200,
        event_type: 'festival' as const,
        genres: ['Hardstyle'],
        image_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
      },
      {
        name: 'Charlotte de Witte Live',
        description: 'Belgian techno queen performs an extended set.',
        venue_name: 'Printworks',
        city: 'London',
        latitude: 51.5074,
        longitude: -0.1278,
        start_datetime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        min_price: 45,
        event_type: 'concert' as const,
        genres: ['Techno'],
        image_url: 'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=800',
      },
    ];

    try {
      const { error } = await supabase
        .from('events')
        .insert(demoEvents);
      
      if (error) throw error;
      
      toast({
        title: 'Demo events added!',
        description: `${demoEvents.length} events are now in your feed`,
      });
      
      fetchEvents();
    } catch (error: any) {
      toast({
        title: 'Failed to add events',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAddingDemoEvents(false);
    }
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
    // Genre filter
    if (selectedGenres.length > 0 && !event.genres?.some(g => selectedGenres.includes(g))) {
      return false;
    }
    // Type filter
    if (selectedTypes.length > 0 && event.event_type && !selectedTypes.includes(event.event_type)) {
      return false;
    }
    // Distance filter - only if user has location and radius is set
    if (profile.latitude && profile.longitude && profile.radius_km > 0 && event.latitude && event.longitude) {
      const distance = calculateDistance(
        profile.latitude, profile.longitude,
        event.latitude, event.longitude
      );
      if (distance > profile.radius_km) {
        return false;
      }
    }
    return true;
  });

  const handleShare = (eventId: string) => {
    setSelectedEventToShare(eventId);
    setShareModalOpen(true);
  };

  const shareToGroup = async (groupId: string) => {
    if (!user || !selectedEventToShare) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          user_id: user.id,
          text: 'Check out this event! 🎉',
          attached_event_id: selectedEventToShare,
        });

      if (error) throw error;

      toast({
        title: 'Shared!',
        description: 'Event shared to your crew',
      });
      
      setShareModalOpen(false);
      setSelectedEventToShare(null);
    } catch (error: any) {
      toast({
        title: 'Failed to share',
        description: error.message,
        variant: 'destructive',
      });
    }
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
      <AnimatedBackground />
      
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
                  {locationStatus === 'denied' && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Location access denied. Enable location in your browser to filter by distance.
                    </p>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Location indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <MapPin className="w-4 h-4" />
            <span className="text-primary font-medium">{profile.city || 'All locations'}</span>
            <span>•</span>
            <span>
              {locationStatus === 'denied' 
                ? 'location not set' 
                : profile.radius_km === 0 
                  ? 'Anywhere' 
                  : `within ${profile.radius_km} km`}
            </span>
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
      <div className="max-w-lg mx-auto px-4 py-4 relative z-10">
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
      <div className="max-w-lg mx-auto px-4 relative z-10">
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
              {events.length === 0 
                ? 'Add some demo events to get started' 
                : 'Try widening your radius or adjusting filters'}
            </p>
            <div className="flex flex-col gap-2 items-center">
              {events.length === 0 && (
                <Button 
                  variant="neon" 
                  onClick={addDemoEvents}
                  disabled={addingDemoEvents}
                >
                  {addingDemoEvents ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Demo Events
                    </>
                  )}
                </Button>
              )}
              {events.length > 0 && (
                <Button variant="neon-outline" onClick={() => {
                  setSelectedGenres([]);
                  setSelectedTypes([]);
                }}>
                  Clear Filters
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
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
                  distance={
                    profile.latitude && profile.longitude && event.latitude && event.longitude
                      ? Math.round(calculateDistance(
                          profile.latitude, profile.longitude,
                          event.latitude, event.longitude
                        ))
                      : undefined
                  }
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
            <DialogTitle className="font-display">Share to Crew</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {userGroups.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm text-center">
                  You haven't joined any crews yet
                </p>
                <Button
                  className="w-full mt-4"
                  variant="neon"
                  onClick={() => {
                    setShareModalOpen(false);
                    navigate('/groups');
                  }}
                >
                  Create a Crew
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                {userGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => shareToGroup(group.id)}
                    className="w-full p-3 text-left rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  >
                    <span className="font-medium">{group.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}