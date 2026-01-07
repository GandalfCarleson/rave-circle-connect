import { cn } from '@/lib/utils';

interface GenreChipProps {
  genre: string;
  isActive?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function GenreChip({ genre, isActive, onClick, size = 'md' }: GenreChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'genre-chip cursor-pointer border border-border/50',
        isActive && 'active',
        size === 'sm' && 'px-2 py-1 text-[10px]',
        !onClick && 'cursor-default'
      )}
    >
      {genre}
    </button>
  );
}
