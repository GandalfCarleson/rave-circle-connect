export type DevProfile = {
  name?: string;
  username?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  genres?: string[];
};

export type DevSession = {
  user: {
    id: string;
    email?: string;
    user_metadata?: { name?: string };
  };
  profile: DevProfile;
  createdAt: string;
};

const DEV_MODE_KEY = 'ravecircle.devMode';
const DEV_SESSION_KEY = 'ravecircle.devSession';

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

export const isDevModeEnabled = () => {
  if (!import.meta.env.DEV) return false;
  return localStorage.getItem(DEV_MODE_KEY) === 'true';
};

export const setDevModeEnabled = (enabled: boolean) => {
  if (!import.meta.env.DEV) return;
  if (enabled) {
    localStorage.setItem(DEV_MODE_KEY, 'true');
  } else {
    localStorage.removeItem(DEV_MODE_KEY);
  }
};

export const loadDevSession = (): DevSession | null => {
  const raw = localStorage.getItem(DEV_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DevSession;
  } catch {
    return null;
  }
};

export const saveDevSession = (session: DevSession) => {
  localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session));
};

export const clearDevSession = () => {
  localStorage.removeItem(DEV_SESSION_KEY);
};

export const createDevSession = (email: string, name?: string): DevSession => {
  return {
    user: {
      id: generateId(),
      email,
      user_metadata: name ? { name } : undefined,
    },
    profile: {
      name,
    },
    createdAt: new Date().toISOString(),
  };
};

export const updateDevProfile = (profileUpdates: DevProfile) => {
  const existing = loadDevSession();
  if (!existing) return null;
  const next = {
    ...existing,
    profile: {
      ...existing.profile,
      ...profileUpdates,
    },
  };
  saveDevSession(next);
  return next;
};

export const setDevGenres = (genres: string[]) => {
  return updateDevProfile({ genres });
};

