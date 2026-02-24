'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RecebimentoRow, DashboardFilters, PaginatedResult } from '@/types/dashboard';

interface Props {
  filters: DashboardFilters;
}

export function RecebimentosTable({ filters }: Props) {
  const [result, setResult] = useState<PaginatedResult<RecebimentoRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);
    params.set('page', String(page));
    params.set('pageSize', '20');

    fetch(`/api/dashboard/recebimentos?${params}`)
      .then((r) => r.json())
      .then(setResult)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, page]);

  const rows = result?.rows || [];
  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 1;

  return (
    <Card className="overflow-hidden">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Recebimentos / Baixas no Periodo
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {result ? `${result.total} registros` : ''}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Registro de todos os pagamentos recebidos no periodo selecionado. Cada linha representa uma baixa (pagamento) vinculada a um titulo.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span><strong className="text-gray-500 dark:text-gray-400">Data Baixa:</strong> Quando o pagamento foi registrado</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Cliente:</strong> Quem efetuou o pagamento</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Valor:</strong> Valor principal pago</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Desconto:</strong> Abatimento concedido na baixa</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Juros:</strong> Juros cobrados por atraso</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Multa:</strong> Multa cobrada por atraso</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Tipo:</strong> Forma de pagamento (boleto, PIX, etc)</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Conta Corrente:</strong> Conta bancaria de destino</span>
        </div>
      </div>

      {loading ? (
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Data Baixa</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Cliente</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Valor</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Desconto</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Juros</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Multa</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Tipo</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400">Conta Corrente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.dataBaixa}</td>
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{row.clienteNome}</td>
                    <td className="py-2 px-3 text-right font-medium text-green-600 dark:text-green-400">{formatCurrency(row.valorBaixado)}</td>
                    <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">{row.valorDesconto > 0 ? formatCurrency(row.valorDesconto) : '-'}</td>
                    <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">{row.valorJuros > 0 ? formatCurrency(row.valorJuros) : '-'}</td>
                    <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">{row.valorMulta > 0 ? formatCurrency(row.valorMulta) : '-'}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.tipoBaixa}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400 max-w-[150px] truncate">{row.contaCorrente}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                      Nenhum recebimento no periodo selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-3">
              <span className="text-xs text-gray-400 dark:text-gray-500">Pagina {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
