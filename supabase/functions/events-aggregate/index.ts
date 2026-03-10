import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

type CacheEntry = { expiresAt: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
const providerCooldownUntil: Record<"ticketmaster" | "tickster", number> = {
  ticketmaster: 0,
  tickster: 0,
};

const getCached = (key: string) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
};

const setCached = (key: string, payload: unknown) => {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
};

const toNumber = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeIsoParam = (value: string) => value.replace(/\.\d{3}Z$/, "Z");

const formatDateParam = (value: string | null) => (value ? normalizeIsoParam(value) : null);

type AggregatedEvent = {
  id: string;
  source: "ticketmaster" | "tickster" | string;
  sourceId: string;
  title?: string | null;
  description?: string | null;
  startTime?: string | null;
  venueName?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  genres?: string[] | null;
};

const ELECTRONIC_TERMS = [
  "electronic",
  "dance/electronic",
  "club",
  "techno",
  "house",
  "trance",
  "dnb",
  "drum and bass",
  "dubstep",
  "hardstyle",
  "psytrance",
  "edm",
  "rave",
  "dj",
];

const eventMatchesElectronic = (event: AggregatedEvent) => {
  const text = `${event.title ?? ""} ${event.description ?? ""}`.toLowerCase();
  const genres = Array.isArray(event.genres) ? event.genres.map((g) => g.toLowerCase()) : [];
  return ELECTRONIC_TERMS.some((term) => text.includes(term) || genres.some((genre) => genre.includes(term)));
};

const parseLatLng = (lat: number, lng: number, event: AggregatedEvent) => {
  if (event.lat == null || event.lng == null) return null;
  const R = 6371;
  const dLat = (event.lat - lat) * Math.PI / 180;
  const dLon = (event.lng - lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat * Math.PI / 180) * Math.cos(event.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const dedupeEvents = (events: AggregatedEvent[]) => {
  const seen = new Map<string, AggregatedEvent>();

  for (const event of events) {
    const key = `${event.source}:${event.sourceId}`;
    if (!seen.has(key)) {
      seen.set(key, event);
      continue;
    }
  }

  const values = Array.from(seen.values());
  const final: AggregatedEvent[] = [];

  for (const event of values) {
    const titleKey = (event.title || "").toLowerCase();
    const start = event.startTime ? new Date(event.startTime).getTime() : 0;
    const venue = (event.venueName || "").toLowerCase();
    const city = (event.city || "").toLowerCase();

    const duplicate = final.find((candidate) => {
      if ((candidate.title || "").toLowerCase() !== titleKey) return false;
      const candidateStart = candidate.startTime ? new Date(candidate.startTime).getTime() : 0;
      if (Math.abs(candidateStart - start) > 2 * 60 * 60 * 1000) return false;
      const sameVenue = (candidate.venueName || "").toLowerCase() === venue;
      const sameCity = (candidate.city || "").toLowerCase() === city;
      return sameVenue || sameCity;
    });

    if (!duplicate) {
      final.push(event);
    }
  }

  return final;
};

type ProviderResult = {
  ok: boolean;
  events: AggregatedEvent[];
  totalPages?: number;
  totalElements?: number;
  error?: string;
  count: number;
  statusCode?: number;
};

const jitter = () => Math.floor(Math.random() * 200);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url: string, headers: Record<string, string>) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchProvider = async (
  provider: "ticketmaster" | "tickster",
  url: URL,
  headers: Record<string, string>,
): Promise<ProviderResult> => {
  if (Date.now() < providerCooldownUntil[provider]) {
    return {
      ok: false,
      events: [],
      count: 0,
      statusCode: 429,
      error: "429 cooldown active",
    };
  }

  let attempt = 0;
  let lastError = "Unknown error";

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetchWithTimeout(url.toString(), headers);
      if (response.ok) {
        const payload = await response.json();
        const parsedEvents = Array.isArray(payload?.events) ? payload.events : [];
        const events = parsedEvents as AggregatedEvent[];
        return {
          ok: true,
          events,
          totalPages: payload?.totalPages,
          totalElements: payload?.totalElements,
          count: events.length,
        };
      }

      const shouldRetry = response.status === 429 || response.status >= 500;
      const errorText = await response.text();
      lastError = `${response.status} ${response.statusText}${errorText ? `: ${errorText.slice(0, 120)}` : ""}`;

      if (response.status === 429) {
        providerCooldownUntil[provider] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      }

      if (!shouldRetry || attempt === MAX_RETRIES) {
        return { ok: false, events: [], error: lastError, count: 0, statusCode: response.status };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Request failed";
      if (attempt === MAX_RETRIES) {
        return { ok: false, events: [], error: lastError, count: 0 };
      }
    }

    attempt += 1;
    await delay(250 * Math.pow(2, attempt) + jitter());
  }

  return { ok: false, events: [], error: lastError, count: 0 };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: { status: 405, message: "Method not allowed" } }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl) {
    return jsonResponse({ error: { status: 500, message: "SUPABASE_URL is not set" } }, 500);
  }

  const url = new URL(req.url);
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  if (!latParam || !lngParam) {
    return jsonResponse({ error: { status: 400, message: "Missing lat or lng" } }, 400);
  }

  const lat = Number(latParam);
  const lng = Number(lngParam);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return jsonResponse({ error: { status: 400, message: "Invalid lat or lng" } }, 400);
  }

  const radiusKmParam = url.searchParams.get("radiusKm");
  const radiusKm = radiusKmParam ? Number(radiusKmParam) : null;
  const size = Math.min(toNumber(url.searchParams.get("size"), 60), 100);
  const page = Math.max(0, toNumber(url.searchParams.get("page"), 0));
  const electronicOnly = url.searchParams.get("electronicOnly") === "true";
  const selectedGenres = (url.searchParams.get("genres") || "")
    .split(",")
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean);
  const startDateTime = formatDateParam(url.searchParams.get("startDateTime"));
  const endDateTime = formatDateParam(url.searchParams.get("endDateTime"));

  const cacheKey = `aggregate:${lat}:${lng}:${radiusKm ?? "none"}:${page}:${size}:${selectedGenres.join("|")}:${electronicOnly}:${startDateTime || ""}:${endDateTime || ""}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return jsonResponse(cached);
  }

  const headers: Record<string, string> = {};
  const requestAuthHeader = req.headers.get("authorization");
  const requestApiKeyHeader = req.headers.get("apikey");

  // Prefer the incoming caller auth for internal function-to-function calls.
  // Fall back to env anon key if caller headers are absent.
  if (requestAuthHeader) {
    headers.Authorization = requestAuthHeader;
  } else if (anonKey) {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  if (requestApiKeyHeader) {
    headers.apikey = requestApiKeyHeader;
  } else if (anonKey) {
    headers.apikey = anonKey;
  }

  const ticketmasterUrl = new URL(`${supabaseUrl}/functions/v1/ticketmaster-events`);
  ticketmasterUrl.searchParams.set("lat", String(lat));
  ticketmasterUrl.searchParams.set("lng", String(lng));
  ticketmasterUrl.searchParams.set("radiusKm", String(radiusKm ?? 50));
  ticketmasterUrl.searchParams.set("size", String(size));
  ticketmasterUrl.searchParams.set("page", String(page));
  if (startDateTime) ticketmasterUrl.searchParams.set("startDateTime", startDateTime);
  if (endDateTime) ticketmasterUrl.searchParams.set("endDateTime", endDateTime);
  if (selectedGenres.length > 0) ticketmasterUrl.searchParams.set("genres", selectedGenres.join(","));

  const ticksterUrl = new URL(`${supabaseUrl}/functions/v1/tickster-events`);
  ticksterUrl.searchParams.set("lang", "sv");
  ticksterUrl.searchParams.set("apiVersion", "0.4");
  ticksterUrl.searchParams.set("page", String(page));
  ticksterUrl.searchParams.set("size", String(Math.min(size, 100)));

  let extraPage = 0;
  let merged: AggregatedEvent[] = [];
  let tmMeta = { totalPages: 0, totalElements: 0, ok: false, error: "", count: 0 };
  let tkMeta = { totalPages: 0, totalElements: 0, ok: false, error: "", count: 0 };

  while (merged.length < size && extraPage < 3) {
    if (extraPage > 0) {
      ticketmasterUrl.searchParams.set("page", String(page + extraPage));
      ticksterUrl.searchParams.set("page", String(page + extraPage));
    }

    const [tmResult, tkResult] = await Promise.all([
      fetchProvider("ticketmaster", ticketmasterUrl, headers),
      fetchProvider("tickster", ticksterUrl, headers),
    ]);

    if (!tmMeta.ok && tmResult.ok) tmMeta.ok = true;
    if (!tkMeta.ok && tkResult.ok) tkMeta.ok = true;
    if (tmResult.error) tmMeta.error = tmResult.error;
    if (tkResult.error) tkMeta.error = tkResult.error;
    tmMeta.count += tmResult.count;
    tkMeta.count += tkResult.count;

    tmMeta = {
      ...tmMeta,
      totalPages: tmResult.totalPages ?? tmMeta.totalPages,
      totalElements: tmResult.totalElements ?? tmMeta.totalElements,
    };
    tkMeta = {
      ...tkMeta,
      totalPages: tkResult.totalPages ?? tkMeta.totalPages,
      totalElements: tkResult.totalElements ?? tkMeta.totalElements,
    };

    const combined = [...tmResult.events, ...tkResult.events];
    merged = merged.concat(combined);
    extraPage += 1;

    if (!tmResult.ok && !tkResult.ok) {
      break;
    }
  }

  if (!tmMeta.ok && !tkMeta.ok) {
    const responseBody = {
      events: [],
      page,
      size,
      hasMore: false,
      notice: "Events providers are temporarily unavailable. Please try again.",
      sources: {
        ticketmaster: { ok: false, error: tmMeta.error || "Unavailable", count: 0 },
        tickster: { ok: false, error: tkMeta.error || "Unavailable", count: 0 },
      },
    };
    return jsonResponse(responseBody, 502);
  }

  let deduped = dedupeEvents(merged);

  if (selectedGenres.length > 0) {
    deduped = deduped.filter((event) => {
      const genres = Array.isArray(event.genres) ? event.genres.map((genre) => genre.toLowerCase()) : [];
      return genres.some((genre) => selectedGenres.some((selected) => genre.includes(selected)));
    });
  }

  if (electronicOnly) {
    deduped = deduped.filter(eventMatchesElectronic);
  }

  if (radiusKm != null) {
    deduped = deduped.filter((event) => {
      const distance = parseLatLng(lat, lng, event);
      if (distance == null) return true;
      return distance <= radiusKm;
    });
  }

  deduped.sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return aTime - bTime;
  });

  let pageEvents = deduped.slice(0, size);
  const hasTicketmasterEvent = pageEvents.some((event) => event.source === "ticketmaster");
  const hasTicksterEvent = pageEvents.some((event) => event.source === "tickster");
  if (tmMeta.ok && tkMeta.ok && pageEvents.length > 0 && (!hasTicketmasterEvent || !hasTicksterEvent)) {
    const wantedSource = hasTicketmasterEvent ? "tickster" : "ticketmaster";
    const supplemental = deduped
      .filter((event) => event.source === wantedSource)
      .filter((event) => !pageEvents.some((existing) => existing.id === event.id))
      .slice(0, Math.min(5, size));
    if (supplemental.length > 0) {
      pageEvents = [...pageEvents, ...supplemental]
        .sort((a, b) => {
          const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
          const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
          return aTime - bTime;
        })
        .slice(0, size);
    }
  }
  const hasMore = deduped.length > size || page + 1 < Math.max(tmMeta.totalPages, tkMeta.totalPages);
  let notice: string | undefined;
  if (!tmMeta.ok && tkMeta.ok) {
    notice = "Showing Tickster events (Ticketmaster temporarily unavailable).";
  } else if (tmMeta.ok && !tkMeta.ok) {
    notice = "Showing Ticketmaster events (Tickster temporarily unavailable).";
  } else if (tmMeta.ok && tkMeta.ok && tmMeta.count === 0 && tkMeta.count > 0) {
    notice = "Showing Tickster events in this area/time window.";
  } else if (tmMeta.ok && tkMeta.ok && tkMeta.count === 0 && tmMeta.count > 0) {
    notice = "Showing Ticketmaster events in this area/time window.";
  }

  const responseBody = {
    events: pageEvents,
    page,
    size,
    hasMore,
    notice,
    sources: {
      ticketmaster: {
        ok: tmMeta.ok,
        count: tmMeta.count,
        ...(tmMeta.error ? { error: tmMeta.error } : {}),
      },
      tickster: {
        ok: tkMeta.ok,
        count: tkMeta.count,
        ...(tkMeta.error ? { error: tkMeta.error } : {}),
      },
    },
  };

  console.log("events-aggregate", {
    page,
    size,
    returned: pageEvents.length,
    ticketmaster: { ok: tmMeta.ok, count: tmMeta.count },
    tickster: { ok: tkMeta.ok, count: tkMeta.count },
  });

  setCached(cacheKey, responseBody);

  return jsonResponse(responseBody);
});
