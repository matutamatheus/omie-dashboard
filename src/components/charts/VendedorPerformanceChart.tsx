'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { VendedorPerformance, DashboardFilters } from '@/types/dashboard';

interface Props {
  filters: DashboardFilters;
}

export function VendedorPerformanceChart({ filters }: Props) {
  const [data, setData] = useState<VendedorPerformance[]>([]);
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

    fetch(`/api/dashboard/vendedor-performance?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const chartHeight = Math.max(300, data.length * 45);

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Performance por Vendedor
        </h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Total a receber e valor vencido por vendedor. Vendedores com maior proporcao de vermelho possuem carteiras com mais inadimplencia.
        </p>
      </div>
      {loading ? (
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              stroke={axisColor}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
            />
            <YAxis
              type="category"
              dataKey="vendedorNome"
              tick={{ fontSize: 10 }}
              stroke={axisColor}
              width={120}
            />
            <Tooltip
              formatter={(value, name) => [formatCurrency(Number(value || 0)), name]}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                color: tooltipText,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="totalAReceber"
              name="A Receber"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="totalVencido"
              name="Vencido"
              fill="#ef4444"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
