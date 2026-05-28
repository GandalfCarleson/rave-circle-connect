import { normalizeExternalUrl } from '@/lib/openExternal';

export type EventLinkFields = {
  ticket_url?: string | null;
  ticketUrl?: string | null;
  tickets_url?: string | null;
  url?: string | null;
  source_url?: string | null;
  sourceUrl?: string | null;
};

const firstUsableUrl = (urls: Array<string | null | undefined>) =>
  urls
    .map(normalizeExternalUrl)
    .find((url): url is string => Boolean(url));

export function getEventTicketUrl(event: EventLinkFields) {
  return firstUsableUrl([
    event.ticket_url,
    event.ticketUrl,
    event.tickets_url,
    event.url,
    event.source_url,
    event.sourceUrl,
  ]);
}
