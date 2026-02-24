'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { HorizonData, DashboardFilters } from '@/types/dashboard';

const COLORS_DARK = ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554', '#0f172a'];
const COLORS_LIGHT = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'];

interface Props {
  filters: DashboardFilters;
}

export function HorizonBarChart({ filters }: Props) {
  const [data, setData] = useState<HorizonData[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const tooltipBg = isDark ? '#1f2937' : '#ffffff';
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb';
  const tooltipText = isDark ? '#f3f4f6' : '#1f2937';

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);
    params.set('type', 'horizons');

    fetch(`/api/dashboard/trends?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          A Receber por Horizonte
        </h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Quanto a empresa tem a receber agrupado por faixas de tempo futuras. Cada barra mostra o saldo em aberto dos titulos que vencem dentro daquele horizonte (ex: 7d = proximos 7 dias, 30d = proximos 30 dias).
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
              formatter={(value) => [formatCurrency(Number(value || 0)), 'Previsto']}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                color: tooltipText,
                fontSize: 12,
              }}
            />
            <Bar dataKey="previsto" radius={[4, 4, 0, 0]}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={colors[idx % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
