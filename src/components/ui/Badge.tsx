import { cn } from '@/lib/utils/cn';

const STATUS_COLORS: Record<string, string> = {
  RECEBER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ATRASADO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  PARCIAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  LIQUIDADO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CANCELADO: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  RECEBER: 'Em Aberto',
  ATRASADO: 'Atrasado',
  PARCIAL: 'Parcial',
  LIQUIDADO: 'Liquidado',
  CANCELADO: 'Cancelado',
};

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-800',
        className
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
