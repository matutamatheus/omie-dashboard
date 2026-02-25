'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { EvolucaoMensalData, DashboardFilters } from '@/types/dashboard';

interface Props {
  filters: DashboardFilters;
}

export function EvolucaoMensalChart({ filters }: Props) {
  const [data, setData] = useState<EvolucaoMensalData[]>([]);
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

    fetch(`/api/dashboard/evolucao-mensal?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Evolucao Mensal
        </h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Tendencia dos ultimos 12 meses. Recebido (verde) = entrada de caixa. Vencido (vermelho) = valor em atraso. Saldo (azul) = total a receber com vencimento no mes.
        </p>
      </div>
      {loading ? (
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
            <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} stroke={axisColor} />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke={axisColor}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
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
            <Legend
              wrapperStyle={{ fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="recebido"
              name="Recebido"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="vencido"
              name="Vencido"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="saldoEmAberto"
              name="Saldo em Aberto"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
