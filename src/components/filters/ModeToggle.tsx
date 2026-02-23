'use client';

import { cn } from '@/lib/utils/cn';

interface ModeToggleProps {
  mode: 'vencimento' | 'previsao';
  onChange: (mode: 'vencimento' | 'previsao') => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Modo:</span>
      <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
        <button
          onClick={() => onChange('vencimento')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'vencimento'
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          )}
        >
          Vencimento
        </button>
        <button
          onClick={() => onChange('previsao')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'previsao'
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          )}
        >
          Previsão
        </button>
      </div>
    </div>
  );
}
