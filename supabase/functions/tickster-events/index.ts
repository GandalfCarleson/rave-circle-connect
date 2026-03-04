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

const normalizeImageFromAny = (images: unknown) => {
  if (Array.isArray(images)) {
    return normalizeImage(images as Array<{ url?: string; width?: number }>);
  }
  if (images && typeof images === "object") {
    const imageObject = images as Record<string, unknown>;
    const candidates = [imageObject.large, imageObject.medium, imageObject.thumb, imageObject.original]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    return candidates[0] ?? null;
  }
  return null;
};

const toIso = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const pickFirst = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (value != null && value !== "") return value;
  }
  return null;
};

const toNumberOrNull = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.hits)
      ? payload.hits
    : Array.isArray(payload?.events)
      ? payload.events
      : Array.isArray(payload?.data?.events)
        ? payload.data.events
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
            ? payload
            : [];
  const total = payload?.total ?? payload?.totalCount ?? payload?.totalHits ?? items.length;

  const normalized = items.map((event: any) => ({
    id: `tickster_${event.id}`,
    source: "tickster",
    sourceId: String(event.id),
    title: event.name || event.title || "",
    description: event.description || event.text || "",
    startTime: toIso(pickFirst(
      event.start,
      event.startDate,
      event.startTime,
      event.start_datetime,
      event.date?.start,
      event.date?.from,
      event.time?.start,
    )),
    endTime: toIso(pickFirst(
      event.end,
      event.endDate,
      event.endTime,
      event.end_datetime,
      event.date?.end,
      event.date?.to,
      event.time?.end,
    )),
    timezone: event.timezone || null,
    venueName: event.venue?.name || event.location?.name || event.place?.name || null,
    city: event.venue?.city?.name || event.venue?.city || event.location?.city?.name || event.location?.city || event.place?.city || null,
    country: event.venue?.countryCode || event.location?.countryCode || event.place?.countryCode || null,
    address: event.venue?.address?.line1 || event.venue?.address || event.location?.address || event.place?.address || null,
    lat: toNumberOrNull(event.venue?.latitude ?? event.location?.latitude ?? event.place?.latitude),
    lng: toNumberOrNull(event.venue?.longitude ?? event.location?.longitude ?? event.place?.longitude),
    imageUrl: normalizeImageFromAny(event.images || event.imageUrls || event.media?.images),
    ticketUrl: event.shopUri || event.infoUri || event.url || event.links?.shop || null,
    priceFrom: toNumberOrNull(event.minPrice ?? event.price?.from),
    currency: event.currency || event.price?.currency || null,
    genres: Array.isArray(event.tags)
      ? event.tags.map((tag: any) => typeof tag === "string" ? tag : (tag?.name || "")).filter(Boolean)
      : [],
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
