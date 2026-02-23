import { differenceInDays, startOfDay } from 'date-fns';
import { classifyAging, type AgingBucket } from './aging';

export interface RawTitulo {
  id: number;
  clienteId: number;
  clienteNome: string;
  valorDocumento: number;
  dataVencimento: Date;
  dataPrevisao?: Date;
  statusTitulo: string;
  numeroDocumento?: string;
  numeroParcela?: string;
  contaCorrenteId?: number;
  contaCorrenteNome?: string;
  vendedorId?: number;
  vendedorNome?: string;
  departamentoId?: number;
  departamentoNome?: string;
}

export interface RawBaixa {
  id: number;
  tituloId: number;
  valorBaixado: number;
  valorDesconto: number;
  valorJuros: number;
  valorMulta: number;
  dataBaixa: Date;
  tipoBaixa: string;
  liquidado: boolean;
  contaCorrenteId?: number;
}

export interface TituloCalculado {
  id: number;
  clienteId: number;
  clienteNome: string;
  numeroDocumento?: string;
  numeroParcela?: string;
  dataVencimento: Date;
  dataPrevisao?: Date;
  valorDocumento: number;
  principalLiquidado: number;
  saldoEmAberto: number;
  caixaRecebido: number;
  descontoConcedido: number;
  diasAtraso: number;
  agingBucket: AgingBucket;
  status: string;
  contaCorrenteNome?: string;
  vendedorNome?: string;
  departamentoNome?: string;
}

/**
 * Calculate per-title metrics from raw data.
 * Rules:
 * - principal_liquidado = sum(valor_baixado + desconto) of active (non-cancelled) payments
 * - saldo_em_aberto = max(0, valor_documento - principal_liquidado)
 * - caixa_recebido = sum(valor_baixado + juros + multa) of active payments
 * - desconto_concedido = sum(desconto) of active payments
 * - Cancelled payments (estornos) are excluded
 * - 100% discount: caixa_recebido = 0 but saldo_em_aberto = 0
 */
export function calculateTituloMetrics(
  titulo: RawTitulo,
  baixas: RawBaixa[],
  referenceDate: Date = new Date()
): TituloCalculado {
  // Filter active payments (exclude cancelled/reversed)
  const activeBaixas = baixas.filter(
    (b) => b.tituloId === titulo.id && b.tipoBaixa !== 'CANCELADO' && b.tipoBaixa !== 'ESTORNO'
  );

  const principalLiquidado = activeBaixas.reduce(
    (sum, b) => sum + b.valorBaixado + b.valorDesconto,
    0
  );

  const saldoEmAberto = Math.max(0, titulo.valorDocumento - principalLiquidado);

  const caixaRecebido = activeBaixas.reduce(
    (sum, b) => sum + b.valorBaixado + b.valorJuros + b.valorMulta,
    0
  );

  const descontoConcedido = activeBaixas.reduce(
    (sum, b) => sum + b.valorDesconto,
    0
  );

  const diasAtraso =
    titulo.statusTitulo === 'CANCELADO'
      ? 0
      : Math.max(
          0,
          differenceInDays(
            startOfDay(referenceDate),
            startOfDay(titulo.dataVencimento)
          )
        );

  // Determine effective status
  let status = titulo.statusTitulo;
  if (status !== 'CANCELADO') {
    if (saldoEmAberto === 0) {
      status = 'LIQUIDADO';
    } else if (diasAtraso > 0 && saldoEmAberto > 0) {
      status = 'ATRASADO';
    } else if (principalLiquidado > 0 && saldoEmAberto > 0) {
      status = 'PARCIAL';
    } else {
      status = 'RECEBER';
    }
  }

  return {
    id: titulo.id,
    clienteId: titulo.clienteId,
    clienteNome: titulo.clienteNome,
    numeroDocumento: titulo.numeroDocumento,
    numeroParcela: titulo.numeroParcela,
    dataVencimento: titulo.dataVencimento,
    dataPrevisao: titulo.dataPrevisao,
    valorDocumento: titulo.valorDocumento,
    principalLiquidado,
    saldoEmAberto,
    caixaRecebido,
    descontoConcedido,
    diasAtraso,
    agingBucket: classifyAging(diasAtraso),
    status,
    contaCorrenteNome: titulo.contaCorrenteNome,
    vendedorNome: titulo.vendedorNome,
    departamentoNome: titulo.departamentoNome,
  };
}
