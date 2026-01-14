import { format } from 'date-fns';
import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventCard } from './EventCard';

interface MessageBubbleProps {
  text?: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: string;
  isSent: boolean;
  messageType?: 'text' | 'event' | 'system';
  isRetracted?: boolean;
  editedAt?: string | null;
  replyPreview?: {
    text: string;
    senderName?: string;
    isRetracted?: boolean;
  };
  onReplyPreviewClick?: () => void;
  reactions?: { emoji: string; count: number; reactedByUser?: boolean }[];
  onToggleReaction?: (emoji: string) => void;
  onTogglePicker?: () => void;
  showReactionPicker?: boolean;
  attachedEvent?: {
    id: string;
    name: string;
    venueName?: string;
    city?: string;
    startDatetime: string;
    endDatetime?: string;
    imageUrl?: string;
    eventType?: string;
  };
  onViewEvent?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  pinCount?: number;
  requiredPins?: number;
  readReceipt?: string;
}

export function MessageBubble({
  text,
  senderName,
  senderAvatar,
  timestamp,
  isSent,
  messageType = 'text',
  isRetracted,
  editedAt,
  replyPreview,
  onReplyPreviewClick,
  reactions,
  onToggleReaction,
  onTogglePicker,
  showReactionPicker,
  attachedEvent,
  onViewEvent,
  isPinned,
  onTogglePin,
  pinCount,
  requiredPins,
  readReceipt,
}: MessageBubbleProps) {
  const formattedTime = format(new Date(timestamp), 'HH:mm');
  const pickerEmojis = [':)', ':D', '<3', ';)', '!!'];
  const hasBubbleContent = Boolean(text) || Boolean(replyPreview);

  if (messageType === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-muted-foreground bg-muted/40 px-3 py-1 rounded-full">
          {text || 'System message'}
        </span>
      </div>
    );
  }

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

        {isRetracted ? (
          <div className={cn('message-bubble', isSent ? 'sent' : 'received')}>
            <p className="text-sm text-muted-foreground">Message retracted</p>
          </div>
        ) : (
          hasBubbleContent && (
            <div className={cn('message-bubble', isSent ? 'sent' : 'received')}>
              {replyPreview && (
                <button
                  type="button"
                  onClick={onReplyPreviewClick}
                  className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 mb-1 text-left"
                >
                  <span className="font-medium">
                    {replyPreview.senderName || 'Someone'}
                  </span>
                  {' '}
                  <span>
                    {replyPreview.isRetracted ? 'Original message was retracted' : replyPreview.text}
                  </span>
                </button>
              )}
              {text && <p className="text-sm">{text}</p>}
              {editedAt && (
                <span className="text-[10px] text-muted-foreground block mt-1">edited</span>
              )}
            </div>
          )
        )}

        {showReactionPicker && (
          <div className="flex items-center gap-2 bg-muted/80 px-2 py-1 rounded-full">
            {pickerEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction?.(emoji)}
                className="text-sm hover:scale-110 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {attachedEvent && !isRetracted && (
          <div className="max-w-[280px] relative">
            {messageType === 'event' && (
              <div className="text-xs text-muted-foreground mb-1">
                Shared an event
              </div>
            )}
            <EventCard
              {...attachedEvent}
              compact
              onView={onViewEvent}
            />
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                className={cn(
                  'absolute top-2 right-2 rounded-full border border-border/60 bg-card/80 p-1.5 backdrop-blur-sm',
                  isPinned && 'text-secondary border-secondary/70'
                )}
                aria-label="Pin to crew"
              >
                <Pin className={cn('w-3.5 h-3.5', isPinned && 'fill-current')} />
              </button>
            )}
            {requiredPins && requiredPins > 0 && (
              <div className="mt-2 px-1 text-[11px] text-muted-foreground">
                Pinned by {pinCount ?? 0}/{requiredPins}
              </div>
            )}
          </div>
        )}

        {!isRetracted && reactions && reactions.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2">
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onToggleReaction?.(reaction.emoji)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full border border-border/60 bg-muted/70',
                  reaction.reactedByUser && 'border-primary/70 text-primary'
                )}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-2">
          {!isRetracted && (
            <button
              type="button"
              onClick={onTogglePicker}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              React
            </button>
          )}
          <span className="text-[10px] text-muted-foreground">{formattedTime}</span>
          {readReceipt && (
            <span className="text-[10px] text-muted-foreground">{readReceipt}</span>
          )}
        </div>
      </div>
    </div>
  );
}


