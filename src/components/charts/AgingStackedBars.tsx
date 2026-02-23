'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { AgingBucketData, DashboardFilters } from '@/types/dashboard';

const BUCKET_COLORS: Record<string, string> = {
  'Em dia': '#16a34a',
  '1-30 dias': '#eab308',
  '31-60 dias': '#f97316',
  '61-90 dias': '#ef4444',
  '90+ dias': '#991b1b',
};

interface Props {
  filters: DashboardFilters;
}

export function AgingStackedBars({ filters }: Props) {
  const [data, setData] = useState<AgingBucketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);
    params.set('type', 'buckets');

    fetch(`/api/dashboard/aging?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Saldo em Aberto por Aging
      </h3>
      {loading ? (
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
            />
            <YAxis
              type="category"
              dataKey="bucket"
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              width={90}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value || 0)), 'Saldo']}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6',
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="saldo"
              radius={[0, 4, 4, 0]}
              fill="#3b82f6"
              label={false}
            >
              {data.map((entry, idx) => (
                <rect key={idx} fill={BUCKET_COLORS[entry.bucket] || '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
