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
const PROVIDER_TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;

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

type JsonRecord = Record<string, unknown>;

const jitter = () => Math.floor(Math.random() * 200);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url: string, headers: HeadersInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchWithRetry = async (url: string, headers: HeadersInit) => {
  let attempt = 0;
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetchWithTimeout(url, headers);
      if (response.ok) return response;

      const retryable = response.status === 429 || response.status >= 500;
      lastResponse = response;
      if (!retryable || attempt === MAX_RETRIES) return response;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        throw error;
      }
    }

    attempt += 1;
    await delay(250 * Math.pow(2, attempt) + jitter());
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("Tickster request failed");
};

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" ? (value as JsonRecord) : null;

const asRecordArray = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(asRecord(item))) : [];

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

  let response: Response;
  try {
    response = await fetchWithRetry(ticksterUrl.toString(), {
      "X-API-KEY": apiKey,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: {
          status: 504,
          message: "Tickster request failed",
          details: error instanceof Error ? error.message : "Unknown error",
          request: ticksterUrl.toString().replace(apiKey, "[redacted]"),
        },
      },
      504,
    );
  }

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

  const payload = await response.json() as JsonRecord | JsonRecord[];
  const payloadRecord = asRecord(payload);
  const nestedData = asRecord(payloadRecord?.data);
  const items = asRecordArray(payloadRecord?.items)
    .concat(asRecordArray(payloadRecord?.hits))
    .concat(asRecordArray(payloadRecord?.events))
    .concat(asRecordArray(nestedData?.events))
    .concat(asRecordArray(payloadRecord?.results));
  const fallbackItems = items.length > 0 ? items : asRecordArray(payload);
  const totalRaw = payloadRecord?.total ?? payloadRecord?.totalCount ?? payloadRecord?.totalHits;
  const total = typeof totalRaw === "number" ? totalRaw : fallbackItems.length;

  const normalized = fallbackItems.map((event) => {
    const venue = asRecord(event.venue);
    const location = asRecord(event.location);
    const place = asRecord(event.place);
    const dateInfo = asRecord(event.date);
    const timeInfo = asRecord(event.time);
    const priceInfo = asRecord(event.price);
    const links = asRecord(event.links);
    const venueCity = asRecord(venue?.city);
    const locationCity = asRecord(location?.city);

    const tags = Array.isArray(event.tags) ? event.tags : [];
    const genres = tags
      .map((tag) => {
        if (typeof tag === "string") return tag;
        const tagRecord = asRecord(tag);
        return typeof tagRecord?.name === "string" ? tagRecord.name : "";
      })
      .filter((tag): tag is string => tag.length > 0);

    return {
      id: `tickster_${String(event.id ?? "")}`,
    source: "tickster",
    sourceId: String(event.id ?? ""),
    title: (typeof event.name === "string" ? event.name : undefined) || (typeof event.title === "string" ? event.title : "") || "",
    description: (typeof event.description === "string" ? event.description : undefined) || (typeof event.text === "string" ? event.text : "") || "",
    startTime: toIso(pickFirst(
      typeof event.start === "string" ? event.start : undefined,
      typeof event.startDate === "string" ? event.startDate : undefined,
      typeof event.startTime === "string" ? event.startTime : undefined,
      typeof event.start_datetime === "string" ? event.start_datetime : undefined,
      typeof dateInfo?.start === "string" ? dateInfo.start : undefined,
      typeof dateInfo?.from === "string" ? dateInfo.from : undefined,
      typeof timeInfo?.start === "string" ? timeInfo.start : undefined,
    )),
    endTime: toIso(pickFirst(
      typeof event.end === "string" ? event.end : undefined,
      typeof event.endDate === "string" ? event.endDate : undefined,
      typeof event.endTime === "string" ? event.endTime : undefined,
      typeof event.end_datetime === "string" ? event.end_datetime : undefined,
      typeof dateInfo?.end === "string" ? dateInfo.end : undefined,
      typeof dateInfo?.to === "string" ? dateInfo.to : undefined,
      typeof timeInfo?.end === "string" ? timeInfo.end : undefined,
    )),
    timezone: typeof event.timezone === "string" ? event.timezone : null,
    venueName: (typeof venue?.name === "string" ? venue.name : undefined) || (typeof location?.name === "string" ? location.name : undefined) || (typeof place?.name === "string" ? place.name : undefined) || null,
    city: (typeof venueCity?.name === "string" ? venueCity.name : undefined)
      || (typeof venue?.city === "string" ? venue.city : undefined)
      || (typeof locationCity?.name === "string" ? locationCity.name : undefined)
      || (typeof location?.city === "string" ? location.city : undefined)
      || (typeof place?.city === "string" ? place.city : undefined)
      || null,
    country: (typeof venue?.countryCode === "string" ? venue.countryCode : undefined)
      || (typeof location?.countryCode === "string" ? location.countryCode : undefined)
      || (typeof place?.countryCode === "string" ? place.countryCode : undefined)
      || null,
    address: (asRecord(venue?.address)?.line1 as string | undefined)
      || (typeof venue?.address === "string" ? venue.address : undefined)
      || (typeof location?.address === "string" ? location.address : undefined)
      || (typeof place?.address === "string" ? place.address : undefined)
      || null,
    lat: toNumberOrNull(venue?.latitude ?? location?.latitude ?? place?.latitude),
    lng: toNumberOrNull(venue?.longitude ?? location?.longitude ?? place?.longitude),
    imageUrl: normalizeImageFromAny(event.images || event.imageUrls || asRecord(event.media)?.images),
    ticketUrl: (typeof event.shopUri === "string" ? event.shopUri : undefined)
      || (typeof event.infoUri === "string" ? event.infoUri : undefined)
      || (typeof event.url === "string" ? event.url : undefined)
      || (typeof links?.shop === "string" ? links.shop : undefined)
      || null,
    priceFrom: toNumberOrNull(event.minPrice ?? priceInfo?.from),
    currency: (typeof event.currency === "string" ? event.currency : undefined)
      || (typeof priceInfo?.currency === "string" ? priceInfo.currency : undefined)
      || null,
    genres,
  };
  });

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

  console.log("tickster-events", {
    page,
    size,
    events: normalized.length,
    rateRemaining: rateRemaining ?? "unknown",
  });

  return jsonResponse(responseBody);
});
