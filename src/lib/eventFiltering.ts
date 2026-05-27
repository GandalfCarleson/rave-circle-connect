export type EventFilteringInput = {
  title?: string | null;
  name?: string | null;
  description?: string | null;
  venueName?: string | null;
  venue?: string | null;
  city?: string | null;
  eventType?: string | null;
  source?: string | null;
  sourceId?: string | null;
  providerCategory?: string | null;
  category?: string | null;
  isCurated?: boolean | null;
  genres?: Array<string | null | undefined> | null;
  tags?: Array<string | null | undefined> | null;
  categories?: Array<string | null | undefined> | null;
  artists?: Array<string | null | undefined> | null;
  electronicScore?: number | null;
  lastFmTagged?: boolean | null;
};

export const RAVECIRCLE_ALLOWED_EVENT_TERMS = [
  'electronic',
  'dance',
  'edm',
  'techno',
  'hard techno',
  'hard-techno',
  'house',
  'deep house',
  'tech house',
  'tech-house',
  'trance',
  'hardstyle',
  'rawstyle',
  'hardcore',
  'uptempo',
  'gabber',
  'rave',
  'festival',
  'drum and bass',
  'drum & bass',
  'dnb',
  'dubstep',
  'psytrance',
  'melodic techno',
  'industrial',
  'industrial techno',
  'warehouse',
  'club',
  'club night',
  'nightclub',
  'dj',
] as const;

export const RAVECIRCLE_DENIED_EVENT_TERMS = [
  'jazz',
  'rock',
  'alt rock',
  'alternative',
  'indie',
  'pop',
  'hip hop',
  'hip-hop',
  'hiphop',
  'rap',
  'rnb',
  'r&b',
  'soul',
  'blues',
  'folk',
  'country',
  'classical',
  'opera',
  'musical',
  'museum',
  'museet',
  'entrance',
  'entry ticket',
  'ticket pass',
  'annual pass',
  'season pass',
  'membership',
  'medlemskap',
  'presentkort',
  'gift card',
  'basket',
  'basketball',
  'sport',
  'sports',
  'football',
  'hockey',
  'theatre',
  'theater',
  'stand-up',
  'stand up',
  'comedy',
  'family',
  'children',
  'kids',
] as const;

const STRONG_ALLOWED_TERMS = [
  'techno',
  'hard techno',
  'hard-techno',
  'house',
  'deep house',
  'tech house',
  'trance',
  'hardstyle',
  'rawstyle',
  'hardcore',
  'uptempo',
  'gabber',
  'rave',
  'drum and bass',
  'drum & bass',
  'dnb',
  'dubstep',
  'psytrance',
  'melodic techno',
  'industrial techno',
  'warehouse rave',
  'dj set',
] as const;

const GENERIC_MUSIC_TERMS = ['music', 'concert', 'live music', 'show', 'event', 'tickets'] as const;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const termToRegex = (term: string) => {
  const normalized = normalizeText(term);
  const pattern = normalized
    .split(' ')
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`);
};

const allowedRegexes = RAVECIRCLE_ALLOWED_EVENT_TERMS.map(termToRegex);
const deniedRegexes = RAVECIRCLE_DENIED_EVENT_TERMS.map(termToRegex);
const strongAllowedRegexes = STRONG_ALLOWED_TERMS.map(termToRegex);
const genericMusicRegexes = GENERIC_MUSIC_TERMS.map(termToRegex);

const compactText = (values: Array<string | null | undefined>) =>
  normalizeText(values.filter(Boolean).join(' '));

const compactList = (values?: Array<string | null | undefined> | null) =>
  normalizeText((values || []).filter(Boolean).join(' '));

const hasAny = (text: string, regexes: RegExp[]) => regexes.some(regex => regex.test(text));

export function isRaveCircleRelevantEvent(event: EventFilteringInput) {
  if (event.isCurated || event.source === 'curated') return true;

  const genreText = compactList(event.genres);
  const metadataText = compactText([
    event.title,
    event.name,
    event.description,
    event.venueName,
    event.venue,
    event.city,
    event.eventType,
    event.source,
    event.sourceId,
    event.providerCategory,
    event.category,
    compactList(event.tags),
    compactList(event.categories),
    compactList(event.artists),
  ]);
  const searchableText = `${genreText} ${metadataText}`.trim();
  const scoredElectronic = event.lastFmTagged || (event.electronicScore ?? 0) >= 2;
  const hasAllowedSignal = scoredElectronic || hasAny(searchableText, allowedRegexes);
  const hasStrongAllowedSignal = scoredElectronic || hasAny(searchableText, strongAllowedRegexes);

  if (!hasAllowedSignal) return false;
  if (hasAny(searchableText, deniedRegexes) && !hasStrongAllowedSignal) return false;

  return !hasAny(searchableText, genericMusicRegexes) || hasStrongAllowedSignal;
}
