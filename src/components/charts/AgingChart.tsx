'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { AgingBucket, DashboardFilters } from '@/types/dashboard';

const BUCKET_COLORS: Record<string, string> = {
  '1-30': '#eab308',
  '31-60': '#f97316',
  '61-90': '#ef4444',
  '90+': '#991b1b',
};

interface Props {
  filters: DashboardFilters;
}

export function AgingChart({ filters }: Props) {
  const [data, setData] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const tooltipBg = isDark ? '#1f2937' : '#ffffff';
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb';
  const tooltipText = isDark ? '#f3f4f6' : '#1f2937';

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);

    fetch(`/api/dashboard/aging?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Curva de Envelhecimento
        </h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Distribuicao do valor vencido por faixa de dias em atraso. Quanto mais a direita, mais antigo e critico o atraso.
        </p>
      </div>
      {loading ? (
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={axisColor} />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke={axisColor}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value, _name, props) => {
                const bucket = props.payload as AgingBucket;
                return [
                  `${formatCurrency(Number(value || 0))} (${bucket.count} titulos)`,
                  'Vencido',
                ];
              }}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                color: tooltipText,
                fontSize: 12,
              }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={BUCKET_COLORS[entry.bucket] || '#eab308'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
