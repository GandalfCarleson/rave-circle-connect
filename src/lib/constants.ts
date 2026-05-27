export const GENRES = [
  'Techno',
  'House',
  'Drum & Bass',
  'Trance',
  'EDM',
  'Hardstyle',
  'Hard-Techno',
  'Hardcore',
  'Dubstep',
  'Psytrance',
  'Industrial',
] as const;

export const EVENT_TYPES = ['festival', 'club', 'rave'] as const;

export const RADIUS_OPTIONS = [
  { value: 100, label: 'Local', display: 'Local · 100 km' },
  { value: 300, label: 'Weekend', display: 'Weekend · 300 km' },
  { value: 600, label: 'Weekend+', display: 'Weekend+ · 600 km' },
  { value: 1000, label: 'Mission', display: 'Mission · 1000 km' },
  { value: 1500, label: 'Full Send', display: 'Full Send · 1500+ km' },
] as const;

export const DATE_FILTERS = [
  { value: 'this-week', label: 'This Week' },
  { value: 'next-week', label: 'Next Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
] as const;
