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

const MOCK_EVENTS: ExternalEvent[] = [
  {
    id: 'mock-berlin-warehouse',
    name: 'Warehouse Pulse',
    description: 'Late-night techno marathon in a converted warehouse.',
    city: 'Berlin',
    venueName: 'Kraftwerk',
    startDateTime: '2026-02-07T21:00:00Z',
    endDateTime: '2026-02-08T06:00:00Z',
    latitude: 52.511,
    longitude: 13.419,
    minPrice: 25,
    eventType: 'rave',
    genres: ['Techno', 'Industrial'],
    imageUrl: 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-cph-harbor',
    name: 'Harbor Lights',
    description: 'Melodic house by the water with sunset vibes.',
    city: 'Copenhagen',
    venueName: 'Refshaleøen',
    startDateTime: '2026-02-14T17:00:00Z',
    endDateTime: '2026-02-14T23:00:00Z',
    latitude: 55.682,
    longitude: 12.610,
    minPrice: 15,
    eventType: 'festival',
    genres: ['House', 'Progressive'],
    imageUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-malmo-basement',
    name: 'Basement Signal',
    description: 'Raw, fast, and heavy techno with local DJs.',
    city: 'Malmö',
    venueName: 'Plan B',
    startDateTime: '2026-02-01T21:30:00Z',
    endDateTime: '2026-02-02T03:30:00Z',
    latitude: 55.607,
    longitude: 13.013,
    minPrice: 12,
    eventType: 'club',
    genres: ['Techno', 'Hardstyle'],
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-oslo-trance',
    name: 'Northern Trance',
    description: 'Uplifting trance with immersive visuals.',
    city: 'Oslo',
    venueName: 'Sentrum Scene',
    startDateTime: '2026-02-21T19:00:00Z',
    endDateTime: '2026-02-21T23:30:00Z',
    latitude: 59.913,
    longitude: 10.746,
    minPrice: 22,
    eventType: 'concert',
    genres: ['Trance', 'EDM'],
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-amsterdam-dnb',
    name: 'Bassline Syndicate',
    description: 'Drum & Bass night with guest MCs.',
    city: 'Amsterdam',
    venueName: 'Melkweg',
    startDateTime: '2026-02-28T20:00:00Z',
    endDateTime: '2026-03-01T02:00:00Z',
    latitude: 52.364,
    longitude: 4.883,
    minPrice: 18,
    eventType: 'club',
    genres: ['Drum & Bass'],
    imageUrl: 'https://images.unsplash.com/photo-1461783436728-0a921771469b?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-stockholm-festival',
    name: 'Northern Skies Festival',
    description: 'Open-air festival with techno and house across two stages.',
    city: 'Stockholm',
    venueName: 'Gärdet',
    startDateTime: '2026-03-06T12:00:00Z',
    endDateTime: '2026-03-08T22:00:00Z',
    latitude: 59.337,
    longitude: 18.090,
    minPrice: 65,
    eventType: 'festival',
    genres: ['Techno', 'House'],
    imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-gothenburg-rave',
    name: 'Terminal 9',
    description: 'Underground rave with hard techno and industrial sets.',
    city: 'Gothenburg',
    venueName: 'Ringön',
    startDateTime: '2026-03-13T22:00:00Z',
    endDateTime: '2026-03-14T05:00:00Z',
    latitude: 57.719,
    longitude: 11.973,
    minPrice: 18,
    eventType: 'rave',
    genres: ['Techno', 'Industrial'],
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-prague-club',
    name: 'Submerge',
    description: 'Deep house and minimal with resident DJs.',
    city: 'Prague',
    venueName: 'Cross Club',
    startDateTime: '2026-03-20T20:30:00Z',
    endDateTime: '2026-03-21T03:00:00Z',
    latitude: 50.105,
    longitude: 14.451,
    minPrice: 14,
    eventType: 'club',
    genres: ['House', 'Minimal'],
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
  {
    id: 'mock-helsinki-concert',
    name: 'Aurora Pulse',
    description: 'Live electronic concert with immersive visuals.',
    city: 'Helsinki',
    venueName: 'Kaapelitehdas',
    startDateTime: '2026-04-03T19:00:00Z',
    endDateTime: '2026-04-03T22:00:00Z',
    latitude: 60.165,
    longitude: 24.922,
    minPrice: 28,
    eventType: 'concert',
    genres: ['Ambient', 'EDM'],
    imageUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop',
    source: 'mock',
  },
];

const EXTERNAL_EVENTS_API_URL = import.meta.env.VITE_EXTERNAL_EVENTS_API_URL as string | undefined;
const EXTERNAL_EVENTS_API_KEY = import.meta.env.VITE_EXTERNAL_EVENTS_API_KEY as string | undefined;

const ensureExternalId = (event: ExternalEvent) => ({
  ...event,
  externalId: event.externalId || event.id,
});

export function getMockEventsById(ids: string[]) {
  const lookup = new Set(ids);
  return MOCK_EVENTS
    .filter(event => lookup.has(event.id))
    .map(ensureExternalId);
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const endOfDay = (date: Date) => new Date(startOfDay(date).getTime() + 24 * 60 * 60 * 1000 - 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
const endOfYear = (date: Date) => new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

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

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function filterByLocation(events: ExternalEvent[], options: {
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
}) {
  return events.filter(event => {
    const hasCoords = options.latitude != null && options.longitude != null;
    if (!hasCoords && options.city && event.city && options.city.toLowerCase() !== event.city.toLowerCase()) {
      return false;
    }
    if (
      hasCoords &&
      options.radiusKm > 0 &&
      options.radiusKm < 1500 &&
      event.latitude != null &&
      event.longitude != null
    ) {
      const distance = calculateDistance(options.latitude, options.longitude, event.latitude, event.longitude);
      return distance <= options.radiusKm;
    }
    return true;
  });
}

function matchesTaste(event: ExternalEvent, preferredGenres: string[]) {
  if (preferredGenres.length === 0) return false;
  const normalizedPrefs = preferredGenres.map(g => g.toLowerCase());
  const eventGenres = (event.genres || []).map(g => g.toLowerCase());
  if (eventGenres.some(g => normalizedPrefs.includes(g))) return true;
  const haystack = `${event.name} ${event.description || ''}`.toLowerCase();
  return normalizedPrefs.some(genre => haystack.includes(genre));
}

async function fetchExternalEvents(options: {
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  dateFilter?: DateFilter;
}) {
  if (EXTERNAL_EVENTS_API_URL) {
    try {
      const params = new URLSearchParams();
      if (options.city) params.set('city', options.city);
      if (options.latitude != null) params.set('lat', String(options.latitude));
      if (options.longitude != null) params.set('lon', String(options.longitude));
      params.set('radiusKm', String(options.radiusKm));
      if (options.dateFilter) params.set('dateFilter', options.dateFilter);

      const response = await fetch(`${EXTERNAL_EVENTS_API_URL}?${params.toString()}`, {
        headers: EXTERNAL_EVENTS_API_KEY ? { Authorization: `Bearer ${EXTERNAL_EVENTS_API_KEY}` } : undefined,
      });
      if (response.ok) {
        const payload = await response.json();
        const events = Array.isArray(payload) ? payload : payload.events;
        if (Array.isArray(events)) {
          return events.map(ensureExternalId) as ExternalEvent[];
        }
      }
    } catch {
      // Fall back to mock data.
    }
  }

  const filtered = filterByLocation(MOCK_EVENTS, {
    city: options.city,
    latitude: options.latitude,
    longitude: options.longitude,
    radiusKm: options.radiusKm,
  }).filter(event => matchesDateFilter(event, options.dateFilter));
  return filtered.map(ensureExternalId);
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
}): Promise<{
  matchedToTaste: ExternalEvent[];
  suggestedEvents: ExternalEvent[];
}> {
  const baseRadius = options.radiusKm > 0 ? options.radiusKm : 25;
  const radiusSteps = baseRadius >= 1500
    ? [1500]
    : Array.from(new Set([baseRadius, 50, 100])).filter(r => r > 0);

  let events: ExternalEvent[] = [];
  for (const radius of radiusSteps) {
    events = await fetchExternalEvents({
      city: options.city,
      latitude: options.latitude,
      longitude: options.longitude,
      radiusKm: radius,
      dateFilter: options.dateFilter,
    });
    if (events.length > 0) break;
  }

  if (events.length === 0) {
    for (const fallbackCity of PRIORITY_CITIES) {
      events = await fetchExternalEvents({
        city: fallbackCity,
        radiusKm: baseRadius,
        dateFilter: options.dateFilter,
      });
      if (events.length > 0) break;
    }
  }

  const matchedToTaste = events.filter(event => matchesTaste(event, options.preferredGenres));
  const suggestedEvents = events.filter(event => !matchesTaste(event, options.preferredGenres));

  return { matchedToTaste, suggestedEvents };
}
