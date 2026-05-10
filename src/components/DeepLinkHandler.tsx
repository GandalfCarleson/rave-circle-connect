import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const routeFromDeepLink = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'ravecircle:') return null;

    const hostPath = url.hostname ? `/${url.hostname}` : '';
    const pathname = url.pathname === '/' ? '' : url.pathname;
    const route = `${hostPath}${pathname}` || '/';
    return `${route}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

export function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlisten: (() => void) | undefined;

    const openUrls = (urls: string[] | null) => {
      const target = urls?.map(routeFromDeepLink).find(Boolean);
      if (target) {
        navigate(target);
      }
    };

    import('@tauri-apps/plugin-deep-link')
      .then(async ({ getCurrent, onOpenUrl }) => {
        openUrls(await getCurrent());
        unlisten = await onOpenUrl(openUrls);
      })
      .catch(() => {
        // Browser builds do not need the Tauri deep-link bridge.
      });

    return () => {
      unlisten?.();
    };
  }, [navigate]);

  return null;
}
