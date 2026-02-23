'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { DailyReceivable, DashboardFilters } from '@/types/dashboard';

interface Props {
  filters: DashboardFilters;
}

export function DailyReceivablesChart({ filters }: Props) {
  const [data, setData] = useState<DailyReceivable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);

    fetch(`/api/dashboard/daily-receivables?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        A Receber por Dia
      </h3>
      {loading ? (
        <div className="h-72 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nenhum valor a receber no período</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              interval={data.length > 60 ? Math.floor(data.length / 30) : 0}
              angle={data.length > 30 ? -45 : 0}
              textAnchor={data.length > 30 ? 'end' : 'middle'}
              height={data.length > 30 ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value || 0)), 'A Receber']}
              labelFormatter={(label) => `Vencimento: ${label}`}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6',
                fontSize: 12,
              }}
            />
            <Bar dataKey="saldo" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
