'use client';

import { cn } from '@/lib/utils/cn';

const PRESETS = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: '7d', label: '7d', days: 7 },
  { key: '14d', label: '14d', days: 14 },
  { key: '30d', label: '30d', days: 30 },
  { key: '60d', label: '60d', days: 60 },
  { key: '90d', label: '90d', days: 90 },
  { key: '6m', label: '6m', days: 180 },
] as const;

interface PeriodSelectorProps {
  selectedPreset: string;
  dateStart: string;
  dateEnd: string;
  onPresetChange: (preset: string, start: string, end: string) => void;
  onCustomChange: (start: string, end: string) => void;
}

export function PeriodSelector({
  selectedPreset,
  dateStart,
  dateEnd,
  onPresetChange,
  onCustomChange,
}: PeriodSelectorProps) {
  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    const end = new Date();
    const start = new Date();
    if (preset.key === 'today') {
      // today only
    } else {
      start.setDate(start.getDate() - preset.days);
    }
    onPresetChange(
      preset.key,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Período:</span>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePreset(p)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              selectedPreset === p.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={dateStart}
          onChange={(e) => onCustomChange(e.target.value, dateEnd)}
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <span className="text-gray-400">—</span>
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => onCustomChange(dateStart, e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );
}
