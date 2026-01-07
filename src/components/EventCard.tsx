import { Calendar, MapPin, Ticket, Share2 } from 'lucide-react';
import { format } from 'date-fns';
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
  minPrice?: number;
  imageUrl?: string;
  eventType?: string;
  genres?: string[];
  distance?: number;
  onView?: () => void;
  onShare?: () => void;
  compact?: boolean;
}

export function EventCard({
  name,
  venueName,
  city,
  startDatetime,
  minPrice,
  imageUrl,
  eventType,
  genres = [],
  distance,
  onView,
  onShare,
  compact = false,
}: EventCardProps) {
  const eventDate = new Date(startDatetime);
  const formattedDate = format(eventDate, 'EEE, MMM d');
  const formattedTime = format(eventDate, 'HH:mm');

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="card-neon rounded-xl border border-border/50 overflow-hidden"
      >
        <div className="flex gap-3 p-3">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
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
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Calendar className="w-12 h-12 text-primary/50" />
          </div>
        )}
        <div className="event-image-overlay absolute inset-0" />
        
        {/* Event type badge */}
        {eventType && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium capitalize">
            {eventType}
          </span>
        )}

        {/* Price badge */}
        {minPrice && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-card/90 text-foreground text-xs font-medium backdrop-blur-sm">
            from {minPrice} kr
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
              {distance && ` • ${distance.toFixed(1)} km`}
            </span>
          </div>
        </div>

        {/* Date & Time */}
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <Calendar className="w-4 h-4" />
          <span>{formattedDate} • {formattedTime}</span>
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
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onView}
            className="flex-1 btn-glow bg-primary hover:bg-primary/90"
          >
            View Details
          </Button>
          <Button
            onClick={onShare}
            variant="outline"
            size="icon"
            className="border-primary/50 hover:bg-primary/10"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
