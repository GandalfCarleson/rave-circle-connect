export type TicketmasterNormalizedEvent = {
  id: string;
  source: "ticketmaster";
  sourceId: string;
  title: string;
  description: string;
  startTime: string | null;
  endTime: string | null;
  timezone?: string | null;
  venueName?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  ticketUrl?: string | null;
  priceFrom?: number | null;
  currency?: string | null;
  genres: string[];
};

export type TicketmasterEventsResponse = {
  events: TicketmasterNormalizedEvent[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  source: "ticketmaster";
};

type TicketmasterQuery = {
  lat: number;
  lng: number;
  radiusKm?: number;
  size?: number;
  page?: number;
  startDateTime?: string;
  endDateTime?: string;
  genres?: string[];
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

export async function fetchTicketmasterEvents(params: TicketmasterQuery): Promise<TicketmasterEventsResponse> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase client env vars are missing (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).');
  }

  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
  });

  if (params.radiusKm != null) query.set('radiusKm', String(params.radiusKm));
  if (params.size != null) query.set('size', String(params.size));
  if (params.page != null) query.set('page', String(params.page));
  if (params.startDateTime) query.set('startDateTime', params.startDateTime);
  if (params.endDateTime) query.set('endDateTime', params.endDateTime);
  if (params.genres && params.genres.length > 0) query.set('genres', params.genres.join(','));

  const response = await fetch(`${supabaseUrl}/functions/v1/ticketmaster-events?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      'Unable to load events from Ticketmaster.';
    throw new Error(message);
  }

  return payload as TicketmasterEventsResponse;
}
