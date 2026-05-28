import { fetchAggregatedEvents, type AggregatedEvent } from '@/api/events/aggregate';
import { curatedEvents, type CuratedEvent } from '@/data/curatedEvents';
import { supabase } from '@/integrations/supabase/client';
import { isRaveCircleRelevantEvent } from '@/lib/eventFiltering';
import type { Enums, TablesInsert } from '@/integrations/supabase/types';

type DateFilter = 'this_week' | 'next_week' | 'this_month' | 'this_year';
type EventType = Enums<'event_type'>;
type EventsInsert = TablesInsert<'events'>;

export type ExternalEvent = {
  id: string;
  supabaseId?: string;
  externalId?: string;
  name: string;
  description?: string;
  city?: string;
  venueName?: string;
  startDateTime: string;
  endDateTime?: string;
  latitude?: number;
  longitude?: number;
  minPrice?: number;
  ticketUrl?: string;
  imageUrl?: string;
  eventType?: string;
  genres?: string[];
  source?: string;
  sourceUrl?: string;
  country?: string;
  isCurated?: boolean;
  electronicScore?: number;
  lastFmTagged?: boolean;
};

const PRIORITY_CITIES = [
  'Malm\u00F6',
  'Stockholm',
  'Gothenburg',
  'Copenhagen',
  'Oslo',
  'Helsinki',
  'Berlin',
  'Munich',
  'Frankfurt',
  'Amsterdam',
  'Rotterdam',
  'Prague',
] as const;

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Malm\u00F6': { lat: 55.605, lng: 13.0038 },
  Malmo: { lat: 55.605, lng: 13.0038 },
  Stockholm: { lat: 59.3293, lng: 18.0686 },
  Gothenburg: { lat: 57.7089, lng: 11.9746 },
  Copenhagen: { lat: 55.6761, lng: 12.5683 },
  Oslo: { lat: 59.9139, lng: 10.7522 },
  Helsinki: { lat: 60.1699, lng: 24.9384 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Munich: { lat: 48.1351, lng: 11.582 },
  Frankfurt: { lat: 50.1109, lng: 8.6821 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Rotterdam: { lat: 51.9244, lng: 4.4777 },
  Prague: { lat: 50.0755, lng: 14.4378 },
  Hilvarenbeek: { lat: 51.4858, lng: 5.1378 },
  Biddinghuizen: { lat: 52.455, lng: 5.6931 },
  Oisterwijk: { lat: 51.5792, lng: 5.1889 },
  Uppsala: { lat: 59.8586, lng: 17.6389 },
  Utrecht: { lat: 52.0907, lng: 5.1214 },
  Cologne: { lat: 50.9375, lng: 6.9603 },
  Antwerp: { lat: 51.2194, lng: 4.4025 },
  Veggli: { lat: 60.041, lng: 9.15 },
  Lapland: { lat: 66.166, lng: 29.151 },
  Turku: { lat: 60.4518, lng: 22.2666 },
  Weeze: { lat: 51.6026, lng: 6.1423 },
  Kastellaun: { lat: 50.0692, lng: 7.4411 },
  Saalburg: { lat: 50.5003, lng: 11.7337 },
  Boom: { lat: 51.0876, lng: 4.3669 },
  Essen: { lat: 51.4556, lng: 7.0116 },
};

const MAX_FALLBACK_CITIES = 3;
const UPSERT_COOLDOWN_SUCCESS_MS = 10 * 60 * 1000;
const UPSERT_COOLDOWN_FAILURE_MS = 60 * 1000;
const upsertCooldownByExternalId = new Map<string, number>();

const resolveCoords = (city?: string, latitude?: number, longitude?: number) => {
  if (latitude != null && longitude != null) {
    return { lat: latitude, lng: longitude };
  }
  if (city && CITY_COORDS[city]) {
    return CITY_COORDS[city];
  }
  return CITY_COORDS['Malm\u00F6'];
};

const ensureExternalId = (event: ExternalEvent) => ({
  ...event,
  externalId: event.externalId || event.id,
});

export function getMockEventsById(_ids: string[]) {
  return [] as ExternalEvent[];
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const endOfDay = (date: Date) => new Date(startOfDay(date).getTime() + 24 * 60 * 60 * 1000 - 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
const endOfYear = (date: Date) => new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

const formatDateTime = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function getDateRange(filter?: DateFilter) {
  if (!filter) return null;
  const now = new Date();
  if (filter === 'this_month') {
    return { start: startOfDay(now), end: endOfMonth(now) };
  }
  if (filter === 'this_year') {
    return { start: startOfDay(now), end: endOfYear(now) };
  }
  const day = now.getDay(); // 0 = Sunday
  const startOfWeek = addDays(startOfDay(now), -day);
  const endOfWeek = addDays(startOfWeek, 6);
  if (filter === 'this_week') {
    return { start: startOfWeek, end: endOfDay(endOfWeek) };
  }
  const nextWeekStart = addDays(startOfWeek, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  return { start: nextWeekStart, end: endOfDay(nextWeekEnd) };
}

function matchesDateFilter(event: ExternalEvent, filter?: DateFilter) {
  const range = getDateRange(filter);
  if (!range) return true;
  const start = new Date(event.startDateTime);
  return start >= range.start && start <= range.end;
}

function matchesTaste(event: ExternalEvent, preferredGenres: string[]) {
  if (preferredGenres.length === 0) return false;
  const normalizedPrefs = preferredGenres.map(g => g.toLowerCase());
  const eventGenres = (event.genres || []).map(g => g.toLowerCase());
  if (eventGenres.some(g => normalizedPrefs.includes(g))) return true;
  const haystack = `${event.name} ${event.description || ''}`.toLowerCase();
  return normalizedPrefs.some(genre => haystack.includes(genre));
}

function matchesGenreFilter(event: ExternalEvent, genres?: string[]) {
  if (!genres || genres.length === 0) return true;
  const normalizedFilter = genres.map(genre => genre.toLowerCase());
  return (event.genres || []).some(genre => normalizedFilter.includes(genre.toLowerCase()));
}

function toCuratedExternalEvent(event: CuratedEvent): ExternalEvent {
  const coords = event.latitude != null && event.longitude != null
    ? { lat: event.latitude, lng: event.longitude }
    : CITY_COORDS[event.city];

  return {
    id: event.external_id,
    externalId: event.external_id,
    name: event.title,
    description: event.description ?? (event.source_url ? `Curated by RaveCircle. Source: ${event.source_url}` : 'Curated by RaveCircle.'),
    city: event.city,
    venueName: event.venue,
    startDateTime: event.start_date,
    endDateTime: event.end_date,
    latitude: coords?.lat,
    longitude: coords?.lng,
    minPrice: event.min_price ?? undefined,
    ticketUrl: event.ticket_url ?? event.source_url,
    imageUrl: event.image_url || '/demo-events/fallback-rave.jpg',
    eventType: event.event_type,
    genres: event.genres,
    source: event.provider,
    sourceUrl: event.source_url,
    country: event.country,
    isCurated: event.is_curated,
  };
}

export function getCuratedEventByExternalId(externalId: string) {
  const event = curatedEvents.find(item => item.external_id === externalId);
  return event ? ensureExternalId(toCuratedExternalEvent(event)) : null;
}

function getCuratedExternalEvents(options: {
  coords: { lat: number; lng: number };
  radiusKm: number;
  dateFilter?: DateFilter;
  genres?: string[];
}) {
  return curatedEvents
    .map(toCuratedExternalEvent)
    .filter(event => matchesDateFilter(event, options.dateFilter))
    .filter(event => matchesGenreFilter(event, options.genres))
    .filter((event) => {
      if (event.latitude == null || event.longitude == null) return false;
      return calculateDistanceKm(options.coords.lat, options.coords.lng, event.latitude, event.longitude) <= options.radiusKm;
    })
    .map(ensureExternalId);
}

const inferEventType = (event: AggregatedEvent) => {
  const genreLookup = (event.genres || []).map(g => g.toLowerCase());
  const text = `${event.title} ${event.description || ''}`.toLowerCase();
  const hasAny = (terms: string[]) => terms.some(term => genreLookup.includes(term) || text.includes(term));

  if (hasAny(['festival'])) return 'festival';
  if (hasAny(['club', 'nightclub', 'club night'])) return 'club';
  if (hasAny(['concert', 'live'])) return 'concert';
  if (hasAny(['rave', 'warehouse', 'underground', 'afterparty'])) return 'rave';
  return undefined;
};

const toEventType = (value?: string | null): EventType | null => {
  if (value === 'festival' || value === 'club' || value === 'rave' || value === 'concert') {
    return value;
  }
  return null;
};

const toExternalEvent = (event: AggregatedEvent): ExternalEvent | null => {
  if (!event.startTime) return null;
  return {
    id: event.id,
    externalId: event.id,
    name: event.title,
    description: event.description || undefined,
    city: event.city || undefined,
    venueName: event.venueName || undefined,
    startDateTime: event.startTime,
    endDateTime: event.endTime || undefined,
    latitude: event.lat ?? undefined,
    longitude: event.lng ?? undefined,
    minPrice: event.priceFrom ?? undefined,
    ticketUrl: event.ticketUrl ?? undefined,
    imageUrl: event.imageUrl ?? undefined,
    eventType: inferEventType(event),
    genres: event.genres || [],
    source: event.source,
    electronicScore: event.electronicScore ?? undefined,
    lastFmTagged: event.lastFmTagged ?? undefined,
  };
};

async function fetchExternalEvents(options: {
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  dateFilter?: DateFilter;
  genres?: string[];
  page?: number;
  size?: number;
}): Promise<{
  events: ExternalEvent[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  source: string;
  notice?: string;
  hasMore: boolean;
}> {
  const coords = resolveCoords(options.city, options.latitude, options.longitude);
  if (!coords) {
    return {
      events: [],
      page: options.page ?? 0,
      size: options.size ?? 60,
      totalPages: 0,
      totalElements: 0,
      source: 'ticketmaster',
      notice: undefined,
      hasMore: false,
    };
  }

  const range = getDateRange(options.dateFilter);
  const curated = (options.page ?? 0) === 0
    ? getCuratedExternalEvents({
      coords,
      radiusKm: options.radiusKm,
      dateFilter: options.dateFilter,
      genres: options.genres,
    })
    : [];

  let response: Awaited<ReturnType<typeof fetchAggregatedEvents>>;
  try {
    response = await fetchAggregatedEvents({
      lat: coords.lat,
      lng: coords.lng,
      radiusKm: options.radiusKm,
      size: options.size,
      page: options.page,
      startDateTime: range ? formatDateTime(range.start) : undefined,
      endDateTime: range ? formatDateTime(range.end) : undefined,
      genres: options.genres,
      electronicOnly: true,
    });
  } catch (error) {
    if (curated.length === 0) throw error;
    return {
      events: curated,
      page: options.page ?? 0,
      size: options.size ?? 60,
      totalPages: 1,
      totalElements: curated.length,
      source: 'aggregate+curated',
      notice: 'Live event sources are temporarily unavailable. Showing RaveCircle Picks.',
      hasMore: false,
    };
  }

  const events = [
    ...curated,
    ...response.events
      .map(toExternalEvent)
      .filter((event): event is ExternalEvent => Boolean(event))
      .filter(isRaveCircleRelevantEvent)
      .map(ensureExternalId),
  ];

  const filteredByDate = options.dateFilter
    ? events.filter(event => matchesDateFilter(event, options.dateFilter))
    : events;

  return {
    events: filteredByDate,
    page: response.page,
    size: response.size,
    totalPages: response.hasMore ? (response.page + 2) : (response.page + 1),
    totalElements: response.hasMore ? ((response.page + 1) * response.size) + curated.length + 1 : ((response.page + 1) * response.size) + curated.length,
    source: curated.length > 0 ? 'aggregate+curated' : 'aggregate',
    notice: response.notice,
    hasMore: response.hasMore,
  };
}

export async function ensureSupabaseEvents(events: ExternalEvent[]) {
  if (events.length === 0) return events;
  const now = Date.now();
  const withExternalId = events.map(event => ({ ...event, externalId: event.externalId || event.id }));
  const unresolvedEvents = withExternalId.filter(event => !event.supabaseId);
  const externalIds = Array.from(new Set(unresolvedEvents.map(event => event.externalId || event.id)));
  const idByExternal = new Map<string, string>();

  // Resolve already-known events first so action buttons can work even if inserts are blocked.
  if (externalIds.length > 0) {
    const { data: existingRows } = await supabase
      .from('events')
      .select('id, external_id')
      .in('external_id', externalIds);
    (existingRows || []).forEach((row) => {
      if (row.external_id) {
        idByExternal.set(row.external_id, row.id);
      }
    });
  }

  const toUpsertByExternalId = new Map<string, ExternalEvent>();
  for (const event of unresolvedEvents) {
    const externalId = event.externalId || event.id;
    if (idByExternal.has(externalId)) continue;
    const cooldownUntil = upsertCooldownByExternalId.get(externalId) ?? 0;
    if (cooldownUntil > now) continue;
    if (!toUpsertByExternalId.has(externalId)) {
      toUpsertByExternalId.set(externalId, event);
    }
  }

  if (toUpsertByExternalId.size === 0) {
    return withExternalId.map(event => ({
      ...event,
      externalId: event.externalId || event.id,
      supabaseId: idByExternal.get(event.externalId || event.id) || event.supabaseId,
      source: event.source || 'external',
    }));
  }

  const toUpsert = Array.from(toUpsertByExternalId.values());

  try {
    const payload: EventsInsert[] = toUpsert
      .map(event => ({
      external_id: event.externalId || event.id,
      source: event.source || 'external',
      name: event.name,
      description: event.description ?? null,
      city: event.city ?? null,
      venue_name: event.venueName ?? null,
      start_datetime: event.startDateTime,
      end_datetime: event.endDateTime ?? null,
      min_price: event.minPrice ?? null,
      ticket_url: event.ticketUrl ?? null,
      image_url: event.imageUrl ?? null,
      event_type: toEventType(event.eventType),
      genres: event.genres ?? [],
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      }))
      .filter((entry) => !idByExternal.has(entry.external_id));

    if (payload.length > 0) {
      // ignoreDuplicates avoids UPDATE paths that can fail under stricter RLS.
      const { error: upsertError } = await supabase
        .from('events')
        .upsert(payload, { onConflict: 'external_id', ignoreDuplicates: true });
      if (upsertError) {
        throw upsertError;
      }

      for (const entry of payload) {
        upsertCooldownByExternalId.set(entry.external_id, now + UPSERT_COOLDOWN_SUCCESS_MS);
      }

      const insertedExternalIds = payload.map(entry => entry.external_id);
      const { data: insertedRows } = await supabase
        .from('events')
        .select('id, external_id')
        .in('external_id', insertedExternalIds);
      (insertedRows || []).forEach((row) => {
        if (row.external_id) {
          idByExternal.set(row.external_id, row.id);
        }
      });
    }

    return withExternalId.map(event => ({
      ...event,
      externalId: event.externalId || event.id,
      supabaseId: idByExternal.get(event.externalId || event.id) || event.supabaseId,
      source: event.source || 'external',
    }));
  } catch (error) {
    for (const event of toUpsert.filter(item => !idByExternal.has(item.externalId || item.id))) {
      const externalId = event.externalId || event.id;
      upsertCooldownByExternalId.set(externalId, now + UPSERT_COOLDOWN_FAILURE_MS);
    }
    if (import.meta.env.DEV) {
      console.warn('[events] failed to persist external events', error);
    }
  }
  return withExternalId.map(event => ({
    ...event,
    externalId: event.externalId || event.id,
    supabaseId: idByExternal.get(event.externalId || event.id) || event.supabaseId,
    source: event.source || 'external',
  }));
}

export async function fetchEventsWithFallback(options: {
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  preferredGenres: string[];
  dateFilter?: DateFilter;
  genres?: string[];
  page?: number;
  size?: number;
}): Promise<{
  matchedToTaste: ExternalEvent[];
  suggestedEvents: ExternalEvent[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  source: string;
  notice?: string;
  hasMore: boolean;
}> {
  const baseRadius = options.radiusKm > 0 ? options.radiusKm : 25;
  const page = options.page ?? 0;
  const size = options.size ?? 60;
  const radiusSteps = page > 0
    ? [baseRadius]
    : baseRadius >= 1500
      ? [1500]
      : Array.from(new Set([baseRadius, Math.max(baseRadius, 100)])).filter(r => r > 0);

  let response: Awaited<ReturnType<typeof fetchExternalEvents>> = {
    events: [] as ExternalEvent[],
    page,
    size,
    totalPages: 0,
    totalElements: 0,
    source: 'ticketmaster',
    notice: undefined,
    hasMore: false,
  };

  for (const radius of radiusSteps) {
    response = await fetchExternalEvents({
      city: options.city,
      latitude: options.latitude,
      longitude: options.longitude,
      radiusKm: radius,
      dateFilter: options.dateFilter,
      genres: options.genres,
      page,
      size,
    });
    if (response.events.length > 0 || page > 0) break;
  }

  const shouldTryFallbackCities =
    response.events.length === 0 &&
    page === 0 &&
    options.city == null &&
    options.latitude == null &&
    options.longitude == null;

  if (shouldTryFallbackCities) {
    for (const fallbackCity of PRIORITY_CITIES.slice(0, MAX_FALLBACK_CITIES)) {
      response = await fetchExternalEvents({
        city: fallbackCity,
        latitude: options.latitude,
        longitude: options.longitude,
        radiusKm: baseRadius,
        dateFilter: options.dateFilter,
        genres: options.genres,
        page,
        size,
      });
      if (response.events.length > 0) break;
    }
  }

  const matchedToTaste = response.events.filter(event => matchesTaste(event, options.preferredGenres));
  const suggestedEvents = response.events.filter(event => !matchesTaste(event, options.preferredGenres));

  return {
    matchedToTaste,
    suggestedEvents,
    page: response.page,
    size: response.size,
    totalPages: response.totalPages,
    totalElements: response.totalElements,
    source: response.source,
    notice: response.notice,
    hasMore: response.hasMore,
  };
}
