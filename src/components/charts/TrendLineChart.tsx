'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import type { TrendPoint, DashboardFilters } from '@/types/dashboard';

interface Props {
  filters: DashboardFilters;
}

export function TrendLineChart({ filters }: Props) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      type: 'timeline',
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
      mode: filters.mode,
    });

    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Recebido ao Longo do Tempo
      </h3>
      {loading ? (
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(Number(value || 0)),
                name === 'recebido' ? 'Recebido' : 'Previsto',
              ]}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6',
                fontSize: 12,
              }}
            />
            <Legend formatter={(v) => (v === 'recebido' ? 'Recebido' : 'Previsto')} />
            <Line
              type="monotone"
              dataKey="recebido"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="previsto"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
