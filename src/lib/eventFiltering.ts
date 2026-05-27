export type EventFilteringInput = {
  title?: string | null;
  name?: string | null;
  description?: string | null;
  venueName?: string | null;
  venue?: string | null;
  city?: string | null;
  eventType?: string | null;
  source?: string | null;
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
  'hard dance',
  'hard-dance',
  'hard techno',
  'hard-techno',
  'house',
  'deep house',
  'tech house',
  'tech-house',
  'trance',
  'hardstyle',
  'hardcore',
  'rawstyle',
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
  'warehouse',
  'club',
  'club night',
  'nightclub',
] as const;

export const RAVECIRCLE_DENIED_EVENT_TERMS = [
  'jazz',
  'indie',
  'acoustic',
  'folk',
  'country',
  'singer-songwriter',
  'singer songwriter',
  'classical',
  'opera',
  'musical',
  'hip hop',
  'hip-hop',
  'hiphop',
  'rap',
  'rnb',
  'r&b',
  'soul',
  'blues',
  'latin',
  'stand-up',
  'stand up',
  'comedy',
] as const;

const GENERIC_MUSIC_TERMS = ['music', 'concert', 'live music', 'show'] as const;

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
    compactList(event.tags),
    compactList(event.categories),
    compactList(event.artists),
  ]);
  const searchableText = `${genreText} ${metadataText}`.trim();
  const hasScoredElectronicSignal = event.lastFmTagged || (event.electronicScore ?? 0) >= 2;
  const hasAllowedSignal = hasScoredElectronicSignal || hasAny(searchableText, allowedRegexes);

  if (!hasAllowedSignal) return false;

  const hasDeniedSignal = hasAny(searchableText, deniedRegexes);
  if (hasDeniedSignal) return false;

  return !hasAny(searchableText, genericMusicRegexes) || hasAllowedSignal;
}
