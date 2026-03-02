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

const ELECTRONIC_KEYWORDS = [
  "techno",
  "house",
  "trance",
  "dnb",
  "drum and bass",
  "dubstep",
  "hardstyle",
  "psytrance",
  "rave",
  "club",
  "dj",
  "warehouse",
  "electronic",
  "dance",
];

const NEGATIVE_KEYWORDS = [
  "theatre",
  "theater",
  "musical",
  "comedy",
  "kids",
  "family",
  "opera",
  "ballet",
  "lecture",
  "conference",
  "seminar",
  "workshop",
  "orchestra",
  "choir",
  "film",
];

const scoreElectronic = (event: any) => {
  const title = (event.title || "").toLowerCase();
  const description = (event.description || "").toLowerCase();
  const genres = Array.isArray(event.genres) ? event.genres.map((g: string) => g.toLowerCase()) : [];

  let score = 0;
  if (genres.some((g) => g.includes("dance/electronic") || g.includes("electronic") || g.includes("club"))) score += 5;
  if (ELECTRONIC_KEYWORDS.some((k) => title.includes(k))) score += 4;
  if (ELECTRONIC_KEYWORDS.some((k) => description.includes(k))) score += 2;
  if (title.includes("dj") || title.includes("rave") || title.includes("club")) score += 2;
  if (NEGATIVE_KEYWORDS.some((k) => title.includes(k))) score -= 6;
  if (NEGATIVE_KEYWORDS.some((k) => description.includes(k))) score -= 3;
  return score;
};

const parseLatLng = (lat: number, lng: number, event: any) => {
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

const dedupeEvents = (events: any[]) => {
  const seen = new Map<string, any>();

  for (const event of events) {
    const key = `${event.source}:${event.sourceId}`;
    if (!seen.has(key)) {
      seen.set(key, event);
      continue;
    }
  }

  const values = Array.from(seen.values());
  const final: any[] = [];

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
  const size = Math.min(toNumber(url.searchParams.get("size"), 20), 50);
  const page = Math.max(0, toNumber(url.searchParams.get("page"), 0));
  const electronicOnly = false;
  const selectedGenres: string[] = [];
  const startDateTime = formatDateParam(url.searchParams.get("startDateTime"));
  const endDateTime = formatDateParam(url.searchParams.get("endDateTime"));

  const cacheKey = `aggregate:${lat}:${lng}:${radiusKm ?? "none"}:${page}:${size}:${selectedGenres.join("|")}:${electronicOnly}:${startDateTime || ""}:${endDateTime || ""}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return jsonResponse(cached);
  }

  const headers: Record<string, string> = {};
  if (anonKey) {
    headers.Authorization = `Bearer ${anonKey}`;
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
  let merged: any[] = [];
  let tmMeta = { totalPages: 0, totalElements: 0 };
  let tkMeta = { totalPages: 0, totalElements: 0 };

  while (merged.length < size && extraPage < 3) {
    if (extraPage > 0) {
      ticketmasterUrl.searchParams.set("page", String(page + extraPage));
      ticksterUrl.searchParams.set("page", String(page + extraPage));
    }

    const [tmRes, tkRes] = await Promise.all([
      fetch(ticketmasterUrl.toString(), { headers }),
      fetch(ticksterUrl.toString(), { headers }),
    ]);

    const tmPayload = tmRes.ok ? await tmRes.json() : { events: [] };
    const tkPayload = tkRes.ok ? await tkRes.json() : { events: [] };

    tmMeta = {
      totalPages: tmPayload?.totalPages ?? tmMeta.totalPages,
      totalElements: tmPayload?.totalElements ?? tmMeta.totalElements,
    };
    tkMeta = {
      totalPages: tkPayload?.totalPages ?? tkMeta.totalPages,
      totalElements: tkPayload?.totalElements ?? tkMeta.totalElements,
    };

    const combined = [...(tmPayload?.events || []), ...(tkPayload?.events || [])];
    merged = merged.concat(combined);
    extraPage += 1;
  }

  let deduped = dedupeEvents(merged);

  if (selectedGenres.length > 0) {
    // Filters disabled for now; keep all events.
  }

  if (electronicOnly) {
    // Filters disabled for now; keep all events.
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

  const start = page * size;
  const end = start + size;
  const pageEvents = deduped.slice(start, end);
  const hasMore = end < deduped.length || page + 1 < Math.max(tmMeta.totalPages, tkMeta.totalPages);

  const responseBody = {
    events: pageEvents,
    page,
    size,
    hasMore,
    sources: {
      ticketmaster: tmMeta,
      tickster: tkMeta,
    },
  };

  setCached(cacheKey, responseBody);

  return jsonResponse(responseBody);
});
