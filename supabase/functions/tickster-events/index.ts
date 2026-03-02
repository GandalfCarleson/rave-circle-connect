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
const CACHE_TTL_MS = 10 * 60 * 1000;

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

const normalizeImage = (images: Array<{ url?: string; width?: number }> | undefined) => {
  if (!images || images.length === 0) return null;
  const withUrl = images.filter((image) => image.url);
  if (withUrl.length === 0) return null;
  return withUrl.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url ?? null;
};

const toIso = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: { status: 405, message: "Method not allowed" } }, 405);
  }

  const apiKey = Deno.env.get("TICKSTER_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: { status: 500, message: "TICKSTER_API_KEY is not set" } }, 500);
  }

  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") || "sv";
  const apiVersion = url.searchParams.get("apiVersion") || "0.4";
  const page = Math.max(0, toNumber(url.searchParams.get("page"), 0));
  const size = Math.min(Math.max(1, toNumber(url.searchParams.get("size"), 50)), 100);
  const q = url.searchParams.get("q") || "";

  const skip = page * size;
  const take = size;

  const baseUrl = `https://api.tickster.com/${lang}/api/${apiVersion}/events`;
  const endpoint = q ? "search" : "upcoming";
  const ticksterUrl = new URL(`${baseUrl}/${endpoint}`);
  ticksterUrl.searchParams.set("key", apiKey);
  ticksterUrl.searchParams.set("skip", String(skip));
  ticksterUrl.searchParams.set("take", String(take));
  if (q) ticksterUrl.searchParams.set("q", q);

  const cacheKey = `tickster:${lang}:${apiVersion}:${endpoint}:${q}:${page}:${size}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return jsonResponse(cached);
  }

  const response = await fetch(ticksterUrl.toString(), {
    headers: {
      "X-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse(
      {
        error: {
          status: response.status,
          message: "Tickster request failed",
          details: errorText,
          request: ticksterUrl.toString().replace(apiKey, "[redacted]"),
        },
      },
      response.status,
    );
  }

  const rateLimit = response.headers.get("X-RATELIMIT-LIMIT");
  const rateRemaining = response.headers.get("X-RATELIMIT-REMAINING");

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
  const total = payload?.total ?? payload?.totalCount ?? items.length;

  const normalized = items.map((event: any) => ({
    id: `tickster_${event.id}`,
    source: "tickster",
    sourceId: String(event.id),
    title: event.name || event.title || "",
    description: event.description || "",
    startTime: toIso(event.start || event.startDate || event.startTime),
    endTime: toIso(event.end || event.endDate || event.endTime),
    timezone: event.timezone || null,
    venueName: event.venue?.name || event.location?.name || null,
    city: event.venue?.city || event.location?.city || null,
    country: event.venue?.countryCode || event.location?.countryCode || null,
    address: event.venue?.address || event.location?.address || null,
    lat: event.venue?.latitude ?? event.location?.latitude ?? null,
    lng: event.venue?.longitude ?? event.location?.longitude ?? null,
    imageUrl: normalizeImage(event.images || event.imageUrls),
    ticketUrl: event.shopUri || event.infoUri || null,
    priceFrom: event.minPrice ?? null,
    currency: event.currency || null,
    genres: Array.isArray(event.tags) ? event.tags : [],
  }));

  const responseBody = {
    events: normalized,
    page,
    size,
    totalPages: Math.ceil(total / size),
    totalElements: total,
    source: "tickster",
    rateLimit: rateLimit ?? undefined,
    rateRemaining: rateRemaining ?? undefined,
  };

  setCached(cacheKey, responseBody);

  return jsonResponse(responseBody);
});
