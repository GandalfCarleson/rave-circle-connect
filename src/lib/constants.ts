export const GENRES = [
  'Techno',
  'House',
  'Drum & Bass',
  'Trance',
  'EDM',
  'Hardstyle',
  'Dubstep',
  'Minimal',
  'Progressive',
  'Psytrance',
  'Ambient',
  'Industrial',
] as const;

export const EVENT_TYPES = ['festival', 'club', 'rave', 'concert'] as const;

export const RADIUS_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: 0, label: 'No limit' },
] as const;

export const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'This Weekend' },
  { value: 'next-weekend', label: 'Next Weekend' },
  { value: 'month', label: 'This Month' },
] as const;
