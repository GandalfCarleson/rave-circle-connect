import type { LastFmArtistTag } from "./lastFmService.ts";

export type ArtistClassificationState = "electronic" | "adjacent" | "exclude";

export type ArtistClassification = {
  score: number;
  state: ArtistClassificationState;
  hasTagData: boolean;
  hasStrongElectronicTag: boolean;
  matchedStrong: string[];
  matchedWeak: string[];
  matchedNegative: string[];
  overrideApplied?: ArtistClassificationState;
};

type WeightedTerm = { term: string; weight: number };

const STRONG_ELECTRONIC_TERMS: WeightedTerm[] = [
  { term: "melodic techno", weight: 9 },
  { term: "tech house", weight: 9 },
  { term: "deep house", weight: 8 },
  { term: "progressive house", weight: 9 },
  { term: "drum and bass", weight: 10 },
  { term: "dnb", weight: 10 },
  { term: "psytrance", weight: 10 },
  { term: "hardstyle", weight: 9 },
  { term: "bass music", weight: 8 },
  { term: "uk garage", weight: 8 },
  { term: "electronic music", weight: 7 },
  { term: "techno", weight: 8 },
  { term: "house", weight: 7 },
  { term: "trance", weight: 8 },
  { term: "dubstep", weight: 8 },
  { term: "hardcore", weight: 7 },
  { term: "electro", weight: 6 },
  { term: "garage", weight: 5 },
  { term: "rave", weight: 8 },
  { term: "edm", weight: 6 },
  { term: "electronica", weight: 6 },
];

// Broad/noisy tags should have very low influence.
const WEAK_ELECTRONIC_TERMS: WeightedTerm[] = [
  { term: "dance", weight: 0.7 },
  { term: "electronic", weight: 0.5 },
  { term: "club", weight: 0.4 },
  { term: "remix", weight: 0.3 },
  { term: "chill", weight: 0.2 },
  { term: "synthwave", weight: 1.0 },
  { term: "indie electronic", weight: 1.0 },
  { term: "alternative dance", weight: 1.0 },
  { term: "nu disco", weight: 1.0 },
  { term: "nu-disco", weight: 1.0 },
];

const NON_RELEVANT_TERMS: WeightedTerm[] = [
  { term: "latin pop", weight: -8 },
  { term: "hip hop", weight: -7 },
  { term: "rnb", weight: -7 },
  { term: "singer songwriter", weight: -7 },
  { term: "pop", weight: -6 },
  { term: "rap", weight: -6 },
  { term: "soul", weight: -6 },
  { term: "indie", weight: -5 },
  { term: "rock", weight: -6 },
  { term: "jazz", weight: -6 },
  { term: "comedy", weight: -9 },
  { term: "theater", weight: -9 },
  { term: "theatre", weight: -9 },
  { term: "classical", weight: -9 },
  { term: "gospel", weight: -7 },
];

// Small manual override hook for repeat false positives.
const ARTIST_STATE_OVERRIDES: Record<string, ArtistClassificationState> = {
  "pitbull": "exclude",
  "ne yo": "exclude",
  "akon": "exclude",
  "men i trust": "exclude",
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTag = (tag: string) => normalizeText(tag);

const normalizeArtistKey = (artist: string) => normalizeText(artist);

const sortBySpecificity = (terms: WeightedTerm[]) =>
  [...terms].sort((a, b) => b.term.length - a.term.length);

const STRONG_ELECTRONIC_SORTED = sortBySpecificity(STRONG_ELECTRONIC_TERMS);
const WEAK_ELECTRONIC_SORTED = sortBySpecificity(WEAK_ELECTRONIC_TERMS);
const NON_RELEVANT_SORTED = sortBySpecificity(NON_RELEVANT_TERMS);

const findBestMatch = (tag: string, terms: WeightedTerm[]) =>
  terms.find((weightedTerm) => tag.includes(weightedTerm.term)) ?? null;

const tagStrengthFactor = (count: number, maxCount: number, rank: number) => {
  if (maxCount <= 0) return 1;
  const countFactor = 0.45 + 1.15 * (count / maxCount);
  const rankFactor = Math.max(0.6, 1 - (rank * 0.03));
  return Math.max(0.3, Math.min(1.75, countFactor * rankFactor));
};

const ELECTRONIC_MIN_STRONG_SCORE = 5;
const EXCLUDE_MAX_SCORE = -4;

export const classifyArtistTags = (
  tags: LastFmArtistTag[],
  artistName?: string,
): ArtistClassification => {
  const normalizedArtist = artistName ? normalizeArtistKey(artistName) : "";
  const overrideApplied = normalizedArtist ? ARTIST_STATE_OVERRIDES[normalizedArtist] : undefined;
  if (overrideApplied) {
    return {
      score: overrideApplied === "exclude" ? -100 : 100,
      state: overrideApplied,
      hasTagData: true,
      hasStrongElectronicTag: overrideApplied === "electronic",
      matchedStrong: [],
      matchedWeak: [],
      matchedNegative: [],
      overrideApplied,
    };
  }

  if (!tags || tags.length === 0) {
    return {
      score: 0,
      state: "adjacent",
      hasTagData: false,
      hasStrongElectronicTag: false,
      matchedStrong: [],
      matchedWeak: [],
      matchedNegative: [],
    };
  }

  const maxCount = Math.max(...tags.map((tag) => Number.isFinite(tag.count) ? tag.count : 0), 0);
  const matchedStrong = new Set<string>();
  const matchedWeak = new Set<string>();
  const matchedNegative = new Set<string>();

  let strongScore = 0;
  let weakScore = 0;
  let negativeScore = 0;
  let hasStrongElectronicTag = false;

  tags.forEach((rawTag, index) => {
    const normalized = normalizeTag(rawTag.name || "");
    if (!normalized) return;
    const factor = tagStrengthFactor(rawTag.count || 0, maxCount, index);

    const strongMatch = findBestMatch(normalized, STRONG_ELECTRONIC_SORTED);
    if (strongMatch) {
      strongScore += strongMatch.weight * factor;
      matchedStrong.add(strongMatch.term);
      hasStrongElectronicTag = true;
    } else {
      const weakMatch = findBestMatch(normalized, WEAK_ELECTRONIC_SORTED);
      if (weakMatch) {
        weakScore += weakMatch.weight * factor;
        matchedWeak.add(weakMatch.term);
      }
    }

    const negativeMatch = findBestMatch(normalized, NON_RELEVANT_SORTED);
    if (negativeMatch) {
      negativeScore += negativeMatch.weight * factor;
      matchedNegative.add(negativeMatch.term);
    }
  });

  const score = strongScore + weakScore + negativeScore;
  const state: ArtistClassificationState =
    hasStrongElectronicTag && strongScore >= ELECTRONIC_MIN_STRONG_SCORE && score > 1
      ? "electronic"
      : score <= EXCLUDE_MAX_SCORE || (!hasStrongElectronicTag && negativeScore <= -3)
        ? "exclude"
        : "adjacent";

  return {
    score,
    state,
    hasTagData: true,
    hasStrongElectronicTag,
    matchedStrong: Array.from(matchedStrong),
    matchedWeak: Array.from(matchedWeak),
    matchedNegative: Array.from(matchedNegative),
  };
};

const cleanArtistName = (name: string) =>
  name
    .replace(/\s+/g, " ")
    .replace(/\b(?:live|dj set|official)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const splitCollaborators = (name: string) => {
  return name
    .split(/\s*(?:,|\/|\+|\b(?:x|b2b|vs\.?)\b)\s*/i)
    .map((part) => cleanArtistName(part))
    .filter((part) => part.length >= 2);
};

const extractArtistsFromTitle = (title: string) => {
  let value = title.trim();
  if (!value) return [] as string[];

  const presentsMatch = value.match(/\b(?:presents|presenterar)\b\s+(.+)/i);
  if (presentsMatch?.[1]) {
    value = presentsMatch[1].trim();
  }

  value = value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const candidates = [value];
  if (value.includes(" - ")) {
    const [left] = value.split(" - ");
    if (left && left.length >= 2) {
      candidates.push(left.trim());
    }
  }

  return candidates
    .flatMap(splitCollaborators)
    .filter((candidate) => candidate.length >= 2);
};

export const extractArtistCandidates = (
  event: { title?: string | null; artists?: string[] | null },
  max = 3,
) => {
  const names = new Set<string>();

  const providerArtists = (event.artists || [])
    .map(cleanArtistName)
    .filter((artist) => artist.length >= 2);
  for (const artist of providerArtists) {
    names.add(artist);
  }

  if (names.size === 0 && event.title) {
    for (const artist of extractArtistsFromTitle(event.title)) {
      names.add(artist);
    }
  }

  return Array.from(names).slice(0, max);
};
