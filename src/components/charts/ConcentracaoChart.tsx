'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { ConcentracaoData, DashboardFilters } from '@/types/dashboard';

const BAR_COLORS = ['#818cf8', '#6366f1', '#4f46e5'];

interface Props {
  filters: DashboardFilters;
}

export function ConcentracaoChart({ filters }: Props) {
  const [data, setData] = useState<ConcentracaoData[]>([]);
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

    fetch(`/api/dashboard/concentracao?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Concentracao de Carteira
        </h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Quanto do total a receber esta concentrado nos maiores clientes. Alta concentracao indica risco — se poucos clientes representam grande parte da carteira.
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
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value, _name, props) => {
                const item = props.payload as ConcentracaoData;
                return [
                  `${formatPercent(Number(value || 0))} (${formatCurrency(item.totalSaldo)})`,
                  'Concentracao',
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
            <Bar dataKey="percentual" radius={[4, 4, 0, 0]}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
