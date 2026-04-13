import { supabase } from '@/integrations/supabase/client';

export type AggregatedEvent = {
  id: string;
  source: string;
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
  artists?: string[] | null;
  electronicScore?: number | null;
  lastFmTagged?: boolean | null;
};

export type AggregatedEventsResponse = {
  events: AggregatedEvent[];
  page: number;
  size: number;
  hasMore: boolean;
  notice?: string;
  sources?: {
    ticketmaster?: { ok: boolean; error?: string; count: number };
    tickster?: { ok: boolean; error?: string; count: number };
  };
  enrichment?: {
    electronicBiasApplied?: boolean;
    lastFm?: {
      enabled?: boolean;
      lookedUpArtists?: number;
      eventsWithArtistSignal?: number;
      filteredOutByScore?: number;
    };
  };
};

type AggregateQuery = {
  lat: number;
  lng: number;
  radiusKm?: number | null;
  size?: number;
  page?: number;
  startDateTime?: string;
  endDateTime?: string;
  genres?: string[];
  electronicOnly?: boolean;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

export async function fetchAggregatedEvents(params: AggregateQuery): Promise<AggregatedEventsResponse> {
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
  if (params.electronicOnly !== undefined) query.set('electronicOnly', String(params.electronicOnly));

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const anonJwt = supabaseKey.startsWith('eyJ') ? supabaseKey : undefined;
  const bearerToken = accessToken || anonJwt;

  const headers: Record<string, string> = {};
  // apikey must always be sent for Edge Function gateway auth.
  // Supports both legacy JWT anon keys and new sb_publishable_* keys.
  headers.apikey = supabaseKey;
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/events-aggregate?${query.toString()}`, {
    method: 'GET',
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (import.meta.env.DEV) {
      console.error('[events-aggregate] request failed', {
        status: response.status,
        hasSessionToken: Boolean(accessToken),
        authHeaderSent: Boolean(headers.Authorization),
        error: payload,
      });
    }
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Unable to load events (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return payload as AggregatedEventsResponse;
}
