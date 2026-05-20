import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings2, Calendar, Filter, MapPin, Compass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/EventCard';
import { GenreChip } from '@/components/GenreChip';
import { RadiusSlider } from '@/components/RadiusSlider';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GENRES, EVENT_TYPES, DATE_FILTERS, RADIUS_OPTIONS } from '@/lib/constants';
import { fetchEventsWithFallback, type ExternalEvent, ensureSupabaseEvents } from '@/services/externalEventsService';
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

const MemoEventCard = memo(EventCard);

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
  const [loading, setLoading] = useState(true);
  const [expandingSearch, setExpandingSearch] = useState(false);
  const [profile, setProfile] = useState<Profile>({ city: null, radius_km: 100, latitude: null, longitude: null });
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedEventToShare, setSelectedEventToShare] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [matchedEvents, setMatchedEvents] = useState<ExternalEvent[]>([]);
  const [suggestedEvents, setSuggestedEvents] = useState<ExternalEvent[]>([]);
  const [interestedEvents, setInterestedEvents] = useState<Set<string>>(new Set());
  const [pinnedEvents, setPinnedEvents] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(60);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadMoreInFlightRef = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[feed] mounted', {
        authLoading,
        hasUser: Boolean(user),
      });
    }
  }, [authLoading, user]);

  const currentRadiusOption = RADIUS_OPTIONS.find(option => option.value === profile.radius_km) || RADIUS_OPTIONS[0];

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const requestLocation = useCallback(async () => {
    if (!user || !navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    if (!window.isSecureContext) {
      setLocationStatus('denied');
      toast({
        title: 'Location unavailable',
        description: 'Use https:// or localhost to allow browser location access.',
        variant: 'destructive',
      });
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
      (error) => {
        setLocationStatus('denied');
        toast({
          title: 'Location blocked',
          description: error.message || 'Enable location permissions in your browser settings.',
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [toast, user]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('city, radius_km, latitude, longitude')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      const radiusValue = RADIUS_OPTIONS.some(option => option.value === data.radius_km)
        ? data.radius_km
        : RADIUS_OPTIONS[0].value;
      setProfile({ ...data, radius_km: radiusValue });
    }
  }, [user]);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_preferences')
      .select('genre')
      .eq('user_id', user.id);
    
    if (data) {
      setPreferredGenres(data.map(pref => pref.genre));
    }
  }, [user]);

  const fetchEvents = useCallback(async (pageToLoad: number = 0): Promise<string | null> => {
    if (import.meta.env.DEV) {
      console.debug('[feed] fetch start', { page: pageToLoad });
    }
    if (pageToLoad === 0) {
      setLoading(true);
      setExpandingSearch(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const dateFilter = selectedDate === 'this-week'
        ? 'this_week'
        : selectedDate === 'next-week'
          ? 'next_week'
          : selectedDate === 'month'
            ? 'this_month'
            : selectedDate === 'year'
              ? 'this_year'
              : undefined;

      const {
        matchedToTaste,
        suggestedEvents: fallbackEvents,
        page: nextPage,
        hasMore: nextHasMore,
        notice: nextNotice,
      } = await fetchEventsWithFallback({
        city: profile.city || undefined,
        latitude: profile.latitude ?? undefined,
        longitude: profile.longitude ?? undefined,
        radiusKm: profile.radius_km || RADIUS_OPTIONS[0].value,
        preferredGenres,
        dateFilter,
        page: pageToLoad,
        size: 60,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      });
      const refreshedNotice = nextNotice ?? null;

      if (import.meta.env.DEV) {
        console.debug('[feed] fetched', {
          matched: matchedToTaste.length,
          suggested: fallbackEvents.length,
          page: nextPage,
          hasMore: nextHasMore,
        });
      }

      const hydrated = await ensureSupabaseEvents([...matchedToTaste, ...fallbackEvents]);
      const hydratedByExternal = new Map(
        hydrated.map(event => [event.externalId || event.id, event])
      );
      const hydratedMatched = matchedToTaste.map(event =>
        hydratedByExternal.get(event.externalId || event.id) || event
      );
      const hydratedSuggested = fallbackEvents.map(event =>
        hydratedByExternal.get(event.externalId || event.id) || event
      );

      if (import.meta.env.DEV) {
        console.debug('[feed] hydrated', {
          matched: hydratedMatched.length,
          suggested: hydratedSuggested.length,
        });
      }

      if (pageToLoad === 0) {
        setMatchedEvents(hydratedMatched);
        setSuggestedEvents(hydratedSuggested);
        setVisibleCount(60);
        setNotice(refreshedNotice);
      } else {
        setMatchedEvents(prev => Array.from(
          new Map([...prev, ...hydratedMatched].map(event => [event.id, event])).values(),
        ));
        setSuggestedEvents(prev => Array.from(
          new Map([...prev, ...hydratedSuggested].map(event => [event.id, event])).values(),
        ));
        setVisibleCount(prev => prev + hydratedMatched.length + hydratedSuggested.length);
      }

      setPage(nextPage);
      setHasMore(nextHasMore);
      return pageToLoad === 0 ? refreshedNotice : null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[feed] fetch error', error);
      }
      const fallbackNotice = pageToLoad === 0
        ? 'Unable to refresh events right now. Please try again.'
        : null;
      if (pageToLoad === 0) {
        setNotice(fallbackNotice);
      }
      return fallbackNotice;
    } finally {
      loadMoreInFlightRef.current = false;
      setLoading(false);
      setExpandingSearch(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [
    preferredGenres,
    profile.city,
    profile.latitude,
    profile.longitude,
    profile.radius_km,
    selectedDate,
    selectedGenres,
  ]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const refreshedNotice = await fetchEvents(0);
    if (refreshedNotice) {
      toast({ title: refreshedNotice });
    }
  }, [fetchEvents, toast]);

  const fetchEventActions = useCallback(async () => {
    if (!user) return;
    const eventIds = [...matchedEvents, ...suggestedEvents]
      .map(event => event.supabaseId)
      .filter((id): id is string => Boolean(id));

    if (eventIds.length === 0) {
      setInterestedEvents(new Set());
      setPinnedEvents(new Set());
      return;
    }

    const { data: statuses } = await supabase
      .from('user_event_statuses')
      .select('event_id, status')
      .eq('user_id', user.id)
      .in('event_id', eventIds);

    const interestedSet = new Set(
      (statuses || [])
        .filter(status => status.status === 'interested')
        .map(status => status.event_id)
    );
    setInterestedEvents(interestedSet);

    const { data: pins } = await supabase
      .from('user_pinned_events')
      .select('event_id')
      .eq('user_id', user.id)
      .in('event_id', eventIds);

    const pinnedSet = new Set((pins || []).map(pin => pin.event_id));
    setPinnedEvents(pinnedSet);
  }, [matchedEvents, suggestedEvents, user]);

  const ensureEventReady = async (event: ExternalEvent) => {
    if (event.supabaseId) return event;
    const [hydrated] = await ensureSupabaseEvents([event]);
    if (!hydrated) return event;
    const key = hydrated.externalId || hydrated.id;
    setMatchedEvents(prev =>
      prev.map(item => (item.externalId || item.id) === key ? hydrated : item)
    );
    setSuggestedEvents(prev =>
      prev.map(item => (item.externalId || item.id) === key ? hydrated : item)
    );
    return hydrated;
  };

  const viewEventDetails = async (event: ExternalEvent) => {
    const ready = await ensureEventReady(event);
    if (!ready.supabaseId) {
      toast({
        title: 'Unable to open details',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }
    navigate(`/events/${ready.supabaseId}`, {
      state: {
        eventPreview: {
          id: ready.supabaseId,
          name: ready.name,
          description: ready.description ?? null,
          venue_name: ready.venueName ?? null,
          city: ready.city ?? null,
          start_datetime: ready.startDateTime,
          end_datetime: ready.endDateTime ?? null,
          min_price: ready.minPrice ?? null,
          ticket_url: ready.ticketUrl ?? null,
          image_url: ready.imageUrl ?? null,
          event_type: ready.eventType ?? null,
          genres: ready.genres ?? [],
        },
      },
    });
  };

  const fetchUserGroups = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPreferences();
      fetchUserGroups();
    }
  }, [fetchPreferences, fetchProfile, fetchUserGroups, user]);

  useEffect(() => {
    if (user) {
      fetchEvents(0);
    }
  }, [fetchEvents, user]);

  useEffect(() => {
    if (user) {
      fetchEventActions();
    }
  }, [fetchEventActions, user]);

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

  const eventMatchesFilters = (event: ExternalEvent) => {
    // Genre filter
    if (selectedGenres.length > 0 && !event.genres?.some(g => selectedGenres.includes(g))) {
      return false;
    }
    // Type filter
    if (selectedTypes.length > 0 && (!event.eventType || !selectedTypes.includes(event.eventType))) {
      return false;
    }
    return true;
  };

  const getMatchReason = (event: ExternalEvent, matchedByGenre: boolean) => {
    if (matchedByGenre) return 'Matched because of genre';
    if (profile.latitude != null && profile.longitude != null && event.latitude != null && event.longitude != null) {
      return 'Matched because of location/radius';
    }
    return 'Suggested because of date/proximity';
  };

  const filteredMatched = matchedEvents.filter(eventMatchesFilters);
  const filteredSuggested = suggestedEvents.filter(eventMatchesFilters);
  if (import.meta.env.DEV) {
    console.debug('[feed] filtered', {
      matched: filteredMatched.length,
      suggested: filteredSuggested.length,
      dateFilter: selectedDate,
      radius: profile.radius_km,
      selectedGenres,
      selectedTypes,
    });
  }

  const sortedMatched = useMemo(() => {
    const hasCoords = profile.latitude != null && profile.longitude != null;
    const distanceFor = (event: ExternalEvent) => {
      if (!hasCoords || event.latitude == null || event.longitude == null) return null;
      return calculateDistance(profile.latitude!, profile.longitude!, event.latitude, event.longitude);
    };
    return [...filteredMatched].sort((a, b) => {
      const distanceA = distanceFor(a);
      const distanceB = distanceFor(b);
      if (distanceA != null && distanceB != null) {
        return distanceA - distanceB;
      }
      return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
    });
  }, [filteredMatched, profile.latitude, profile.longitude]);

  const sortedSuggested = useMemo(() => {
    const hasCoords = profile.latitude != null && profile.longitude != null;
    const distanceFor = (event: ExternalEvent) => {
      if (!hasCoords || event.latitude == null || event.longitude == null) return null;
      return calculateDistance(profile.latitude!, profile.longitude!, event.latitude, event.longitude);
    };
    return [...filteredSuggested].sort((a, b) => {
      const distanceA = distanceFor(a);
      const distanceB = distanceFor(b);
      if (distanceA != null && distanceB != null) {
        return distanceA - distanceB;
      }
      return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
    });
  }, [filteredSuggested, profile.latitude, profile.longitude]);

  const orderedEvents = useMemo(() => {
    return [...sortedMatched, ...sortedSuggested];
  }, [sortedMatched, sortedSuggested]);

  const visibleEvents = orderedEvents.slice(0, visibleCount);
  const visibleMatched = sortedMatched.filter(event => visibleEvents.includes(event));
  const visibleSuggested = sortedSuggested.filter(event => visibleEvents.includes(event));

  useEffect(() => {
    const handleScroll = () => {
      if (loading || isLoadingMore || loadMoreInFlightRef.current) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 300;
      if (scrollPosition < threshold) return;

      if (visibleCount < orderedEvents.length) {
        setVisibleCount((prev) => Math.min(prev + 20, orderedEvents.length));
        return;
      }

      if (hasMore) {
        loadMoreInFlightRef.current = true;
        fetchEvents(page + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchEvents, hasMore, isLoadingMore, loading, orderedEvents.length, page, visibleCount]);

  const handleShare = (event: ExternalEvent) => {
    ensureEventReady(event).then((ready) => {
      if (!ready.supabaseId) {
        toast({
          title: 'Unable to share',
          description: 'Please try again in a moment.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedEventToShare(ready.supabaseId);
      setSelectedGroupId(null);
      setShareModalOpen(true);
    });
  };

  const toggleInterested = async (event: ExternalEvent) => {
    if (!user) return;
    const ready = await ensureEventReady(event);
    if (!ready.supabaseId) {
      toast({
        title: 'Unable to update',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }
    const isInterested = interestedEvents.has(ready.supabaseId);

    const next = new Set(interestedEvents);
    if (isInterested) {
      next.delete(ready.supabaseId);
      setInterestedEvents(next);
      const { error } = await supabase
        .from('user_event_statuses')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', ready.supabaseId);
      if (error) {
        const reverted = new Set(next);
        reverted.add(ready.supabaseId);
        setInterestedEvents(reverted);
        toast({
          title: 'Could not update',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Interest removed',
        description: 'Event removed from your interests.',
      });
      return;
    }

    next.add(ready.supabaseId);
    setInterestedEvents(next);
    const { error } = await supabase
      .from('user_event_statuses')
      .upsert({
        user_id: user.id,
        event_id: ready.supabaseId,
        status: 'interested',
      }, { onConflict: 'user_id,event_id' });
    if (error) {
      const reverted = new Set(next);
      reverted.delete(ready.supabaseId);
      setInterestedEvents(reverted);
      toast({
        title: 'Could not update',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Interested',
      description: 'Event saved to your interests.',
    });
  };

  const togglePinned = async (event: ExternalEvent) => {
    if (!user) return;
    const ready = await ensureEventReady(event);
    if (!ready.supabaseId) {
      toast({
        title: 'Unable to update',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }
    const isPinned = pinnedEvents.has(ready.supabaseId);

    const next = new Set(pinnedEvents);
    if (isPinned) {
      next.delete(ready.supabaseId);
      setPinnedEvents(next);
      const { error } = await supabase
        .from('user_pinned_events')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', ready.supabaseId);
      if (error) {
        const reverted = new Set(next);
        reverted.add(ready.supabaseId);
        setPinnedEvents(reverted);
        toast({
          title: 'Could not update',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Removed pin',
        description: 'Event removed from saved.',
      });
      return;
    }

    next.add(ready.supabaseId);
    setPinnedEvents(next);
    const { error } = await supabase
      .from('user_pinned_events')
      .insert({
        user_id: user.id,
        event_id: ready.supabaseId,
      });
    if (error) {
      const reverted = new Set(next);
      reverted.delete(ready.supabaseId);
      setPinnedEvents(reverted);
      toast({
        title: 'Could not update',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Pinned',
      description: 'Event saved for later.',
    });
  };

  const shareToGroup = async () => {
    if (!user || !selectedEventToShare) return;
    if (!selectedGroupId) return;

    try {
    const { error } = await supabase
      .from('messages')
      .insert({
        group_id: selectedGroupId,
        user_id: user.id,
        text: null,
        attached_event_id: selectedEventToShare,
        message_type: 'event',
      });

      if (error) throw error;

      const groupName = userGroups.find(group => group.id === selectedGroupId)?.name;
      toast({
        title: 'Sent',
        description: groupName ? `Sent to ${groupName}` : 'Event sent to your crew.',
      });
      
      setShareModalOpen(false);
      setSelectedEventToShare(null);
      setSelectedGroupId(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to share event.';
      toast({
        title: 'Failed to share',
        description: message,
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
    <div className="min-h-screen gradient-bg">
      <AnimatedBackground />
      
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-display font-bold">Feed</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={loading || isRefreshing}
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFiltersOpen(prev => !prev)}
              >
                <Filter className="w-5 h-5" />
              </Button>
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
          </div>

          {/* Location indicator */}
          <button
            type="button"
            onClick={requestLocation}
            className="flex w-full items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
            title="Use current location"
          >
            <MapPin className="w-4 h-4" />
            {profile.city ? (
              <>
                <span className="text-primary font-medium">{profile.city}</span>
                <span>•</span>
                <span>{locationStatus === 'denied' ? 'location not set' : currentRadiusOption.display}</span>
              </>
            ) : (
              <span className="text-primary font-medium">{currentRadiusOption.display}</span>
            )}
            <span className="ml-auto rounded-full border border-border/60 px-2 py-0.5 text-xs text-foreground">
              Use my location
            </span>
          </button>

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
          {notice ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
              {notice}
            </div>
          ) : null}
        </div>
      </div>

      {/* Filter chips */}
      {filtersOpen && (
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
      )}

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
        ) : visibleEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <Compass className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-display font-semibold text-lg mb-2">
              {visibleEvents.length === 0 && selectedGenres.length === 0 && selectedTypes.length === 0 && !selectedDate
                ? 'No events yet'
                : 'No matching events'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-xs mx-auto">
              {visibleEvents.length === 0 && selectedGenres.length === 0 && selectedTypes.length === 0 && !selectedDate
                ? 'Add music genres in your profile and tap Use my location so RaveCircle can match events by taste and radius.'
                : 'Try widening your radius, using your location, or adjusting your filters to discover more events.'}
            </p>
            <div className="flex flex-col gap-2 items-center">
              {visibleEvents.length === 0 && selectedGenres.length === 0 && selectedTypes.length === 0 && !selectedDate ? (
                <Button variant="neon-outline" onClick={requestLocation}>
                  Use my location
                </Button>
              ) : (
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
          <div className="space-y-6">
            {visibleMatched.length > 0 && (
              <div className="space-y-4">
                {visibleMatched.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <MemoEventCard
                      id={event.supabaseId || event.id}
                      name={event.name}
                      venueName={event.venueName || undefined}
                      city={event.city || undefined}
                      startDatetime={event.startDateTime}
                      endDatetime={event.endDateTime || undefined}
                      minPrice={event.minPrice || undefined}
                      imageUrl={event.imageUrl || undefined}
                      eventType={event.eventType || undefined}
                      genres={event.genres || []}
                      source={event.source}
                      lastFmTagged={event.lastFmTagged}
                      matchReason={getMatchReason(event, true)}
                      distance={
                        profile.latitude != null && profile.longitude != null && event.latitude != null && event.longitude != null
                          ? Math.round(calculateDistance(
                              profile.latitude, profile.longitude,
                              event.latitude, event.longitude
                            ))
                          : undefined
                      }
                      onView={() => viewEventDetails(event)}
                      onShare={() => handleShare(event)}
                      onToggleInterested={() => toggleInterested(event)}
                      onTogglePinned={() => togglePinned(event)}
                      isInterested={event.supabaseId ? interestedEvents.has(event.supabaseId) : false}
                      isPinned={event.supabaseId ? pinnedEvents.has(event.supabaseId) : false}
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {visibleSuggested.length > 0 && (
              <div className="space-y-4">
                {visibleMatched.length > 0 && (
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Suggested nearby
                  </div>
                )}
                {visibleSuggested.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <MemoEventCard
                      id={event.supabaseId || event.id}
                      name={event.name}
                      venueName={event.venueName || undefined}
                      city={event.city || undefined}
                      startDatetime={event.startDateTime}
                      endDatetime={event.endDateTime || undefined}
                      minPrice={event.minPrice || undefined}
                      imageUrl={event.imageUrl || undefined}
                      eventType={event.eventType || undefined}
                      genres={event.genres || []}
                      source={event.source}
                      lastFmTagged={event.lastFmTagged}
                      matchReason={getMatchReason(event, false)}
                      distance={
                        profile.latitude != null && profile.longitude != null && event.latitude != null && event.longitude != null
                          ? Math.round(calculateDistance(
                              profile.latitude, profile.longitude,
                              event.latitude, event.longitude
                            ))
                          : undefined
                      }
                      onView={() => viewEventDetails(event)}
                      onShare={() => handleShare(event)}
                      onToggleInterested={() => toggleInterested(event)}
                      onTogglePinned={() => togglePinned(event)}
                      isInterested={event.supabaseId ? interestedEvents.has(event.supabaseId) : false}
                      isPinned={event.supabaseId ? pinnedEvents.has(event.supabaseId) : false}
                    />
                  </motion.div>
                ))}
              </div>
            )}
            {visibleEvents.length < orderedEvents.length && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                {isLoadingMore ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading more events...
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Send to crew</DialogTitle>
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
              <>
                <div className="space-y-2">
                  {userGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`w-full p-3 text-left rounded-lg transition-colors ${
                        selectedGroupId === group.id ? 'bg-primary/15 border border-primary/40' : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <span className="font-medium">{group.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShareModalOpen(false);
                      setSelectedGroupId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="neon"
                    className="flex-1"
                    disabled={!selectedGroupId}
                    onClick={shareToGroup}
                  >
                    Send
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
