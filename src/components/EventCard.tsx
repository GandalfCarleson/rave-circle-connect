import type { SyntheticEvent } from 'react';
import { Calendar, MapPin, Send, Heart, Pin } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GenreChip } from './GenreChip';
import { cn } from '@/lib/utils';

interface EventCardProps {
  id: string;
  name: string;
  venueName?: string;
  city?: string;
  startDatetime: string;
  endDatetime?: string;
  minPrice?: number;
  imageUrl?: string;
  eventType?: string;
  genres?: string[];
  source?: string;
  lastFmTagged?: boolean;
  distance?: number;
  matchReason?: string;
  onView?: () => void;
  onShare?: () => void;
  onToggleInterested?: () => void;
  onTogglePinned?: () => void;
  isInterested?: boolean;
  isPinned?: boolean;
  compact?: boolean;
}

export function EventCard({
  name,
  venueName,
  city,
  startDatetime,
  endDatetime,
  minPrice,
  imageUrl,
  eventType,
  genres = [],
  source,
  lastFmTagged,
  distance,
  matchReason,
  onView,
  onShare,
  onToggleInterested,
  onTogglePinned,
  isInterested,
  isPinned,
  compact = false,
}: EventCardProps) {
  const eventDate = new Date(startDatetime);
  const eventEnd = endDatetime ? new Date(endDatetime) : null;
  const formattedDate = format(eventDate, 'EEE, MMM d');
  const formattedTime = format(eventDate, 'HH:mm');
  const formattedEndTime = eventEnd ? format(eventEnd, 'HH:mm') : null;
  const daySpan = eventEnd ? differenceInCalendarDays(eventEnd, eventDate) : 0;
  const isMultiDay = daySpan > 0;
  const dateRangeLabel = eventEnd
    ? `${format(eventDate, 'MMM d')}–${format(eventEnd, 'MMM d')}`
    : format(eventDate, 'MMM d');
  const timeLabel = formattedEndTime ? `${formattedTime} – ${formattedEndTime}` : formattedTime;
  const eventTypeLabel = eventType
    ? eventType === 'club'
      ? 'Club'
      : eventType === 'festival'
        ? 'Festival'
        : eventType === 'concert'
          ? 'Concert'
          : 'Rave'
    : undefined;
  const eventTypeClass = eventType
    ? eventType === 'club'
      ? 'bg-secondary/90 text-secondary-foreground'
      : eventType === 'festival'
        ? 'bg-primary/90 text-primary-foreground'
        : eventType === 'concert'
          ? 'bg-accent/90 text-accent-foreground'
          : 'bg-muted text-foreground'
    : '';
  const sourceLabel = source === 'ticketmaster'
    ? 'Ticketmaster'
    : source === 'tickster'
      ? 'Tickster'
      : source === 'curated'
        ? 'RaveCircle Pick'
        : source;
  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!event.currentTarget.src.endsWith('/demo-events/fallback-rave.jpg')) {
      event.currentTarget.src = '/demo-events/fallback-rave.jpg';
    }
  };

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="card-neon rounded-xl border border-border/50 overflow-hidden"
      >
        <div className="flex gap-3 p-3">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" onError={handleImageError} />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Calendar className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-display font-semibold text-sm truncate">{name}</h4>
            <p className="text-xs text-muted-foreground truncate">{venueName}</p>
            <p className="text-xs text-primary mt-1">{formattedDate} • {formattedTime}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="card-neon rounded-xl border border-border/50 overflow-hidden group"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Calendar className="w-12 h-12 text-primary/50" />
          </div>
        )}
        <div className="event-image-overlay absolute inset-0 pointer-events-none" />
        
        {/* Event type badge */}
        {eventTypeLabel && (
          <span className={cn('absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium', eventTypeClass)}>
            {eventTypeLabel}
          </span>
        )}
        {(sourceLabel || lastFmTagged) && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            {sourceLabel && (
              <span className="rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                {sourceLabel}
              </span>
            )}
            {lastFmTagged && (
              <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-100 backdrop-blur-sm">
                Last.fm
              </span>
            )}
          </div>
        )}

        {/* Price badge */}
        {minPrice != null && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-card/90 text-foreground text-xs font-medium backdrop-blur-sm">
            {minPrice === 0 ? 'Free' : `from ${minPrice} kr`}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-display font-bold text-lg leading-tight line-clamp-2">{name}</h3>
          <div className="flex items-center gap-2 mt-1.5 text-muted-foreground text-sm">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">
              {venueName && `${venueName}, `}{city}
              {distance != null && ` • ${distance.toFixed(1)} km`}
            </span>
          </div>
        </div>

        {matchReason && (
          <div className="inline-flex rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
            {matchReason}
          </div>
        )}

        {/* Date & Time */}
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <Calendar className="w-4 h-4" />
          {isMultiDay ? (
            <span>{dateRangeLabel} • {daySpan + 1}-day</span>
          ) : (
            <span>{formattedDate} • {timeLabel}</span>
          )}
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genres.slice(0, 3).map((genre) => (
              <GenreChip key={genre} genre={genre} size="sm" />
            ))}
            {genres.length > 3 && (
              <span className="text-xs text-muted-foreground self-center">
                +{genres.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 relative z-10">
          <Button
            onClick={onView}
            className="flex-1 btn-glow bg-primary hover:bg-primary/90"
          >
            View Details
          </Button>
          <Button
            onClick={onToggleInterested}
            variant="outline"
            size="icon"
            disabled={!onToggleInterested}
            className={cn(
              'border-primary/50 hover:bg-primary/10',
              isInterested && 'bg-primary/15 text-primary border-primary/70'
            )}
          >
            <Heart className={cn('w-4 h-4', isInterested && 'fill-current')} />
          </Button>
          <Button
            onClick={onTogglePinned}
            variant="outline"
            size="icon"
            disabled={!onTogglePinned}
            className={cn(
              'border-primary/50 hover:bg-primary/10',
              isPinned && 'bg-secondary/15 text-secondary border-secondary/70'
            )}
          >
            <Pin className={cn('w-4 h-4', isPinned && 'fill-current')} />
          </Button>
          <Button
            onClick={onShare}
            variant="outline"
            size="icon"
            disabled={!onShare}
            className="border-primary/50 hover:bg-primary/10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
