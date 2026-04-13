export type ArtistClassification = {
  score: number;
  label: "electronic_strong" | "electronic_likely" | "unknown" | "non_electronic";
  matchedPositive: string[];
  matchedNegative: string[];
};

type WeightedTerm = { term: string; weight: number };

const STRONG_ELECTRONIC_TERMS: WeightedTerm[] = [
  { term: "techno", weight: 5 },
  { term: "house", weight: 5 },
  { term: "trance", weight: 5 },
  { term: "drum and bass", weight: 6 },
  { term: "dnb", weight: 6 },
  { term: "dubstep", weight: 5 },
  { term: "hardstyle", weight: 6 },
  { term: "psytrance", weight: 6 },
  { term: "electronic", weight: 4 },
  { term: "electronica", weight: 4 },
  { term: "rave", weight: 5 },
  { term: "edm", weight: 4 },
  { term: "melodic techno", weight: 6 },
  { term: "progressive house", weight: 6 },
  { term: "tech house", weight: 6 },
  { term: "deep house", weight: 5 },
  { term: "electro", weight: 4 },
  { term: "uk garage", weight: 5 },
  { term: "hardcore", weight: 4 },
  { term: "uptempo", weight: 5 },
  { term: "rawstyle", weight: 6 },
  { term: "terror", weight: 4 },
  { term: "garage", weight: 3 },
];

const ADJACENT_TERMS: WeightedTerm[] = [
  { term: "dance", weight: 1 },
  { term: "synthwave", weight: 2 },
  { term: "nu disco", weight: 2 },
  { term: "indie electronic", weight: 2 },
  { term: "alternative dance", weight: 2 },
];

const NON_RELEVANT_TERMS: WeightedTerm[] = [
  { term: "rock", weight: -4 },
  { term: "metal", weight: -4 },
  { term: "country", weight: -4 },
  { term: "jazz", weight: -3 },
  { term: "classical", weight: -5 },
  { term: "singer songwriter", weight: -4 },
  { term: "comedy", weight: -6 },
  { term: "theater", weight: -6 },
  { term: "theatre", weight: -6 },
  { term: "gospel", weight: -4 },
];

const normalizeTag = (tag: string) =>
  tag
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesWeightedTerm = (tag: string, weightedTerm: WeightedTerm) => {
  return tag.includes(weightedTerm.term);
};

export const classifyArtistTags = (tags: string[]): ArtistClassification => {
  if (!tags || tags.length === 0) {
    return { score: 0, label: "unknown", matchedPositive: [], matchedNegative: [] };
  }

  let score = 0;
  const matchedPositive = new Set<string>();
  const matchedNegative = new Set<string>();

  const normalizedTags = tags
    .map(normalizeTag)
    .filter(Boolean);

  for (const tag of normalizedTags) {
    for (const weightedTerm of STRONG_ELECTRONIC_TERMS) {
      if (includesWeightedTerm(tag, weightedTerm)) {
        score += weightedTerm.weight;
        matchedPositive.add(weightedTerm.term);
      }
    }

    for (const weightedTerm of ADJACENT_TERMS) {
      if (includesWeightedTerm(tag, weightedTerm)) {
        score += weightedTerm.weight;
        matchedPositive.add(weightedTerm.term);
      }
    }

    for (const weightedTerm of NON_RELEVANT_TERMS) {
      if (includesWeightedTerm(tag, weightedTerm)) {
        score += weightedTerm.weight;
        matchedNegative.add(weightedTerm.term);
      }
    }
  }

  const label =
    score >= 8
      ? "electronic_strong"
      : score >= 3
        ? "electronic_likely"
        : score <= -4
          ? "non_electronic"
          : "unknown";

  return {
    score,
    label,
    matchedPositive: Array.from(matchedPositive),
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
