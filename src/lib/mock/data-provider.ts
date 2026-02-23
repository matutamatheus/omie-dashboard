import { generateMockData, type MockData } from './generators';
import { calculateTituloMetrics, type RawTitulo, type RawBaixa, type TituloCalculado } from '@/lib/calculations/titulo-metrics';
import { calculateKPIs } from '@/lib/calculations/kpis';
import { calculateAgingBuckets, calculateAgingByClient, AGING_BUCKETS } from '@/lib/calculations/aging';
import { calculateHorizons } from '@/lib/calculations/horizons';
import { classifyAging } from '@/lib/calculations/aging';
import { daysOverdue } from '@/lib/utils/dates';
import { subMonths, isWithinInterval, startOfDay, endOfDay, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, differenceInDays } from 'date-fns';
import type {
  KPIData, AgingBucketData, AgingClientData, TrendPoint, HorizonData,
  TituloRow, RecebimentoRow, DimensionOptions, PaginatedResult, DashboardFilters,
} from '@/types/dashboard';

let cachedData: MockData | null = null;

function getData(): MockData {
  if (!cachedData) {
    cachedData = generateMockData();
  }
  return cachedData;
}

function buildTitulosCalculados(data: MockData): TituloCalculado[] {
  const clienteMap = new Map(data.clientes.map((c) => [c.id, c]));
  const ccMap = new Map(data.contasCorrentes.map((c) => [c.id, c]));
  const vendedorMap = new Map(data.vendedores.map((v) => [v.id, v]));
  const deptMap = new Map(data.departamentos.map((d) => [d.id, d]));

  return data.titulos.map((t) => {
    const cliente = clienteMap.get(t.clienteId);
    const cc = ccMap.get(t.contaCorrenteId);
    const vendedor = vendedorMap.get(t.vendedorId);
    const dept = deptMap.get(t.departamentoId);

    const rawTitulo: RawTitulo = {
      id: t.id,
      clienteId: t.clienteId,
      clienteNome: cliente?.razao_social || 'Desconhecido',
      valorDocumento: t.valorDocumento,
      dataVencimento: t.dataVencimento,
      dataPrevisao: t.dataPrevisao,
      statusTitulo: t.statusTitulo,
      numeroDocumento: t.numeroDocumento,
      numeroParcela: t.numeroParcela,
      contaCorrenteId: t.contaCorrenteId,
      contaCorrenteNome: cc?.descricao,
      vendedorId: t.vendedorId,
      vendedorNome: vendedor?.nome,
      departamentoId: t.departamentoId,
      departamentoNome: dept?.descricao,
    };

    const rawBaixas: RawBaixa[] = data.baixas
      .filter((b) => b.tituloId === t.id)
      .map((b) => ({
        id: b.id,
        tituloId: b.tituloId,
        valorBaixado: b.valorBaixado,
        valorDesconto: b.valorDesconto,
        valorJuros: b.valorJuros,
        valorMulta: b.valorMulta,
        dataBaixa: b.dataBaixa,
        tipoBaixa: b.tipoBaixa,
        liquidado: b.liquidado,
        contaCorrenteId: b.contaCorrenteId,
      }));

    return calculateTituloMetrics(rawTitulo, rawBaixas);
  });
}

function applyFilters(titulos: TituloCalculado[], filters: DashboardFilters): TituloCalculado[] {
  let filtered = titulos;

  if (filters.contaCorrenteId) {
    const data = getData();
    const tituloIds = new Set(
      data.titulos.filter((t) => t.contaCorrenteId === filters.contaCorrenteId).map((t) => t.id)
    );
    filtered = filtered.filter((t) => tituloIds.has(t.id));
  }

  if (filters.vendedorId) {
    const data = getData();
    const tituloIds = new Set(
      data.titulos.filter((t) => t.vendedorId === filters.vendedorId).map((t) => t.id)
    );
    filtered = filtered.filter((t) => tituloIds.has(t.id));
  }

  if (filters.departamentoId) {
    const data = getData();
    const tituloIds = new Set(
      data.titulos.filter((t) => t.departamentoId === filters.departamentoId).map((t) => t.id)
    );
    filtered = filtered.filter((t) => tituloIds.has(t.id));
  }

  if (filters.statusTitulo && filters.statusTitulo.length > 0) {
    const statuses = new Set(filters.statusTitulo);
    filtered = filtered.filter((t) => statuses.has(t.status));
  }

  return filtered;
}

export async function getKPIs(filters: DashboardFilters): Promise<KPIData> {
  const data = getData();
  const titulos = buildTitulosCalculados(data);
  const filtered = applyFilters(titulos, filters);

  const dateStart = new Date(filters.dateStart);
  const dateEnd = new Date(filters.dateEnd);

  const clienteMap = new Map(data.clientes.map((c) => [c.id, c]));
  const tituloClienteMap = new Map(data.titulos.map((t) => [t.id, t.clienteId]));

  const baixasForKPI = data.baixas.map((b) => ({
    tituloId: b.tituloId,
    dataBaixa: b.dataBaixa,
    valorBaixado: b.valorBaixado,
    valorJuros: b.valorJuros,
    valorMulta: b.valorMulta,
    tipoBaixa: b.tipoBaixa,
    clienteId: tituloClienteMap.get(b.tituloId),
  }));

  // Previous period clients for churn
  const periodLengthDays = differenceInDays(dateEnd, dateStart) || 30;
  const prevStart = subMonths(dateStart, 1);
  const prevEnd = dateStart;

  const prevClients = new Set(
    baixasForKPI
      .filter(
        (b) =>
          b.tipoBaixa !== 'CANCELADO' &&
          isWithinInterval(b.dataBaixa, { start: prevStart, end: prevEnd }) &&
          b.clienteId
      )
      .map((b) => b.clienteId!)
  );

  return calculateKPIs({
    titulos: filtered,
    dateStart,
    dateEnd,
    baixas: baixasForKPI,
    previousPeriodClients: prevClients,
  });
}

export async function getAgingBuckets(filters: DashboardFilters): Promise<AgingBucketData[]> {
  const data = getData();
  const titulos = buildTitulosCalculados(data);
  const filtered = applyFilters(titulos, filters).filter(
    (t) => t.status !== 'CANCELADO' && t.status !== 'LIQUIDADO' && t.saldoEmAberto > 0
  );

  const buckets = calculateAgingBuckets(
    filtered.map((t) => ({ saldoEmAberto: t.saldoEmAberto, diasAtraso: t.diasAtraso }))
  );

  return buckets.map((b) => ({
    bucket: b.bucket,
    saldo: b.saldo,
    quantidade: b.quantidade,
  }));
}

export async function getAgingByClient(filters: DashboardFilters): Promise<AgingClientData[]> {
  const data = getData();
  const titulos = buildTitulosCalculados(data);
  const filtered = applyFilters(titulos, filters).filter(
    (t) => t.status !== 'CANCELADO' && t.status !== 'LIQUIDADO' && t.saldoEmAberto > 0
  );

  const agingClients = calculateAgingByClient(
    filtered.map((t) => ({
      clienteId: t.clienteId,
      clienteNome: t.clienteNome,
      saldoEmAberto: t.saldoEmAberto,
      diasAtraso: t.diasAtraso,
    }))
  );

  return agingClients.slice(0, 15).map((c) => ({
    clienteId: c.clienteId,
    clienteNome: c.clienteNome,
    emDia: c.buckets[AGING_BUCKETS[0]],
    de1a30: c.buckets[AGING_BUCKETS[1]],
    de31a60: c.buckets[AGING_BUCKETS[2]],
    de61a90: c.buckets[AGING_BUCKETS[3]],
    acima90: c.buckets[AGING_BUCKETS[4]],
    total: c.total,
  }));
}

export async function getTrends(filters: DashboardFilters): Promise<TrendPoint[]> {
  const data = getData();
  const dateStart = new Date(filters.dateStart);
  const dateEnd = new Date(filters.dateEnd);
  const days = differenceInDays(dateEnd, dateStart);

  // Group by day/week/month based on range
  let intervals: Date[];
  let formatStr: string;

  if (days <= 31) {
    intervals = eachDayOfInterval({ start: dateStart, end: dateEnd });
    formatStr = 'dd/MM';
  } else if (days <= 90) {
    intervals = eachWeekOfInterval({ start: dateStart, end: dateEnd });
    formatStr = 'dd/MM';
  } else {
    intervals = eachMonthOfInterval({ start: dateStart, end: dateEnd });
    formatStr = 'MMM/yy';
  }

  const tituloClienteMap = new Map(data.titulos.map((t) => [t.id, t.clienteId]));

  return intervals.map((date) => {
    const dayStart = startOfDay(date);
    const dayEnd = days <= 31 ? endOfDay(date) : (intervals[intervals.indexOf(date) + 1] ? startOfDay(intervals[intervals.indexOf(date) + 1]) : endOfDay(date));

    const recebido = data.baixas
      .filter(
        (b) =>
          b.tipoBaixa !== 'CANCELADO' &&
          isWithinInterval(b.dataBaixa, { start: dayStart, end: dayEnd })
      )
      .reduce((sum, b) => sum + b.valorBaixado + b.valorJuros + b.valorMulta, 0);

    const previsto = data.titulos
      .filter(
        (t) =>
          t.statusTitulo !== 'CANCELADO' &&
          isWithinInterval(t.dataVencimento, { start: dayStart, end: dayEnd })
      )
      .reduce((sum, t) => sum + t.valorDocumento, 0);

    return {
      date: format(date, formatStr),
      recebido,
      previsto,
    };
  });
}

export async function getHorizons(filters: DashboardFilters): Promise<HorizonData[]> {
  const data = getData();
  const titulos = buildTitulosCalculados(data);
  const filtered = applyFilters(titulos, filters);

  const horizons = calculateHorizons(filtered, filters.mode, new Date());

  return horizons.map((h) => ({
    horizon: h.key,
    label: h.label,
    previsto: h.previsto,
  }));
}

export async function getTitulos(
  filters: DashboardFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResult<TituloRow>> {
  const data = getData();
  const titulos = buildTitulosCalculados(data);
  let filtered = applyFilters(titulos, filters);

  // Default: show only open titles
  if (!filters.statusTitulo || filters.statusTitulo.length === 0) {
    filtered = filtered.filter((t) => ['RECEBER', 'ATRASADO', 'PARCIAL'].includes(t.status));
  }

  // Sort by days overdue desc
  filtered.sort((a, b) => b.diasAtraso - a.diasAtraso);

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize).map((t) => ({
    id: t.id,
    clienteNome: t.clienteNome,
    numeroDocumento: t.numeroDocumento,
    numeroParcela: t.numeroParcela,
    dataVencimento: format(t.dataVencimento, 'dd/MM/yyyy'),
    dataPrevisao: t.dataPrevisao ? format(t.dataPrevisao, 'dd/MM/yyyy') : undefined,
    valorDocumento: t.valorDocumento,
    saldoEmAberto: t.saldoEmAberto,
    caixaRecebido: t.caixaRecebido,
    descontoConcedido: t.descontoConcedido,
    status: t.status,
    diasAtraso: t.diasAtraso,
    agingBucket: t.agingBucket,
    contaCorrente: t.contaCorrenteNome,
    vendedor: t.vendedorNome,
    departamento: t.departamentoNome,
  }));

  return { rows, total, page, pageSize };
}

export async function getRecebimentos(
  filters: DashboardFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResult<RecebimentoRow>> {
  const data = getData();
  const dateStart = new Date(filters.dateStart);
  const dateEnd = new Date(filters.dateEnd);

  const clienteMap = new Map(data.clientes.map((c) => [c.id, c]));
  const tituloMap = new Map(data.titulos.map((t) => [t.id, t]));
  const ccMap = new Map(data.contasCorrentes.map((c) => [c.id, c]));

  let filtered = data.baixas.filter((b) =>
    isWithinInterval(b.dataBaixa, { start: dateStart, end: dateEnd })
  );

  // Sort by date desc
  filtered.sort((a, b) => b.dataBaixa.getTime() - a.dataBaixa.getTime());

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize).map((b) => {
    const titulo = tituloMap.get(b.tituloId);
    const cliente = titulo ? clienteMap.get(titulo.clienteId) : undefined;
    const cc = ccMap.get(b.contaCorrenteId);

    return {
      id: b.id,
      tituloId: b.tituloId,
      clienteNome: cliente?.razao_social || 'Desconhecido',
      dataBaixa: format(b.dataBaixa, 'dd/MM/yyyy'),
      valorBaixado: b.valorBaixado,
      valorDesconto: b.valorDesconto,
      valorJuros: b.valorJuros,
      valorMulta: b.valorMulta,
      tipoBaixa: b.tipoBaixa,
      liquidado: b.liquidado,
      contaCorrente: cc?.descricao,
    };
  });

  return { rows, total, page, pageSize };
}

export async function getDimensionOptions(): Promise<DimensionOptions> {
  const data = getData();

  return {
    contasCorrentes: data.contasCorrentes.map((c) => ({ id: c.id, label: c.descricao })),
    departamentos: data.departamentos.map((d) => ({ id: d.id, label: d.descricao })),
    vendedores: data.vendedores.map((v) => ({ id: v.id, label: v.nome })),
  };
}
