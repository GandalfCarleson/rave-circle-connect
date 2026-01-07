import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { EventCard } from './EventCard';

interface MessageBubbleProps {
  text?: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: string;
  isSent: boolean;
  attachedEvent?: {
    id: string;
    name: string;
    venueName?: string;
    city?: string;
    startDatetime: string;
    imageUrl?: string;
    eventType?: string;
  };
  onViewEvent?: () => void;
}

export function MessageBubble({
  text,
  senderName,
  senderAvatar,
  timestamp,
  isSent,
  attachedEvent,
  onViewEvent,
}: MessageBubbleProps) {
  const formattedTime = format(new Date(timestamp), 'HH:mm');

  return (
    <div className={cn('flex gap-2 mb-4', isSent ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isSent && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-muted">
          {senderAvatar ? (
            <img src={senderAvatar} alt={senderName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className={cn('flex flex-col gap-1', isSent ? 'items-end' : 'items-start')}>
        {!isSent && (
          <span className="text-xs text-muted-foreground px-2">{senderName}</span>
        )}

        {text && (
          <div className={cn('message-bubble', isSent ? 'sent' : 'received')}>
            <p className="text-sm">{text}</p>
          </div>
        )}

        {attachedEvent && (
          <div className="max-w-[280px]">
            <EventCard
              {...attachedEvent}
              compact
              onView={onViewEvent}
            />
          </div>
        )}

        <span className="text-[10px] text-muted-foreground px-2">{formattedTime}</span>
      </div>
    </div>
  );
}
