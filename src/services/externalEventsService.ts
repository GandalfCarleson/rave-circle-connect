import { fetchAggregatedEvents, type AggregatedEvent } from '@/api/events/aggregate';

type DateFilter = 'this_week' | 'next_week' | 'this_month' | 'this_year';

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
  imageUrl?: string;
  eventType?: string;
  genres?: string[];
  source?: string;
};

const PRIORITY_CITIES = [
  'Stockholm',
  'Gothenburg',
  'Malmö',
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
  Stockholm: { lat: 59.3293, lng: 18.0686 },
  Gothenburg: { lat: 57.7089, lng: 11.9746 },
  Malmö: { lat: 55.605, lng: 13.0038 },
  Copenhagen: { lat: 55.6761, lng: 12.5683 },
  Oslo: { lat: 59.9139, lng: 10.7522 },
  Helsinki: { lat: 60.1699, lng: 24.9384 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Munich: { lat: 48.1351, lng: 11.582 },
  Frankfurt: { lat: 50.1109, lng: 8.6821 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Rotterdam: { lat: 51.9244, lng: 4.4777 },
  Prague: { lat: 50.0755, lng: 14.4378 },
};

const resolveCoords = (city?: string, latitude?: number, longitude?: number) => {
  if (latitude != null && longitude != null) {
    return { lat: latitude, lng: longitude };
  }
  if (city && CITY_COORDS[city]) {
    return CITY_COORDS[city];
  }
  const fallbackCity = PRIORITY_CITIES[0];
  return CITY_COORDS[fallbackCity] ?? null;
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
    imageUrl: event.imageUrl ?? undefined,
    eventType: inferEventType(event),
    genres: event.genres || [],
    source: event.source,
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
  const response = await fetchAggregatedEvents({
    lat: coords.lat,
    lng: coords.lng,
    radiusKm: options.radiusKm,
    size: options.size,
    page: options.page,
    startDateTime: range ? formatDateTime(range.start) : undefined,
    endDateTime: range ? formatDateTime(range.end) : undefined,
    genres: options.genres,
    electronicOnly: false,
  });

  const events = response.events
    .map(toExternalEvent)
    .filter((event): event is ExternalEvent => Boolean(event))
    .map(ensureExternalId);

  const filteredByDate = options.dateFilter
    ? events.filter(event => matchesDateFilter(event, options.dateFilter))
    : events;

  return {
    events: filteredByDate,
    page: response.page,
    size: response.size,
    totalPages: response.hasMore ? (response.page + 2) : (response.page + 1),
    totalElements: response.hasMore ? ((response.page + 1) * response.size) + 1 : ((response.page + 1) * response.size),
    source: 'aggregate',
    notice: response.notice,
    hasMore: response.hasMore,
  };
}

export async function ensureSupabaseEvents(events: ExternalEvent[]) {
  if (events.length === 0) return events;
  try {
    const payload = events.map(event => ({
      external_id: event.externalId || event.id,
      source: event.source || 'external',
      name: event.name,
      description: event.description ?? null,
      city: event.city ?? null,
      venue_name: event.venueName ?? null,
      start_datetime: event.startDateTime,
      end_datetime: event.endDateTime ?? null,
      min_price: event.minPrice ?? null,
      image_url: event.imageUrl ?? null,
      event_type: (event.eventType || null) as ExternalEvent['eventType'],
      genres: event.genres ?? [],
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
    }));

    const { data } = await (await import('@/integrations/supabase/client')).supabase
      .from('events')
      .upsert(payload, { onConflict: 'external_id' })
      .select('id, external_id');

    if (data) {
      const idByExternal = new Map(data.map(row => [row.external_id, row.id]));
      return events.map(event => ({
        ...event,
        externalId: event.externalId || event.id,
        supabaseId: idByExternal.get(event.externalId || event.id) || event.supabaseId,
        source: event.source || 'external',
      }));
    }
  } catch {
    // Ignore persistence failures and return events without supabase ids.
  }
  return events.map(event => ({ ...event, externalId: event.externalId || event.id }));
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
  const radiusSteps = baseRadius >= 1500
    ? [1500]
    : Array.from(new Set([baseRadius, 50, 100])).filter(r => r > 0);

  const page = options.page ?? 0;
  const size = options.size ?? 60;

  let response = {
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

  if (response.events.length === 0 && page === 0) {
    for (const fallbackCity of PRIORITY_CITIES) {
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
