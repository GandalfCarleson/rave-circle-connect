import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseEvents, getMockEventsById, type ExternalEvent } from '@/services/externalEventsService';

const cacheByExternalId = new Map<string, ExternalEvent>();
const cacheBySupabaseId = new Map<string, ExternalEvent>();

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

const toExternalEvent = (row: EventRow): ExternalEvent => ({
  id: row.external_id ?? row.id,
  supabaseId: row.id,
  externalId: row.external_id ?? row.id,
  name: row.name,
  description: row.description ?? undefined,
  city: row.city ?? undefined,
  venueName: row.venue_name ?? undefined,
  startDateTime: row.start_datetime,
  endDateTime: row.end_datetime ?? undefined,
  latitude: row.latitude ?? undefined,
  longitude: row.longitude ?? undefined,
  minPrice: row.min_price ?? undefined,
  imageUrl: row.image_url ?? undefined,
  eventType: row.event_type ?? undefined,
  genres: row.genres ?? undefined,
  source: row.source ?? undefined,
});

const cacheEvent = (event: ExternalEvent) => {
  const externalId = event.externalId || event.id;
  cacheByExternalId.set(externalId, event);
  if (event.supabaseId) {
    cacheBySupabaseId.set(event.supabaseId, event);
  }
};

export async function resolveEventsBySupabaseIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  const missing = uniqueIds.filter(id => !cacheBySupabaseId.has(id));

  if (missing.length > 0) {
    const { data } = await supabase
      .from('events')
      .select('id, external_id, source, name, description, city, venue_name, start_datetime, end_datetime, latitude, longitude, min_price, image_url, event_type, genres')
      .in('id', missing);

    (data || []).forEach((row) => {
      cacheEvent(toExternalEvent(row));
    });
  }

  return ids
    .map(id => cacheBySupabaseId.get(id))
    .filter(Boolean) as ExternalEvent[];
}

export async function resolveEventsByExternalIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  const missing = uniqueIds.filter(id => !cacheByExternalId.has(id));

  if (missing.length > 0) {
    const { data } = await supabase
      .from('events')
      .select('id, external_id, source, name, description, city, venue_name, start_datetime, end_datetime, latitude, longitude, min_price, image_url, event_type, genres')
      .in('external_id', missing);

    (data || []).forEach((row) => {
      cacheEvent(toExternalEvent(row));
    });
  }

  const stillMissing = uniqueIds.filter(id => !cacheByExternalId.has(id));
  if (stillMissing.length > 0) {
    const mockEvents = getMockEventsById(stillMissing);
    if (mockEvents.length > 0) {
      const hydrated = await ensureSupabaseEvents(mockEvents);
      hydrated.forEach(cacheEvent);
    }
  }

  return ids
    .map(id => cacheByExternalId.get(id))
    .filter(Boolean) as ExternalEvent[];
}
