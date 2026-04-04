import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Users, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GroupCard } from '@/components/GroupCard';
import { EventCard } from '@/components/EventCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { fetchEventsWithFallback, type ExternalEvent, ensureSupabaseEvents } from '@/services/externalEventsService';
import { resolveEventsBySupabaseIds } from '@/services/eventResolver';
import { RADIUS_OPTIONS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Group {
  id: string;
  name: string;
  city: string | null;
  is_private: boolean;
  member_count: number;
}

interface Profile {
  city: string | null;
  radius_km: number;
  latitude: number | null;
  longitude: number | null;
}

const MemoEventCard = memo(EventCard);

export default function Discover() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [openGroups, setOpenGroups] = useState<Group[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<ExternalEvent[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<ExternalEvent[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedEventToShare, setSelectedEventToShare] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [interestedEvents, setInterestedEvents] = useState<Set<string>>(new Set());
  const [pinnedEvents, setPinnedEvents] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<Profile>({ city: null, radius_km: 100, latitude: null, longitude: null });
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(60);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadMoreInFlightRef = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[discover] mounted', {
        authLoading,
        hasUser: Boolean(user),
      });
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchTrendingEvents = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('crew_event_pins')
      .select('event_id')
      .gte('created_at', since);

    const counts: Record<string, number> = {};
    (data || []).forEach((row) => {
      counts[row.event_id] = (counts[row.event_id] || 0) + 1;
    });
    const eventIds = Object.keys(counts);
    if (eventIds.length === 0) {
      setTrendingEvents([]);
      setLoadingTrending(false);
      return;
    }

    const resolved = await resolveEventsBySupabaseIds(eventIds);
    const sorted = resolved.sort((a, b) => {
      const aCount = a.supabaseId ? counts[a.supabaseId] || 0 : 0;
      const bCount = b.supabaseId ? counts[b.supabaseId] || 0 : 0;
      return bCount - aCount;
    });
    setTrendingEvents(sorted);
    setLoadingTrending(false);
  }, []);

  const fetchRecommendedEvents = useCallback(async (
    pageToLoad: number,
    profileSnapshot: Profile,
    preferencesSnapshot: string[],
    append: boolean,
  ): Promise<string | null> => {
    if (import.meta.env.DEV) {
      console.debug('[discover] fetch start', { page: pageToLoad });
    }
    try {
      const {
        matchedToTaste,
        suggestedEvents,
        page: nextPage,
        hasMore: nextHasMore,
        notice: nextNotice,
      } = await fetchEventsWithFallback({
        city: profileSnapshot.city || undefined,
        latitude: profileSnapshot.latitude ?? undefined,
        longitude: profileSnapshot.longitude ?? undefined,
        radiusKm: profileSnapshot.radius_km || RADIUS_OPTIONS[0].value,
        preferredGenres: preferencesSnapshot,
        page: pageToLoad,
        size: 60,
      });

      if (import.meta.env.DEV) {
        console.debug('[discover] fetched', {
          matched: matchedToTaste.length,
          suggested: suggestedEvents.length,
          page: nextPage,
          hasMore: nextHasMore,
        });
      }

      const hydrated = await ensureSupabaseEvents([...matchedToTaste, ...suggestedEvents]);
      const hydratedByExternal = new Map(
        hydrated.map(event => [event.externalId || event.id, event])
      );
      const hydratedMatched = matchedToTaste.map(event =>
        hydratedByExternal.get(event.externalId || event.id) || event
      );
      const hydratedSuggested = suggestedEvents.map(event =>
        hydratedByExternal.get(event.externalId || event.id) || event
      );

      if (import.meta.env.DEV) {
        console.debug('[discover] hydrated', {
          matched: hydratedMatched.length,
          suggested: hydratedSuggested.length,
        });
      }

      const combined = hydratedMatched.length > 0
        ? [...hydratedMatched, ...hydratedSuggested]
        : hydratedSuggested;

      if (append) {
        setRecommendedEvents(prev => Array.from(
          new Map([...prev, ...combined].map((event) => [event.id, event])).values(),
        ));
        setVisibleCount(prev => prev + combined.length);
      } else {
        setRecommendedEvents(combined);
        setVisibleCount(60);
        setNotice(nextNotice ?? null);
      }
      setPage(nextPage);
      setHasMore(nextHasMore);
      return append ? null : (nextNotice ?? null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[discover] fetch error', error);
      }
      const fallbackNotice = 'Unable to refresh events right now. Please try again.';
      if (!append) {
        setNotice(fallbackNotice);
      }
      return append ? null : fallbackNotice;
    } finally {
      loadMoreInFlightRef.current = false;
    }
  }, []);

  const fetchData = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setLoadingTrending(true);
    setIsRefreshing(true);
    try {
      let currentProfile: Profile = {
        city: null,
        radius_km: RADIUS_OPTIONS[0].value,
        latitude: null,
        longitude: null,
      };
      let currentPreferences: string[] = [];
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('city, radius_km, latitude, longitude')
          .eq('user_id', user.id)
          .single();
        
        if (profileData) {
          const radiusValue = RADIUS_OPTIONS.some(option => option.value === profileData.radius_km)
            ? profileData.radius_km
            : RADIUS_OPTIONS[0].value;
          const nextProfile = { ...profileData, radius_km: radiusValue };
          setProfile(nextProfile);
          currentProfile = nextProfile;
        }

        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('genre')
          .eq('user_id', user.id);
        
        if (preferences) {
          currentPreferences = preferences.map(pref => pref.genre);
          setPreferredGenres(currentPreferences);
        }
      }

      if (user) {
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
      }

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

      const refreshedNotice = await fetchRecommendedEvents(0, currentProfile, currentPreferences, false);

      await fetchTrendingEvents();
      setLoading(false);
      return refreshedNotice;
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchRecommendedEvents, fetchTrendingEvents, user]);

  const handleRefresh = useCallback(async () => {
    const refreshedNotice = await fetchData();
    if (refreshedNotice) {
      toast({ title: refreshedNotice });
    }
  }, [fetchData, toast]);

  const sortedEvents = useMemo(() => {
    const hasCoords = profile.latitude != null && profile.longitude != null;
    const distanceFor = (event: ExternalEvent) => {
      if (!hasCoords || event.latitude == null || event.longitude == null) return null;
      const R = 6371;
      const dLat = (event.latitude - profile.latitude!) * Math.PI / 180;
      const dLon = (event.longitude - profile.longitude!) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(profile.latitude! * Math.PI / 180) * Math.cos(event.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return distance;
    };

    return [...recommendedEvents].sort((a, b) => {
      const distanceA = distanceFor(a);
      const distanceB = distanceFor(b);
      if (distanceA != null && distanceB != null) {
        return distanceA - distanceB;
      }
      return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
    });
  }, [recommendedEvents, profile.latitude, profile.longitude]);

  const visibleEvents = sortedEvents.slice(0, visibleCount);

  useEffect(() => {
    const handleScroll = () => {
      if (loading || isLoadingMore || loadMoreInFlightRef.current) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 300;
      if (scrollPosition < threshold) return;

      if (visibleCount < sortedEvents.length) {
        setVisibleCount((prev) => Math.min(prev + 20, sortedEvents.length));
        return;
      }

      if (hasMore) {
        loadMoreInFlightRef.current = true;
        setIsLoadingMore(true);
        fetchRecommendedEvents(page + 1, profile, preferredGenres, true)
          .finally(() => setIsLoadingMore(false));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchRecommendedEvents, hasMore, isLoadingMore, loading, page, preferredGenres, profile, sortedEvents.length, visibleCount]);

  const fetchEventActions = useCallback(async () => {
    if (!user) return;
    const eventIds = recommendedEvents
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
  }, [recommendedEvents, user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  useEffect(() => {
    if (user) {
      fetchEventActions();
    }
  }, [fetchEventActions, user]);

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
      });
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

  const shareToGroup = async () => {
    if (!user || !selectedEventToShare) return;
    if (!selectedGroupId) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        group_id: selectedGroupId,
        user_id: user.id,
        text: null,
        attached_event_id: selectedEventToShare,
        message_type: 'event',
      });

    if (!error) {
      setShareModalOpen(false);
      setSelectedEventToShare(null);
      const groupName = userGroups.find(group => group.id === selectedGroupId)?.name;
      toast({
        title: 'Sent',
        description: groupName ? `Sent to ${groupName}` : 'Event sent to your crew.',
      });
      setSelectedGroupId(null);
    } else {
      toast({
        title: 'Failed to share',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const ensureEventReady = async (event: ExternalEvent) => {
    if (event.supabaseId) return event;
    const [hydrated] = await ensureSupabaseEvents([event]);
    if (!hydrated) return event;
    const key = hydrated.externalId || hydrated.id;
    setRecommendedEvents(prev =>
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
    navigate(`/events/${ready.supabaseId}`);
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
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="mb-1 flex items-center justify-between">
            <h1 className="text-xl font-display font-bold">Discover</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Find new crews and events</p>
          {notice ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
              {notice}
            </div>
          ) : null}
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

        {/* Trending Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Trending in your radius</h2>
          </div>

          {loadingTrending ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="card-neon rounded-xl border border-border/50 p-4 animate-pulse">
                  <div className="h-48 bg-muted rounded-lg mb-4" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : trendingEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card-neon rounded-xl border border-border/50 p-6 text-center"
            >
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No trending events yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pins from crew chats will surface here.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {trendingEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <MemoEventCard
                    id={event.id}
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
          ) : visibleEvents.length === 0 ? (
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
              {visibleEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <MemoEventCard
                    id={event.id}
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
                    onView={() => viewEventDetails(event)}
                    onShare={() => handleShare(event)}
                    onToggleInterested={() => toggleInterested(event)}
                    onTogglePinned={() => togglePinned(event)}
                    isInterested={event.supabaseId ? interestedEvents.has(event.supabaseId) : false}
                    isPinned={event.supabaseId ? pinnedEvents.has(event.supabaseId) : false}
                  />
                </motion.div>
              ))}
              {visibleEvents.length < sortedEvents.length && (
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
        </section>
      </div>

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
