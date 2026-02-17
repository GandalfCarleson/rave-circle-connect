import { supabase } from '@/integrations/supabase/client';
import type { ExternalEvent } from '@/services/externalEventsService';

type EventRow = {
  id: string;
  external_id: string | null;
  source: string | null;
  name: string;
  description: string | null;
  city: string | null;
  venue_name: string | null;
  start_datetime: string;
  end_datetime: string | null;
  latitude: number | null;
  longitude: number | null;
  min_price: number | null;
  image_url: string | null;
  event_type: string | null;
  genres: string[] | null;
};

export async function getCrewMemberCount(crewId: string) {
  const { count } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', crewId);
  return count || 0;
}

export async function getCrewEventPinCounts(crewId: string, eventIds: string[]) {
  if (eventIds.length === 0) return {};
  const uniqueIds = Array.from(new Set(eventIds));
  const { data } = await supabase
    .from('crew_event_pins')
    .select('event_id')
    .eq('crew_id', crewId)
    .in('event_id', uniqueIds);

  const counts: Record<string, number> = {};
  (data || []).forEach((row) => {
    counts[row.event_id] = (counts[row.event_id] || 0) + 1;
  });
  return counts;
}

export async function getCrewEventPinsForUser(crewId: string, eventIds: string[], userId: string) {
  if (eventIds.length === 0) return new Set<string>();
  const uniqueIds = Array.from(new Set(eventIds));
  const { data } = await supabase
    .from('crew_event_pins')
    .select('event_id')
    .eq('crew_id', crewId)
    .eq('user_id', userId)
    .in('event_id', uniqueIds);

  return new Set((data || []).map((row) => row.event_id));
}

export async function pinCrewEvent(crewId: string, eventId: string, userId: string) {
  return supabase
    .from('crew_event_pins')
    .insert({
      crew_id: crewId,
      event_id: eventId,
      user_id: userId,
    });
}

export async function unpinCrewEvent(crewId: string, eventId: string, userId: string) {
  return supabase
    .from('crew_event_pins')
    .delete()
    .eq('crew_id', crewId)
    .eq('event_id', eventId)
    .eq('user_id', userId);
}

export async function getCrewPinnedEvents(crewId: string, requiredPins: number) {
  const { data: pins } = await supabase
    .from('crew_event_pins')
    .select('event_id')
    .eq('crew_id', crewId);

  const counts: Record<string, number> = {};
  (pins || []).forEach((row) => {
    counts[row.event_id] = (counts[row.event_id] || 0) + 1;
  });

  const eligibleIds = Object.entries(counts)
    .filter(([, count]) => count >= requiredPins)
    .map(([eventId]) => eventId);

  if (eligibleIds.length === 0) return [];

  const { data } = await supabase
    .from('events')
    .select('id, external_id, name, description, city, venue_name, start_datetime, end_datetime, latitude, longitude, min_price, image_url, event_type, genres, source')
    .in('id', eligibleIds);

  if (!data) return [];

  return (data as EventRow[])
    .map((event) => {
      const mapped: ExternalEvent = {
        id: event.external_id ?? event.id,
        supabaseId: event.id,
        externalId: event.external_id ?? event.id,
        name: event.name,
        description: event.description ?? undefined,
        city: event.city ?? undefined,
        venueName: event.venue_name ?? undefined,
        startDateTime: event.start_datetime,
        endDateTime: event.end_datetime ?? undefined,
        latitude: event.latitude ?? undefined,
        longitude: event.longitude ?? undefined,
        minPrice: event.min_price ?? undefined,
        imageUrl: event.image_url ?? undefined,
        eventType: event.event_type ?? undefined,
        genres: event.genres ?? undefined,
        source: event.source ?? undefined,
      };
      return mapped;
    })
    .filter(Boolean) as ExternalEvent[];
}

export async function removeCrewEventFromCrew(crewId: string, eventId: string) {
  await supabase
    .from('crew_event_pins')
    .delete()
    .eq('crew_id', crewId)
    .eq('event_id', eventId);

  await supabase
    .from('crew_events')
    .delete()
    .eq('crew_id', crewId)
    .eq('event_id', eventId);
}

