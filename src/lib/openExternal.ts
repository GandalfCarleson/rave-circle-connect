const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const isTauriRuntime = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function normalizeExternalUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function openExternalUrl(url: string | null | undefined) {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) {
    console.warn('[external-link] invalid external URL', { url });
    return false;
  }

  if (isTauriRuntime()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(normalizedUrl);
      return true;
    } catch (error) {
      console.warn('[external-link] Tauri opener failed, falling back to browser tab', {
        url: normalizedUrl,
        error,
      });
    }
  }

  const opened = window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    console.warn('[external-link] browser blocked external URL', { url: normalizedUrl });
    return false;
  }
  opened.opener = null;
  return true;
}
