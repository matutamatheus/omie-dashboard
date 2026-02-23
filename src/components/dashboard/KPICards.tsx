'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatCompactCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import type { KPIData, DashboardFilters } from '@/types/dashboard';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: string;
  loading?: boolean;
}

function KPICard({ title, value, icon: Icon, color, loading }: KPICardProps) {
  const colorClasses: Record<string, { bg: string; icon: string }> = {
    green: { bg: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400' },
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
    red: { bg: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400' },
  };

  const c = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">
            {title}
          </p>
          {loading ? (
            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {value}
            </p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg flex-shrink-0', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
      </div>
    </div>
  );
}

interface KPICardsProps {
  filters: DashboardFilters;
}

export function KPICards({ filters }: KPICardsProps) {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);

    fetch(`/api/dashboard/kpis?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const kpis = [
    { title: 'Recebido no Período', value: data ? formatCompactCurrency(data.recebido) : '', icon: DollarSign, color: 'green' },
    { title: 'A Receber', value: data ? formatCompactCurrency(data.aReceber) : '', icon: TrendingUp, color: 'blue' },
    { title: 'Vencido', value: data ? formatCompactCurrency(data.vencido) : '', icon: AlertTriangle, color: 'red' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <KPICard key={kpi.title} {...kpi} loading={loading} />
      ))}
    </div>
  );
}
