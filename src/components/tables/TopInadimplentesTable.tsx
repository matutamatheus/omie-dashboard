'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { ClienteInadimplente, DashboardFilters } from '@/types/dashboard';

interface Props {
  filters: DashboardFilters;
}

export function TopInadimplentesTable({ filters }: Props) {
  const [data, setData] = useState<ClienteInadimplente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);

    fetch(`/api/dashboard/top-inadimplentes?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const getDiasColor = (dias: number): string => {
    if (dias > 90) return 'text-red-600 dark:text-red-400';
    if (dias > 60) return 'text-orange-500 dark:text-orange-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  return (
    <Card className="overflow-hidden">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Top Clientes Inadimplentes
        </h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Ranking dos 20 maiores clientes com titulos vencidos, ordenados pelo valor total em atraso.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span><strong className="text-gray-500 dark:text-gray-400">#:</strong> Posicao no ranking</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Cliente:</strong> Razao social do devedor</span>
          <span><strong className="text-gray-500 dark:text-gray-400">CNPJ/CPF:</strong> Documento do cliente</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Total Vencido:</strong> Soma do saldo em aberto de titulos vencidos</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Titulos:</strong> Quantidade de titulos em atraso</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Dias Mais Antigo:</strong> Dias de atraso do titulo mais antigo</span>
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs">
                  #
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs">
                  Cliente
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs">
                  CNPJ/CPF
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs">
                  Total Vencido
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs">
                  Titulos
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs">
                  Dias Mais Antigo
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr
                  key={row.clienteId}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="py-2 px-3 text-gray-400 dark:text-gray-500">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                    {row.clienteNome}
                  </td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                    {row.clienteCnpjCpf || '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(row.totalVencido)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                    {row.titulosVencidos}
                  </td>
                  <td className={`py-2 px-3 text-right font-medium ${getDiasColor(row.diasMaisAntigo)}`}>
                    {row.diasMaisAntigo}
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
