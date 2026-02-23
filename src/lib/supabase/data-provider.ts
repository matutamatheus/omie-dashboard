import { supabaseAdmin } from './admin';
import { format, addMonths, startOfDay, subMonths, eachMonthOfInterval } from 'date-fns';
import { classifyAging, AGING_BUCKETS, AgingBucket } from '@/lib/calculations/aging';
import { toISODate, getHorizonRange, HORIZON_LABELS, type HorizonKey } from '@/lib/utils/dates';
import type {
  KPIData,
  AgingBucketData,
  AgingClientData,
  TrendPoint,
  HorizonData,
  TituloRow,
  RecebimentoRow,
  DimensionOptions,
  PaginatedResult,
  DashboardFilters,
} from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the date column name based on the filter mode */
function dateColumn(mode: DashboardFilters['mode']): string {
  return mode === 'previsao' ? 'data_previsao' : 'data_vencimento';
}

/** Today as ISO string (YYYY-MM-DD) */
function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Calculate days overdue from a date string. Returns 0 when not overdue.
 */
function daysOverdueFromString(dateStr: string): number {
  const due = new Date(dateStr);
  const now = startOfDay(new Date());
  const diff = Math.floor((now.getTime() - startOfDay(due).getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/**
 * Fetch all rows from a Supabase query, paginating through 1000-row pages.
 * Supabase PostgREST has a max_rows=1000 default. This helper pages through.
 */
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const results: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    results.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return results;
}

// ---------------------------------------------------------------------------
// 1. getKPIs
// ---------------------------------------------------------------------------

export async function getKPIs(filters: DashboardFilters): Promise<KPIData> {
  const { dateStart, dateEnd, mode } = filters;
  const col = dateColumn(mode);
  const today = todayISO();

  // --- recebido: sum of caixa_recebido from titles in date range ---
  const recebidoRows = await fetchAllRows<{ caixa_recebido: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('caixa_recebido')
      .gte(col, dateStart)
      .lte(col, dateEnd)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const recebido = recebidoRows.reduce(
    (sum, r) => sum + (Number(r.caixa_recebido) || 0),
    0,
  );

  // --- previsto: sum saldo_em_aberto where status in open statuses and date in range ---
  const previstoRows = await fetchAllRows<{ saldo_em_aberto: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('saldo_em_aberto')
      .gte(col, dateStart)
      .lte(col, dateEnd)
      .in('status_titulo', ['A VENCER', 'ATRASADO', 'PARCIAL'])
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const previsto = previstoRows.reduce(
    (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
    0,
  );

  // --- emAtraso: sum saldo_em_aberto where overdue ---
  const atrasoRows = await fetchAllRows<{ saldo_em_aberto: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('saldo_em_aberto')
      .lt('data_vencimento', today)
      .gt('saldo_em_aberto', 0)
      .in('status_titulo', ['ATRASADO', 'PARCIAL', 'A VENCER'])
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const emAtraso = atrasoRows.reduce(
    (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
    0,
  );

  // --- taxaInadimplencia ---
  const taxaInadimplencia =
    previsto + emAtraso > 0 ? (emAtraso / (previsto + emAtraso)) * 100 : 0;

  // --- clientesInadimplentes: distinct cliente_id where overdue ---
  const inadRows = await fetchAllRows<{ cliente_id: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('cliente_id')
      .lt('data_vencimento', today)
      .gt('saldo_em_aberto', 0)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const clientesInadimplentes = new Set(
    inadRows.map((r) => r.cliente_id).filter(Boolean),
  ).size;

  // --- churnRecebiveis: compare current vs previous period ---
  const currentPayments = await fetchAllRows<any>((from, to) =>
    supabaseAdmin
      .from('fact_recebimento')
      .select('titulo_id, fact_titulo_receber!inner(cliente_id)')
      .gte('data_baixa', dateStart)
      .lte('data_baixa', dateEnd)
      .neq('tipo_baixa', 'CANCELADO')
      .range(from, to),
  );

  const currentClients = new Set(
    currentPayments
      .map((r: any) => r.fact_titulo_receber?.cliente_id)
      .filter(Boolean),
  );

  const prevStart = toISODate(subMonths(new Date(dateStart), 1));
  const prevEnd = dateStart;

  const prevPayments = await fetchAllRows<any>((from, to) =>
    supabaseAdmin
      .from('fact_recebimento')
      .select('titulo_id, fact_titulo_receber!inner(cliente_id)')
      .gte('data_baixa', prevStart)
      .lt('data_baixa', prevEnd)
      .neq('tipo_baixa', 'CANCELADO')
      .range(from, to),
  );

  const previousClients = new Set(
    prevPayments
      .map((r: any) => r.fact_titulo_receber?.cliente_id)
      .filter(Boolean),
  );

  let churnRecebiveis = 0;
  if (previousClients.size > 0) {
    let churned = 0;
    for (const clientId of previousClients) {
      if (!currentClients.has(clientId)) {
        churned++;
      }
    }
    churnRecebiveis = (churned / previousClients.size) * 100;
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

// ---------------------------------------------------------------------------
// 2. getAgingBuckets
// ---------------------------------------------------------------------------

export async function getAgingBuckets(filters: DashboardFilters): Promise<AgingBucketData[]> {
  const rows = await fetchAllRows<{ saldo_em_aberto: number; data_vencimento: string }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('saldo_em_aberto, data_vencimento')
      .gt('saldo_em_aberto', 0)
      .not('status_titulo', 'in', '("CANCELADO","LIQUIDADO")')
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const bucketMap = new Map<string, { saldo: number; quantidade: number }>();
  for (const b of AGING_BUCKETS) {
    bucketMap.set(b, { saldo: 0, quantidade: 0 });
  }

  for (const row of rows) {
    const dias = daysOverdueFromString(row.data_vencimento);
    const bucket = classifyAging(dias);
    const entry = bucketMap.get(bucket)!;
    entry.saldo += Number(row.saldo_em_aberto) || 0;
    entry.quantidade += 1;
  }

  return AGING_BUCKETS.map((bucket) => ({
    bucket,
    saldo: bucketMap.get(bucket)!.saldo,
    quantidade: bucketMap.get(bucket)!.quantidade,
  }));
}

// ---------------------------------------------------------------------------
// 3. getAgingByClient
// ---------------------------------------------------------------------------

export async function getAgingByClient(filters: DashboardFilters): Promise<AgingClientData[]> {
  const rows = await fetchAllRows<any>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('cliente_id, saldo_em_aberto, data_vencimento, dim_cliente!inner(razao_social)')
      .gt('saldo_em_aberto', 0)
      .not('status_titulo', 'in', '("CANCELADO","LIQUIDADO")')
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const clientMap = new Map<
    number,
    {
      clienteId: number;
      clienteNome: string;
      buckets: Record<string, number>;
      total: number;
    }
  >();

  for (const row of rows) {
    const clienteId: number = row.cliente_id;
    const clienteNome: string = row.dim_cliente?.razao_social ?? 'Desconhecido';
    const saldo = Number(row.saldo_em_aberto) || 0;
    const dias = daysOverdueFromString(row.data_vencimento);
    const bucket = classifyAging(dias);

    if (!clientMap.has(clienteId)) {
      clientMap.set(clienteId, {
        clienteId,
        clienteNome,
        buckets: {
          [AgingBucket.EM_DIA]: 0,
          [AgingBucket.DAYS_1_30]: 0,
          [AgingBucket.DAYS_31_60]: 0,
          [AgingBucket.DAYS_61_90]: 0,
          [AgingBucket.OVER_90]: 0,
        },
        total: 0,
      });
    }

    const entry = clientMap.get(clienteId)!;
    entry.buckets[bucket] += saldo;
    entry.total += saldo;
  }

  const sorted = Array.from(clientMap.values()).sort((a, b) => b.total - a.total);

  return sorted.slice(0, 15).map((c) => ({
    clienteId: c.clienteId,
    clienteNome: c.clienteNome,
    emDia: c.buckets[AgingBucket.EM_DIA],
    de1a30: c.buckets[AgingBucket.DAYS_1_30],
    de31a60: c.buckets[AgingBucket.DAYS_31_60],
    de61a90: c.buckets[AgingBucket.DAYS_61_90],
    acima90: c.buckets[AgingBucket.OVER_90],
    total: c.total,
  }));
}

// ---------------------------------------------------------------------------
// 4. getTrends
// ---------------------------------------------------------------------------

export async function getTrends(filters: DashboardFilters): Promise<TrendPoint[]> {
  const { dateStart, dateEnd } = filters;
  const start = new Date(dateStart);
  const end = new Date(dateEnd);

  const months = eachMonthOfInterval({ start, end });

  const results: TrendPoint[] = [];

  for (const monthDate of months) {
    const monthStart = toISODate(monthDate);
    const nextMonth = addMonths(monthDate, 1);
    const monthEnd = toISODate(new Date(nextMonth.getTime() - 1));

    const recRows = await fetchAllRows<{ caixa_recebido: number }>((from, to) => {
      const q = supabaseAdmin
        .from('fact_titulo_receber')
        .select('caixa_recebido')
        .gte('data_vencimento', monthStart)
        .lte('data_vencimento', monthEnd)
        .range(from, to);
      applyDimensionFilters(q, filters);
      return q;
    });

    const prevRows = await fetchAllRows<{ saldo_em_aberto: number }>((from, to) => {
      const q = supabaseAdmin
        .from('fact_titulo_receber')
        .select('saldo_em_aberto')
        .gte('data_vencimento', monthStart)
        .lte('data_vencimento', monthEnd)
        .in('status_titulo', ['A VENCER', 'ATRASADO', 'PARCIAL'])
        .range(from, to);
      applyDimensionFilters(q, filters);
      return q;
    });

    const recebido = recRows.reduce(
      (sum, r) => sum + (Number(r.caixa_recebido) || 0),
      0,
    );
    const previsto = prevRows.reduce(
      (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
      0,
    );

    results.push({
      date: format(monthDate, 'MMM/yy'),
      recebido,
      previsto,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 5. getHorizons
// ---------------------------------------------------------------------------

export async function getHorizons(filters: DashboardFilters): Promise<HorizonData[]> {
  const { mode } = filters;
  const col = dateColumn(mode);
  const referenceDate = new Date();
  const horizonKeys: HorizonKey[] = ['today', '7d', '14d', '30d', '60d', '90d', '6m'];

  const results: HorizonData[] = [];

  for (const key of horizonKeys) {
    const range = getHorizonRange(key, referenceDate);
    const rangeStart = toISODate(range.start);
    const rangeEnd = toISODate(range.end);

    const rows = await fetchAllRows<{ saldo_em_aberto: number }>((from, to) => {
      const q = supabaseAdmin
        .from('fact_titulo_receber')
        .select('saldo_em_aberto')
        .gte(col, rangeStart)
        .lte(col, rangeEnd)
        .gt('saldo_em_aberto', 0)
        .not('status_titulo', 'in', '("CANCELADO","LIQUIDADO")')
        .range(from, to);
      applyDimensionFilters(q, filters);
      return q;
    });

    const previsto = rows.reduce(
      (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
      0,
    );

    results.push({
      horizon: key,
      label: HORIZON_LABELS[key],
      previsto,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 6. getTitulos
// ---------------------------------------------------------------------------

export async function getTitulos(
  filters: DashboardFilters,
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedResult<TituloRow>> {
  const { dateStart, dateEnd, mode } = filters;
  const col = dateColumn(mode);

  let query = supabaseAdmin
    .from('fact_titulo_receber')
    .select(
      `
      id,
      numero_documento,
      numero_parcela,
      data_vencimento,
      data_previsao,
      valor_documento,
      saldo_em_aberto,
      caixa_recebido,
      desconto_concedido,
      status_titulo,
      dim_cliente(id, razao_social, cnpj_cpf),
      dim_conta_corrente(descricao),
      dim_vendedor(nome),
      dim_departamento(descricao)
    `,
      { count: 'exact' },
    )
    .gte(col, dateStart)
    .lte(col, dateEnd);

  // Apply status filter
  if (filters.statusTitulo && filters.statusTitulo.length > 0) {
    query = query.in('status_titulo', filters.statusTitulo);
  } else {
    query = query.in('status_titulo', ['A VENCER', 'ATRASADO', 'PARCIAL']);
  }

  applyDimensionFilters(query, filters);

  query = query.order('data_vencimento', { ascending: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: rows, count } = await query;

  const total = count ?? 0;

  const mapped: TituloRow[] = (rows ?? []).map((r: any) => {
    const diasAtraso = daysOverdueFromString(r.data_vencimento);
    const bucket = classifyAging(diasAtraso);

    return {
      id: r.id,
      clienteNome: r.dim_cliente?.razao_social ?? 'Desconhecido',
      clienteCnpjCpf: r.dim_cliente?.cnpj_cpf ?? undefined,
      numeroDocumento: r.numero_documento ?? undefined,
      numeroParcela: r.numero_parcela ?? undefined,
      dataVencimento: format(new Date(r.data_vencimento), 'dd/MM/yyyy'),
      dataPrevisao: r.data_previsao
        ? format(new Date(r.data_previsao), 'dd/MM/yyyy')
        : undefined,
      valorDocumento: Number(r.valor_documento) || 0,
      saldoEmAberto: Number(r.saldo_em_aberto) || 0,
      caixaRecebido: Number(r.caixa_recebido) || 0,
      descontoConcedido: Number(r.desconto_concedido) || 0,
      status: r.status_titulo,
      diasAtraso,
      agingBucket: bucket,
      contaCorrente: r.dim_conta_corrente?.descricao ?? undefined,
      vendedor: r.dim_vendedor?.nome ?? undefined,
      departamento: r.dim_departamento?.descricao ?? undefined,
    };
  });

  return { rows: mapped, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// 7. getRecebimentos
// ---------------------------------------------------------------------------

export async function getRecebimentos(
  filters: DashboardFilters,
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedResult<RecebimentoRow>> {
  const { dateStart, dateEnd } = filters;

  let query = supabaseAdmin
    .from('fact_recebimento')
    .select(
      `
      id,
      titulo_id,
      data_baixa,
      valor_baixado,
      valor_desconto,
      valor_juros,
      valor_multa,
      tipo_baixa,
      liquidado,
      dim_conta_corrente(descricao),
      fact_titulo_receber!inner(
        cliente_id,
        conta_corrente_id,
        departamento_id,
        vendedor_id,
        dim_cliente(razao_social)
      )
    `,
      { count: 'exact' },
    )
    .gte('data_baixa', dateStart)
    .lte('data_baixa', dateEnd);

  if (filters.contaCorrenteId) {
    query = query.eq('fact_titulo_receber.conta_corrente_id', filters.contaCorrenteId);
  }
  if (filters.vendedorId) {
    query = query.eq('fact_titulo_receber.vendedor_id', filters.vendedorId);
  }
  if (filters.departamentoId) {
    query = query.eq('fact_titulo_receber.departamento_id', filters.departamentoId);
  }

  query = query.order('data_baixa', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: rows, count } = await query;

  const total = count ?? 0;

  const mapped: RecebimentoRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    tituloId: r.titulo_id,
    clienteNome:
      r.fact_titulo_receber?.dim_cliente?.razao_social ?? 'Desconhecido',
    dataBaixa: format(new Date(r.data_baixa), 'dd/MM/yyyy'),
    valorBaixado: Number(r.valor_baixado) || 0,
    valorDesconto: Number(r.valor_desconto) || 0,
    valorJuros: Number(r.valor_juros) || 0,
    valorMulta: Number(r.valor_multa) || 0,
    tipoBaixa: r.tipo_baixa ?? undefined,
    liquidado: Boolean(r.liquidado),
    contaCorrente: r.dim_conta_corrente?.descricao ?? undefined,
  }));

  return { rows: mapped, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// 8. getDimensionOptions - Only return dimensions that have associated titles
// ---------------------------------------------------------------------------

export async function getDimensionOptions(): Promise<DimensionOptions> {
  // Fetch distinct FK IDs from fact_titulo_receber to know which dimensions are actually used
  const [ccIdsResult, deptIdsResult, vendIdsResult] = await Promise.all([
    supabaseAdmin
      .from('fact_titulo_receber')
      .select('conta_corrente_id')
      .not('conta_corrente_id', 'is', null)
      .gt('saldo_em_aberto', 0),
    supabaseAdmin
      .from('fact_titulo_receber')
      .select('departamento_id')
      .not('departamento_id', 'is', null)
      .gt('saldo_em_aberto', 0),
    supabaseAdmin
      .from('fact_titulo_receber')
      .select('vendedor_id')
      .not('vendedor_id', 'is', null)
      .gt('saldo_em_aberto', 0),
  ]);

  const ccIds = [...new Set((ccIdsResult.data ?? []).map((r) => r.conta_corrente_id))];
  const deptIds = [...new Set((deptIdsResult.data ?? []).map((r) => r.departamento_id))];
  const vendIds = [...new Set((vendIdsResult.data ?? []).map((r) => r.vendedor_id))];

  // Fetch dimension details only for IDs that exist in titles
  const [ccResult, deptResult, vendResult] = await Promise.all([
    ccIds.length > 0
      ? supabaseAdmin
          .from('dim_conta_corrente')
          .select('id, descricao')
          .in('id', ccIds)
          .order('descricao')
      : { data: [] },
    deptIds.length > 0
      ? supabaseAdmin
          .from('dim_departamento')
          .select('id, descricao')
          .in('id', deptIds)
          .order('descricao')
      : { data: [] },
    vendIds.length > 0
      ? supabaseAdmin
          .from('dim_vendedor')
          .select('id, nome')
          .in('id', vendIds)
          .order('nome')
      : { data: [] },
  ]);

  return {
    contasCorrentes: ((ccResult as any).data ?? []).map((c: any) => ({
      id: c.id,
      label: c.descricao,
    })),
    departamentos: ((deptResult as any).data ?? []).map((d: any) => ({
      id: d.id,
      label: d.descricao,
    })),
    vendedores: ((vendResult as any).data ?? []).map((v: any) => ({
      id: v.id,
      label: v.nome,
    })),
  };
}

// ---------------------------------------------------------------------------
// Shared: apply dimension filters to a query builder
// ---------------------------------------------------------------------------

function applyDimensionFilters(
  query: any,
  filters: DashboardFilters,
): void {
  if (filters.contaCorrenteId) {
    query.eq('conta_corrente_id', filters.contaCorrenteId);
  }
  if (filters.vendedorId) {
    query.eq('vendedor_id', filters.vendedorId);
  }
  if (filters.departamentoId) {
    query.eq('departamento_id', filters.departamentoId);
  }
}
