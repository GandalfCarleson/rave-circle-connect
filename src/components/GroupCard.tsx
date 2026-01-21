import type { ReactNode } from 'react';
import { Lock, Globe, MapPin, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  id: string;
  name: string;
  city?: string;
  isPrivate: boolean;
  activityText?: string;
  activityNode?: ReactNode;
  activityTimestamp?: string;
  imageUrl?: string;
  onlineCount?: number;
  onClick?: () => void;
  action?: ReactNode;
}

export function GroupCard({
  name,
  city,
  isPrivate,
  activityText,
  activityNode,
  activityTimestamp,
  imageUrl,
  onlineCount,
  onClick,
  action,
}: GroupCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-neon rounded-xl border border-border/50 overflow-hidden cursor-pointer"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Group Avatar */}
        <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/30 to-accent/30">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
          )}
          {onlineCount && onlineCount > 0 && (
            <span className="presence-dot" />
          )}
        </div>

        {/* Group Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-base truncate">{name}</h3>
            {isPrivate ? (
              <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="truncate">
              {activityNode || activityText || 'No messages yet'}
            </div>
            {activityTimestamp && (
              <span className="text-xs text-muted-foreground/70 whitespace-nowrap">{activityTimestamp}</span>
            )}
          </div>
          {city && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/80">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{city}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          {action}
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
