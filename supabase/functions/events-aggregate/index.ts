import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { LastFmService } from "../_shared/lastFmService.ts";
import { classifyArtistTags, extractArtistCandidates } from "../_shared/artistClassifier.ts";

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
  artists?: string[] | null;
  electronicScore?: number | null;
  lastFmTagged?: boolean | null;
};

const LASTFM_MAX_ARTIST_LOOKUPS = 30;
const LASTFM_ARTISTS_PER_EVENT = 3;
const LASTFM_LOOKUP_CONCURRENCY = 6;
const STRONG_NON_ELECTRONIC_SCORE = -4;
const PROVIDER_ELECTRONIC_BONUS = 2;

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

const MUSIC_TERMS = [
  "music",
  "concert",
  "live",
  "festival",
  "gig",
  "dj",
  "club",
  "rave",
  "dance",
  "electronic",
  "house",
  "techno",
  "trance",
  "dnb",
  "drum and bass",
  "hip-hop",
  "hip hop",
  "rap",
  "rock",
  "pop",
  "jazz",
  "metal",
  "indie",
  "edm",
  "showcase",
];

const NON_MUSIC_TERMS = [
  "stand up",
  "stand-up",
  "comedy",
  "gift card",
  "giftcard",
  "presentkort",
  "voucher",
  "parking permit",
  "theatre",
  "theater",
  "musical",
  "opera",
  "ballet",
  "lecture",
  "workshop",
  "seminar",
  "conference",
  "cinema",
  "movie",
  "film screening",
];

const includesAnyTerm = (haystack: string, terms: string[]) =>
  terms.some((term) => haystack.includes(term));

const eventMatchesElectronic = (event: AggregatedEvent) => {
  const text = `${event.title ?? ""} ${event.description ?? ""}`.toLowerCase();
  const genres = Array.isArray(event.genres) ? event.genres.map((g) => g.toLowerCase()) : [];
  return ELECTRONIC_TERMS.some((term) => text.includes(term) || genres.some((genre) => genre.includes(term)));
};

const eventMatchesMusic = (event: AggregatedEvent) => {
  const text = `${event.title ?? ""} ${event.description ?? ""} ${event.venueName ?? ""} ${event.city ?? ""}`.toLowerCase();
  const genres = Array.isArray(event.genres) ? event.genres.map((g) => g.toLowerCase()) : [];
  const genresText = genres.join(" ");

  if (includesAnyTerm(`${text} ${genresText}`, NON_MUSIC_TERMS)) {
    return false;
  }

  if (includesAnyTerm(genresText, MUSIC_TERMS)) {
    return true;
  }

  if (includesAnyTerm(text, MUSIC_TERMS)) {
    return true;
  }

  return false;
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

const parseEventTime = (event: AggregatedEvent) => {
  const time = event.startTime ? new Date(event.startTime).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

type ElectronicRankingResult = {
  events: AggregatedEvent[];
  scoreByEventId: Map<string, number>;
  lastFmTaggedByEventId: Map<string, boolean>;
  lookedUpArtists: number;
  eventsWithArtistSignal: number;
  filteredOutByScore: number;
  lastFmEnabled: boolean;
};

const rankEventsByElectronicRelevance = async (
  events: AggregatedEvent[],
  size: number,
  lastFmApiKey: string | null,
) : Promise<ElectronicRankingResult> => {
  if (events.length === 0) {
    return {
      events: [],
      scoreByEventId: new Map(),
      lastFmTaggedByEventId: new Map(),
      lookedUpArtists: 0,
      eventsWithArtistSignal: 0,
      filteredOutByScore: 0,
      lastFmEnabled: Boolean(lastFmApiKey),
    };
  }

  const eventArtists = events.map((event) => ({
    event,
    artists: extractArtistCandidates(
      { title: event.title ?? "", artists: event.artists ?? [] },
      LASTFM_ARTISTS_PER_EVENT,
    ),
  }));

  const scoreByEventId = new Map<string, number>();
  const lastFmTaggedByEventId = new Map<string, boolean>();

  if (!lastFmApiKey) {
    eventArtists.forEach(({ event }) => {
      scoreByEventId.set(event.id, eventMatchesElectronic(event) ? PROVIDER_ELECTRONIC_BONUS : 0);
      lastFmTaggedByEventId.set(event.id, false);
    });
    const sorted = [...events].sort((a, b) => parseEventTime(a) - parseEventTime(b));
    return {
      events: sorted,
      scoreByEventId,
      lastFmTaggedByEventId,
      lookedUpArtists: 0,
      eventsWithArtistSignal: 0,
      filteredOutByScore: 0,
      lastFmEnabled: false,
    };
  }

  const uniqueArtists = Array.from(new Set(eventArtists.flatMap((entry) => entry.artists)));
  const artistsToLookup = uniqueArtists.slice(0, LASTFM_MAX_ARTIST_LOOKUPS);
  const lastFm = new LastFmService(lastFmApiKey);
  const tagsByArtist = await lastFm.getTopTagsForArtists(artistsToLookup, LASTFM_LOOKUP_CONCURRENCY);

  const artistScoreByName = new Map<string, number>();
  artistsToLookup.forEach((artist) => {
    const classification = classifyArtistTags(tagsByArtist.get(artist) || []);
    artistScoreByName.set(artist, classification.score);
  });

  let eventsWithArtistSignal = 0;
  const scored = eventArtists.map(({ event, artists }) => {
    const artistScores = artists
      .map((artist) => artistScoreByName.get(artist))
      .filter((score): score is number => typeof score === "number");

    const averageArtistScore = artistScores.length > 0
      ? artistScores.reduce((sum, score) => sum + score, 0) / artistScores.length
      : 0;
    const bestArtistScore = artistScores.length > 0 ? Math.max(...artistScores) : 0;
    const artistSignal = artistScores.length > 0 ? Math.max(bestArtistScore, averageArtistScore) : 0;
    if (artistScores.some((score) => Math.abs(score) >= 3)) {
      eventsWithArtistSignal += 1;
    }

    const providerSignal = eventMatchesElectronic(event) ? PROVIDER_ELECTRONIC_BONUS : 0;
    const score = artistSignal + providerSignal;
    scoreByEventId.set(event.id, score);
    lastFmTaggedByEventId.set(event.id, artistScores.length > 0);

    return { event, score };
  });

  const filtered = scored.filter((entry) => entry.score > STRONG_NON_ELECTRONIC_SCORE);
  const minimumPool = Math.min(size, 12);
  const pool = filtered.length >= minimumPool ? filtered : scored;
  const filteredOutByScore = scored.length - filtered.length;

  pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return parseEventTime(a.event) - parseEventTime(b.event);
  });

  return {
    events: pool.map((entry) => entry.event),
    scoreByEventId,
    lastFmTaggedByEventId,
    lookedUpArtists: artistsToLookup.length,
    eventsWithArtistSignal,
    filteredOutByScore,
    lastFmEnabled: true,
  };
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
  const electronicBias = url.searchParams.get("electronicBias") !== "false";
  const lastFmApiKey = Deno.env.get("LASTFM_API_KEY");
  const selectedGenres = (url.searchParams.get("genres") || "")
    .split(",")
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean);
  const startDateTime = formatDateParam(url.searchParams.get("startDateTime"));
  const endDateTime = formatDateParam(url.searchParams.get("endDateTime"));

  const cacheKey = `aggregate:${lat}:${lng}:${radiusKm ?? "none"}:${page}:${size}:${selectedGenres.join("|")}:${electronicOnly}:${electronicBias}:${Boolean(lastFmApiKey)}:${startDateTime || ""}:${endDateTime || ""}`;
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
  const beforeMusicFilter = deduped.length;
  deduped = deduped.filter(eventMatchesMusic);

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

  let scoreByEventId = new Map<string, number>();
  let lastFmTaggedByEventId = new Map<string, boolean>();
  let lookedUpArtists = 0;
  let eventsWithArtistSignal = 0;
  let filteredOutByScore = 0;
  let lastFmEnabled = false;

  if (electronicBias) {
    const rankingResult = await rankEventsByElectronicRelevance(deduped, size, lastFmApiKey);
    deduped = rankingResult.events;
    scoreByEventId = rankingResult.scoreByEventId;
    lastFmTaggedByEventId = rankingResult.lastFmTaggedByEventId;
    lookedUpArtists = rankingResult.lookedUpArtists;
    eventsWithArtistSignal = rankingResult.eventsWithArtistSignal;
    filteredOutByScore = rankingResult.filteredOutByScore;
    lastFmEnabled = rankingResult.lastFmEnabled;
  } else {
    deduped.sort((a, b) => parseEventTime(a) - parseEventTime(b));
  }

  const sortByScoreThenTime = (a: AggregatedEvent, b: AggregatedEvent) => {
    const scoreA = scoreByEventId.get(a.id) ?? 0;
    const scoreB = scoreByEventId.get(b.id) ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return parseEventTime(a) - parseEventTime(b);
  };

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
        .sort(sortByScoreThenTime)
        .slice(0, size);
    }
  }

  if (electronicBias) {
    pageEvents = pageEvents.map((event) => ({
      ...event,
      electronicScore: scoreByEventId.get(event.id) ?? 0,
      lastFmTagged: lastFmEnabled ? (lastFmTaggedByEventId.get(event.id) ?? false) : false,
    }));
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
    enrichment: {
      electronicBiasApplied: electronicBias,
      lastFm: {
        enabled: lastFmEnabled,
        lookedUpArtists,
        eventsWithArtistSignal,
        filteredOutByScore,
      },
    },
  };

  console.log("events-aggregate", {
    page,
    size,
    beforeMusicFilter,
    returned: pageEvents.length,
    ticketmaster: { ok: tmMeta.ok, count: tmMeta.count },
    tickster: { ok: tkMeta.ok, count: tkMeta.count },
    electronicBias,
    lastFmEnabled,
    lookedUpArtists,
    filteredOutByScore,
  });

  setCached(cacheKey, responseBody);

  return jsonResponse(responseBody);
});
