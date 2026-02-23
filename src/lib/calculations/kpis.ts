import type { TituloCalculado } from './titulo-metrics';
import type { KPIData } from '@/types/dashboard';
import { isWithinInterval } from 'date-fns';

interface KPIInput {
  titulos: TituloCalculado[];
  dateStart: Date;
  dateEnd: Date;
  baixas: Array<{
    tituloId: number;
    dataBaixa: Date;
    valorBaixado: number;
    valorJuros: number;
    valorMulta: number;
    tipoBaixa: string;
    clienteId?: number;
  }>;
  previousPeriodClients?: Set<number>;
}

export function calculateKPIs(input: KPIInput): KPIData {
  const { titulos, dateStart, dateEnd, baixas, previousPeriodClients } = input;

  // 1. Recebido (caixa) no período
  const activeBaixasInPeriod = baixas.filter(
    (b) =>
      b.tipoBaixa !== 'CANCELADO' &&
      b.tipoBaixa !== 'ESTORNO' &&
      isWithinInterval(b.dataBaixa, { start: dateStart, end: dateEnd })
  );

  const recebido = activeBaixasInPeriod.reduce(
    (sum, b) => sum + b.valorBaixado + b.valorJuros + b.valorMulta,
    0
  );

  // 2. Previsto (saldo em aberto com vencimento no período)
  const openTitulos = titulos.filter(
    (t) => t.status !== 'CANCELADO' && t.status !== 'LIQUIDADO' && t.saldoEmAberto > 0
  );

  const previsto = openTitulos
    .filter((t) =>
      isWithinInterval(t.dataVencimento, { start: dateStart, end: dateEnd })
    )
    .reduce((sum, t) => sum + t.saldoEmAberto, 0);

  // 3. Em Atraso (saldo vencido)
  const emAtraso = openTitulos
    .filter((t) => t.diasAtraso > 0)
    .reduce((sum, t) => sum + t.saldoEmAberto, 0);

  // 4. Taxa Inadimplência (por valor)
  const totalEmAberto = openTitulos.reduce((sum, t) => sum + t.saldoEmAberto, 0);
  const taxaInadimplencia = totalEmAberto > 0 ? (emAtraso / totalEmAberto) * 100 : 0;

  // 5. Clientes inadimplentes
  const clientesInadimplentes = new Set(
    openTitulos.filter((t) => t.diasAtraso > 0).map((t) => t.clienteId)
  ).size;

  // 6. Churn de recebíveis
  let churnRecebiveis = 0;
  if (previousPeriodClients && previousPeriodClients.size > 0) {
    const currentPeriodClients = new Set(
      activeBaixasInPeriod.filter((b) => b.clienteId).map((b) => b.clienteId!)
    );

    let churned = 0;
    for (const clientId of previousPeriodClients) {
      if (!currentPeriodClients.has(clientId)) {
        churned++;
      }
    }
    churnRecebiveis = (churned / previousPeriodClients.size) * 100;
  }

  return {
    recebido,
    previsto,
    emAtraso,
    taxaInadimplencia,
    clientesInadimplentes,
    churnRecebiveis,
  };
}
