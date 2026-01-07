import { Users, Lock, Globe, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  id: string;
  name: string;
  city?: string;
  isPrivate: boolean;
  memberCount?: number;
  imageUrl?: string;
  onClick?: () => void;
}

export function GroupCard({
  name,
  city,
  isPrivate,
  memberCount = 0,
  imageUrl,
  onClick,
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
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {city}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="text-muted-foreground">
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
