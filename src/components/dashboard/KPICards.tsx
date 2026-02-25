'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatCompactCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import { DollarSign, TrendingUp, AlertTriangle, Percent, Users, FileWarning, Clock, Target } from 'lucide-react';
import type { KPIData, DashboardFilters } from '@/types/dashboard';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  description?: string;
  icon: LucideIcon;
  color: string;
  loading?: boolean;
}

function KPICard({ title, value, subtitle, description, icon: Icon, color, loading }: KPICardProps) {
  const colorClasses: Record<string, { bg: string; icon: string }> = {
    green: { bg: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400' },
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
    red: { bg: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-400' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', icon: 'text-teal-600 dark:text-teal-400' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', icon: 'text-cyan-600 dark:text-cyan-400' },
  };

  const c = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">
            {title}
          </p>
          {loading ? (
            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {value}
              </p>
              {subtitle && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg flex-shrink-0', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
      </div>
      {description && (
        <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
          {description}
        </p>
      )}
    </div>
  );
}

interface KPICardsProps {
  filters: DashboardFilters;
}

export function KPICards({ filters }: KPICardsProps) {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);

    fetch(`/api/dashboard/kpis?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const kpis = [
    {
      title: 'Recebido no Periodo',
      value: data ? formatCompactCurrency(data.recebido) : '',
      subtitle: 'Entrada de caixa no periodo',
      description: 'Soma de todos os valores baixados (pagos) no periodo selecionado nos filtros. Inclui valor principal, juros e multas recebidos.',
      icon: DollarSign,
      color: 'green',
    },
    {
      title: 'A Receber',
      value: data ? formatCompactCurrency(data.aReceber) : '',
      subtitle: 'Saldo total em aberto',
      description: 'Total de saldo em aberto de todos os titulos com valor pendente, independente da data. Representa o quanto a empresa ainda tem a receber.',
      icon: TrendingUp,
      color: 'blue',
    },
    {
      title: 'Vencido',
      value: data ? formatCompactCurrency(data.vencido) : '',
      subtitle: data ? `${data.titulosVencidos} titulo${data.titulosVencidos !== 1 ? 's' : ''} em atraso` : '',
      description: 'Soma do saldo em aberto dos titulos cuja data de vencimento ja passou. Sao valores que deveriam ter sido pagos mas ainda estao pendentes.',
      icon: AlertTriangle,
      color: 'red',
    },
    {
      title: 'Taxa de Inadimplencia',
      value: data ? `${data.taxaInadimplencia.toFixed(1)}%` : '',
      subtitle: 'Vencido / Total a receber',
      description: 'Percentual do valor vencido sobre o total a receber. Indica o nivel de atraso da carteira. Quanto menor, mais saudavel a carteira.',
      icon: Percent,
      color: 'amber',
    },
    {
      title: 'Clientes Inadimplentes',
      value: data ? String(data.clientesInadimplentes) : '',
      subtitle: 'Com titulos vencidos',
      description: 'Quantidade de clientes unicos que possuem pelo menos um titulo vencido com saldo em aberto. Um cliente com varios titulos vencidos conta apenas uma vez.',
      icon: Users,
      color: 'purple',
    },
    {
      title: 'Titulos Vencidos',
      value: data ? String(data.titulosVencidos) : '',
      subtitle: 'Documentos em atraso',
      description: 'Quantidade total de titulos (boletos, notas, parcelas) com data de vencimento anterior a hoje e que ainda possuem saldo em aberto.',
      icon: FileWarning,
      color: 'orange',
    },
    {
      title: 'DSO',
      value: data ? `${data.dso} dias` : '',
      subtitle: 'Days Sales Outstanding',
      description: 'Prazo medio de recebimento em dias. Calcula quantos dias a empresa leva para receber apos a venda. Quanto menor, mais rapido o recebimento.',
      icon: Clock,
      color: 'teal',
    },
    {
      title: 'Taxa de Recebimento',
      value: data ? `${data.taxaRecebimento.toFixed(1)}%` : '',
      subtitle: 'Recebido / Vencido no periodo',
      description: 'Percentual de titulos que venceram no periodo e foram efetivamente recebidos. Quanto mais proximo de 100%, melhor a eficiencia de cobranca.',
      icon: Target,
      color: 'cyan',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <KPICard key={kpi.title} {...kpi} loading={loading} />
      ))}
    </div>
  );
}
