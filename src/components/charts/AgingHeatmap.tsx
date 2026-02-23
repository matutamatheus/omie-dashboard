'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { AgingClientData, DashboardFilters } from '@/types/dashboard';

function intensityClass(value: number, max: number): string {
  if (value === 0 || max === 0) return 'bg-gray-50 dark:bg-gray-800 text-gray-400';
  const ratio = value / max;
  if (ratio < 0.1) return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300';
  if (ratio < 0.3) return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
  if (ratio < 0.6) return 'bg-red-200 dark:bg-red-800/50 text-red-900 dark:text-red-100';
  return 'bg-red-300 dark:bg-red-700/60 text-red-950 dark:text-red-50 font-semibold';
}

interface Props {
  filters: DashboardFilters;
}

export function AgingHeatmap({ filters }: Props) {
  const [data, setData] = useState<AgingClientData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);
    params.set('type', 'clients');

    fetch(`/api/dashboard/aging?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const maxVal = Math.max(1, ...data.flatMap((c) => [c.emDia, c.de1a30, c.de31a60, c.de61a90, c.acima90]));

  const buckets = [
    { key: 'emDia' as const, label: 'Em dia' },
    { key: 'de1a30' as const, label: '1-30' },
    { key: 'de31a60' as const, label: '31-60' },
    { key: 'de61a90' as const, label: '61-90' },
    { key: 'acima90' as const, label: '90+' },
  ];

  return (
    <Card className="overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Heatmap Aging por Cliente (Top 15)
      </h3>
      {loading ? (
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nenhum dado encontrado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400 min-w-[180px]">
                  Cliente
                </th>
                {buckets.map((b) => (
                  <th key={b.key} className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400 min-w-[90px]">
                    {b.label}
                  </th>
                ))}
                <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400 min-w-[100px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((client) => (
                <tr key={client.clienteId} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 px-3 text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                    {client.clienteNome.length > 30
                      ? client.clienteNome.substring(0, 30) + '...'
                      : client.clienteNome}
                  </td>
                  {buckets.map((b) => {
                    const val = client[b.key];
                    return (
                      <td key={b.key} className={cn('py-1.5 px-3 text-right rounded-sm', intensityClass(val, maxVal))}>
                        {val > 0 ? formatCurrency(val) : '-'}
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-3 text-right font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(client.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
