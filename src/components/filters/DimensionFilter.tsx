'use client';

interface DimensionFilterProps {
  label: string;
  options: { id: number; label: string }[];
  value?: number;
  onChange: (value?: number) => void;
}

export function DimensionFilter({ label, options, value, onChange }: DimensionFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-w-[120px]"
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
