type CacheEntry = {
  expiresAt: number;
  tags: LastFmArtistTag[];
};

const ARTIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ARTIST_MISS_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4000;
const LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/";

const artistTagCache = new Map<string, CacheEntry>();
const inFlightByArtist = new Map<string, Promise<LastFmArtistTag[]>>();

export type LastFmArtistTag = {
  name: string;
  count: number;
};

const normalizeArtist = (artist: string) =>
  artist
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const runWithConcurrency = async <T>(
  items: string[],
  concurrency: number,
  worker: (item: string) => Promise<T>,
) => {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: T[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: safeConcurrency }).map(async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
};

export class LastFmService {
  constructor(private readonly apiKey: string) {}

  private async fetchTagsFromLastFm(artist: string) {
    const url = new URL(LASTFM_BASE_URL);
    url.searchParams.set("method", "artist.gettoptags");
    url.searchParams.set("artist", artist);
    url.searchParams.set("autocorrect", "1");
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("format", "json");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        return [] as LastFmArtistTag[];
      }

      const payload = await response.json().catch(() => null) as
        | {
            error?: number;
            message?: string;
            toptags?: { tag?: Array<{ name?: string; count?: number | string }> };
          }
        | null;

      if (!payload || payload.error || !payload.toptags?.tag) {
        return [] as LastFmArtistTag[];
      }

      return payload.toptags.tag
        .map((tag) => ({
          name: (tag?.name || "").trim(),
          count: toPositiveInteger(tag?.count),
        }))
        .filter((tag) => tag.name.length > 0 && tag.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    } catch {
      return [] as LastFmArtistTag[];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getTopTags(artist: string): Promise<LastFmArtistTag[]> {
    const normalizedArtist = normalizeArtist(artist);
    if (!normalizedArtist) return [];

    const now = Date.now();
    const cached = artistTagCache.get(normalizedArtist);
    if (cached && cached.expiresAt > now) {
      return cached.tags;
    }

    const inFlight = inFlightByArtist.get(normalizedArtist);
    if (inFlight) {
      return inFlight;
    }

    const request = this.fetchTagsFromLastFm(artist)
      .then((tags) => {
        artistTagCache.set(normalizedArtist, {
          tags,
          expiresAt: now + (tags.length > 0 ? ARTIST_CACHE_TTL_MS : ARTIST_MISS_TTL_MS),
        });
        return tags;
      })
      .finally(() => {
        inFlightByArtist.delete(normalizedArtist);
      });

    inFlightByArtist.set(normalizedArtist, request);
    return request;
  }

  async getTopTagsForArtists(artists: string[], concurrency = 6) {
    const uniqueArtists = Array.from(
      new Set(
        artists
          .map((artist) => artist.trim())
          .filter((artist) => artist.length > 0),
      ),
    );

    const tagsByArtist = new Map<string, LastFmArtistTag[]>();
    await runWithConcurrency(uniqueArtists, concurrency, async (artist) => {
      const tags = await this.getTopTags(artist);
      tagsByArtist.set(artist, tags);
      return tags;
    });
    return tagsByArtist;
  }
}
