import { Slider } from '@/components/ui/slider';
import { RADIUS_OPTIONS } from '@/lib/constants';
import { MapPin } from 'lucide-react';

interface RadiusSliderProps {
  value: number;
  onChange: (value: number) => void;
  city?: string;
}

export function RadiusSlider({ value, onChange, city }: RadiusSliderProps) {
  const currentOption = RADIUS_OPTIONS.find(o => o.value === value) || RADIUS_OPTIONS[3];
  const sliderIndex = RADIUS_OPTIONS.findIndex(o => o.value === value);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <span className="font-display font-semibold">{city || 'Set Location'}</span>
        </div>
        <span className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-full">
          {currentOption.label === 'No limit' ? 'Anywhere' : `within ${currentOption.label}`}
        </span>
      </div>
      
      <div className="radius-slider px-1">
        <Slider
          value={[sliderIndex]}
          max={RADIUS_OPTIONS.length - 1}
          step={1}
          onValueChange={([index]) => onChange(RADIUS_OPTIONS[index].value)}
          className="w-full"
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground px-1">
        {RADIUS_OPTIONS.map((option) => (
          <span
            key={option.value}
            className={value === option.value ? 'text-primary font-medium' : ''}
          >
            {option.value === 0 ? '∞' : option.value}
          </span>
        ))}
      </div>
    </div>
  );
}
