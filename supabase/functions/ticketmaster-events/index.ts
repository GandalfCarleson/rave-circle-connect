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

const normalizeIsoParam = (value: string) => value.replace(/\.\d{3}Z$/, "Z");

const toIsoNoMs = (date: Date) => normalizeIsoParam(date.toISOString());

const pickBestImage = (images: Array<{ ratio?: string; url?: string; width?: number }> | undefined) => {
  if (!images || images.length === 0) return null;
  const withUrl = images.filter((image) => image.url);
  if (withUrl.length === 0) return null;
  const ratioImages = withUrl.filter((image) => image.ratio === "16_9");
  const target = ratioImages.length > 0 ? ratioImages : withUrl;
  return target.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url ?? null;
};

type Classification = Record<string, { name?: string } | undefined> & {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
  type?: { name?: string };
  subType?: { name?: string };
};

type TicketmasterEvent = {
  id: string;
  name?: string;
  info?: string;
  pleaseNote?: string;
  url?: string;
  images?: Array<{ url?: string; ratio?: string; width?: number }>;
  classifications?: Classification[];
  priceRanges?: Array<{ min?: number; currency?: string }>;
  dates?: {
    start?: { dateTime?: string; localDate?: string };
    end?: { dateTime?: string };
    timezone?: string;
  };
  _embedded?: {
    attractions?: Array<{ name?: string }>;
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      country?: { countryCode?: string };
      address?: { line1?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
  };
};

const collectArtists = (attractions: Array<{ name?: string }> | undefined) => {
  if (!attractions) return [] as string[];
  const unique = new Set<string>();
  attractions.forEach((item) => {
    const name = (item?.name || "").trim();
    if (name.length >= 2) {
      unique.add(name);
    }
  });
  return Array.from(unique).slice(0, 5);
};

const collectGenres = (classifications: Classification[] | undefined) => {
  if (!classifications) return [];
  const names = new Set<string>();
  classifications.forEach((item) => {
    [item.segment, item.genre, item.subGenre, item.type, item.subType]
      .filter(Boolean)
      .forEach((entry: { name?: string }) => {
        if (entry?.name) names.add(entry.name);
      });
  });
  return Array.from(names);
};

const buildKeyword = (genresParam: string | null) => {
  if (!genresParam) return null;
  const parts = genresParam
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" OR ");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: { status: 405, message: "Method not allowed" } }, 405);
  }

  const apiKey = Deno.env.get("TM_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: { status: 500, message: "TM_API_KEY is not set" } }, 500);
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

  const radiusKm = Number(url.searchParams.get("radiusKm") ?? 50);
  const size = Math.min(Number(url.searchParams.get("size") ?? 20), 50);
  const page = Number(url.searchParams.get("page") ?? 0);

  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const startDateTimeParam = url.searchParams.get("startDateTime");
  const endDateTimeParam = url.searchParams.get("endDateTime");
  const startDateTime = startDateTimeParam ? normalizeIsoParam(startDateTimeParam) : toIsoNoMs(now);
  const endDateTime = endDateTimeParam ? normalizeIsoParam(endDateTimeParam) : toIsoNoMs(defaultEnd);

  const keyword = buildKeyword(url.searchParams.get("genres"));

  const tmUrl = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  tmUrl.searchParams.set("apikey", apiKey);
  tmUrl.searchParams.set("latlong", `${lat},${lng}`);
  tmUrl.searchParams.set("radius", String(radiusKm));
  tmUrl.searchParams.set("unit", "km");
  tmUrl.searchParams.set("classificationName", "music");
  tmUrl.searchParams.set("sort", "date,asc");
  tmUrl.searchParams.set("size", String(size));
  tmUrl.searchParams.set("page", String(page));
  tmUrl.searchParams.set("startDateTime", startDateTime);
  tmUrl.searchParams.set("endDateTime", endDateTime);
  if (keyword) tmUrl.searchParams.set("keyword", keyword);

  let response: Response | null = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    response = await fetch(tmUrl.toString());
    if (response.status !== 429 || attempts === maxAttempts - 1) break;
    const delayMs = 500 * Math.pow(2, attempts);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempts += 1;
  }

  if (!response || !response.ok) {
    const errorText = response ? await response.text() : "";
    return jsonResponse(
      {
        error: {
          status: response?.status ?? 500,
          message: "Ticketmaster request failed",
          details: errorText,
          request: tmUrl.toString().replace(apiKey, "[redacted]"),
        },
      },
      response?.status ?? 500,
    );
  }

  const data = await response.json();
  const events = data?._embedded?.events ?? [];

  const normalized = (events as TicketmasterEvent[]).map((event) => {
    const venue = event?._embedded?.venues?.[0];
    const location = venue?.location;
    const imageUrl = pickBestImage(event.images);
    const startDateTime = event?.dates?.start?.dateTime
      ?? (event?.dates?.start?.localDate ? `${event.dates.start.localDate}T00:00:00Z` : null);

    return {
      id: `tm_${event.id}`,
      source: "ticketmaster",
      sourceId: event.id,
      title: event.name,
      description: event.info || event.pleaseNote || "",
      startTime: startDateTime,
      endTime: event?.dates?.end?.dateTime ?? null,
      timezone: event?.dates?.timezone ?? null,
      venueName: venue?.name ?? null,
      city: venue?.city?.name ?? null,
      country: venue?.country?.countryCode ?? null,
      address: venue?.address?.line1 ?? null,
      lat: location?.latitude ? Number(location.latitude) : null,
      lng: location?.longitude ? Number(location.longitude) : null,
      imageUrl,
      ticketUrl: event.url ?? null,
      priceFrom: event?.priceRanges?.[0]?.min ?? null,
      currency: event?.priceRanges?.[0]?.currency ?? null,
      genres: collectGenres(event?.classifications),
      artists: collectArtists(event?._embedded?.attractions),
    };
  });

  console.log("ticketmaster-events", {
    events: normalized.length,
    page: data?.page?.number ?? page,
    size: data?.page?.size ?? size,
  });

  return jsonResponse({
    events: normalized,
    page: data?.page?.number ?? page,
    size: data?.page?.size ?? size,
    totalPages: data?.page?.totalPages ?? 0,
    totalElements: data?.page?.totalElements ?? 0,
    source: "ticketmaster",
  });
});
