import { supabaseAdmin } from './admin';
import { format, startOfDay } from 'date-fns';
import { toISODate, getHorizonRange, HORIZON_LABELS, type HorizonKey } from '@/lib/utils/dates';
import type {
  KPIData,
  HorizonData,
  DailyReceivable,
  TituloRow,
  RecebimentoRow,
  DimensionOptions,
  PaginatedResult,
  DashboardFilters,
  AgingBucket,
  ClienteInadimplente,
  ConcentracaoData,
  EvolucaoMensalData,
  VendedorPerformance,
} from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return toISODate(new Date());
}

function daysOverdueFromString(dateStr: string): number {
  const due = new Date(dateStr);
  const now = startOfDay(new Date());
  const diff = Math.floor((now.getTime() - startOfDay(due).getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

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
// 1. getKPIs - 3 metricas simples
// ---------------------------------------------------------------------------

export async function getKPIs(filters: DashboardFilters): Promise<KPIData> {
  const { dateStart, dateEnd } = filters;
  const today = todayISO();

  // recebido: entrada de caixa no periodo (from fact_recebimento)
  const needsJoin = hasDimensionFilters(filters);
  const recebSelect = needsJoin
    ? 'valor_baixado, valor_juros, valor_multa, fact_titulo_receber!inner(conta_corrente_id, vendedor_id, departamento_id)'
    : 'valor_baixado, valor_juros, valor_multa';

  const recebidoRows = await fetchAllRows<{ valor_baixado: number; valor_juros: number; valor_multa: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_recebimento')
      .select(recebSelect)
      .gte('data_baixa', dateStart)
      .lte('data_baixa', dateEnd)
      .range(from, to);
    if (needsJoin) applyRecebDimensionFilters(q, filters);
    return q;
  });

  const recebido = recebidoRows.reduce(
    (sum, r) => sum + (Number(r.valor_baixado) || 0) + (Number(r.valor_juros) || 0) + (Number(r.valor_multa) || 0),
    0,
  );

  // aReceber: total de saldo em aberto (sem filtro de data - visao completa)
  const aReceberRows = await fetchAllRows<{ saldo_em_aberto: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('saldo_em_aberto')
      .gt('saldo_em_aberto', 0)
      // saldo > 0 already excludes LIQUIDADO/CANCELADO (saldo = 0)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const aReceber = aReceberRows.reduce(
    (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
    0,
  );

  // vencido: titulos com vencimento < hoje e saldo > 0 (com cliente_id para contar inadimplentes)
  const vencidoRows = await fetchAllRows<{ saldo_em_aberto: number; cliente_id: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('saldo_em_aberto, cliente_id')
      .lt('data_vencimento', today)
      .gt('saldo_em_aberto', 0)
      // saldo > 0 already excludes LIQUIDADO/CANCELADO (saldo = 0)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const vencido = vencidoRows.reduce(
    (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
    0,
  );

  const titulosVencidos = vencidoRows.length;
  const clientesInadimplentes = new Set(vencidoRows.map((r) => r.cliente_id)).size;
  const taxaInadimplencia = aReceber > 0 ? (vencido / aReceber) * 100 : 0;

  // DSO: (aReceber / recebido) * diasDoPeriodo
  const diasDoPeriodo = Math.max(1,
    Math.ceil((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / (1000 * 60 * 60 * 24))
  );
  const dso = recebido > 0 ? Math.round((aReceber / recebido) * diasDoPeriodo) : 0;

  // Taxa de Recebimento: recebido / valor que venceu no periodo
  const dueInPeriodRows = await fetchAllRows<{ valor_documento: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('valor_documento')
      .gte('data_vencimento', dateStart)
      .lte('data_vencimento', dateEnd)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });
  const totalDueInPeriod = dueInPeriodRows.reduce(
    (sum, r) => sum + (Number(r.valor_documento) || 0), 0
  );
  const taxaRecebimento = totalDueInPeriod > 0 ? (recebido / totalDueInPeriod) * 100 : 0;

  return { recebido, aReceber, vencido, taxaInadimplencia, clientesInadimplentes, titulosVencidos, dso, taxaRecebimento };
}

// ---------------------------------------------------------------------------
// 2. getHorizons - A Receber por horizonte futuro
// ---------------------------------------------------------------------------

export async function getHorizons(filters: DashboardFilters): Promise<HorizonData[]> {
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
        .gte('data_vencimento', rangeStart)
        .lte('data_vencimento', rangeEnd)
        .gt('saldo_em_aberto', 0)
        // saldo > 0 already excludes LIQUIDADO/CANCELADO (saldo = 0)
        .range(from, to);
      applyDimensionFilters(q, filters);
      return q;
    });

    const previsto = rows.reduce(
      (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
      0,
    );

    results.push({ horizon: key, label: HORIZON_LABELS[key], previsto });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. getDailyReceivables - A Receber por dia
// ---------------------------------------------------------------------------

export async function getDailyReceivables(
  filters: DashboardFilters,
  rangeStart?: string,
  rangeEnd?: string,
): Promise<DailyReceivable[]> {
  const start = rangeStart || todayISO();
  const end = rangeEnd || toISODate(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));

  // Vencimentos (a receber) por dia
  const tituloRows = await fetchAllRows<{ data_vencimento: string; saldo_em_aberto: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('data_vencimento, saldo_em_aberto')
      .gt('saldo_em_aberto', 0)
      // saldo > 0 already excludes LIQUIDADO/CANCELADO (saldo = 0)
      .gte('data_vencimento', start)
      .lte('data_vencimento', end)
      .order('data_vencimento', { ascending: true })
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  // Recebimentos (baixas) por dia
  const needsRecebJoin = hasDimensionFilters(filters);
  const recebSelectFields = needsRecebJoin
    ? 'data_baixa, valor_baixado, valor_juros, valor_multa, fact_titulo_receber!inner(conta_corrente_id, vendedor_id, departamento_id)'
    : 'data_baixa, valor_baixado, valor_juros, valor_multa';

  const recebRows = await fetchAllRows<{ data_baixa: string; valor_baixado: number; valor_juros: number; valor_multa: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_recebimento')
      .select(recebSelectFields)
      .gte('data_baixa', start)
      .lte('data_baixa', end)
      .order('data_baixa', { ascending: true })
      .range(from, to);
    if (needsRecebJoin) applyRecebDimensionFilters(q, filters);
    return q;
  });

  const saldoByDay = new Map<string, number>();
  for (const r of tituloRows) {
    const d = r.data_vencimento;
    saldoByDay.set(d, (saldoByDay.get(d) || 0) + (Number(r.saldo_em_aberto) || 0));
  }

  const recebByDay = new Map<string, number>();
  for (const r of recebRows) {
    const d = r.data_baixa;
    const val = (Number(r.valor_baixado) || 0) + (Number(r.valor_juros) || 0) + (Number(r.valor_multa) || 0);
    recebByDay.set(d, (recebByDay.get(d) || 0) + val);
  }

  const allDates = new Set([...saldoByDay.keys(), ...recebByDay.keys()]);

  return Array.from(allDates)
    .sort((a, b) => a.localeCompare(b))
    .map((dateISO) => ({
      date: format(new Date(dateISO), 'dd/MM'),
      dateISO,
      saldo: saldoByDay.get(dateISO) || 0,
      recebido: recebByDay.get(dateISO) || 0,
    }));
}

// ---------------------------------------------------------------------------
// 4. getTitulos
// ---------------------------------------------------------------------------

export async function getTitulos(
  filters: DashboardFilters,
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedResult<TituloRow>> {
  let query = supabaseAdmin
    .from('fact_titulo_receber')
    .select(
      `id, numero_documento, numero_parcela, data_vencimento, valor_documento,
       saldo_em_aberto, status_titulo,
       dim_cliente(id, razao_social, cnpj_cpf),
       dim_conta_corrente(descricao),
       dim_vendedor(nome),
       dim_departamento(descricao)`,
      { count: 'exact' },
    );

  if (filters.statusTitulo && filters.statusTitulo.length > 0) {
    query = query.in('status_titulo', filters.statusTitulo);
  } else {
    query = query.in('status_titulo', ['A VENCER', 'ATRASADO', 'PARCIAL']);
  }

  // Period filter on data_vencimento
  if (filters.dateStart) query = query.gte('data_vencimento', filters.dateStart);
  if (filters.dateEnd) query = query.lte('data_vencimento', filters.dateEnd);

  applyDimensionFilters(query, filters);
  query = query.order('data_vencimento', { ascending: true });

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data: rows, count } = await query;

  const mapped: TituloRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    clienteNome: r.dim_cliente?.razao_social ?? 'Desconhecido',
    clienteCnpjCpf: r.dim_cliente?.cnpj_cpf ?? undefined,
    numeroDocumento: r.numero_documento ?? undefined,
    numeroParcela: r.numero_parcela ?? undefined,
    dataVencimento: format(new Date(r.data_vencimento), 'dd/MM/yyyy'),
    valorDocumento: Number(r.valor_documento) || 0,
    saldoEmAberto: Number(r.saldo_em_aberto) || 0,
    status: r.status_titulo,
    diasAtraso: daysOverdueFromString(r.data_vencimento),
    contaCorrente: r.dim_conta_corrente?.descricao ?? undefined,
    vendedor: r.dim_vendedor?.nome ?? undefined,
    departamento: r.dim_departamento?.descricao ?? undefined,
  }));

  return { rows: mapped, total: count ?? 0, page, pageSize };
}

// ---------------------------------------------------------------------------
// 4. getRecebimentos
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
      `id, titulo_id, data_baixa, valor_baixado, valor_desconto, valor_juros, valor_multa,
       tipo_baixa, liquidado, dim_conta_corrente(descricao),
       fact_titulo_receber!inner(cliente_id, conta_corrente_id, departamento_id, vendedor_id, dim_cliente(razao_social))`,
      { count: 'exact' },
    )
    .gte('data_baixa', dateStart)
    .lte('data_baixa', dateEnd);

  if (filters.contaCorrenteId) query = query.eq('fact_titulo_receber.conta_corrente_id', filters.contaCorrenteId);
  if (filters.vendedorId) query = query.eq('fact_titulo_receber.vendedor_id', filters.vendedorId);
  if (filters.departamentoId) query = query.eq('fact_titulo_receber.departamento_id', filters.departamentoId);

  query = query.order('data_baixa', { ascending: false });

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data: rows, count } = await query;

  const mapped: RecebimentoRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    tituloId: r.titulo_id,
    clienteNome: r.fact_titulo_receber?.dim_cliente?.razao_social ?? 'Desconhecido',
    dataBaixa: format(new Date(r.data_baixa), 'dd/MM/yyyy'),
    valorBaixado: Number(r.valor_baixado) || 0,
    valorDesconto: Number(r.valor_desconto) || 0,
    valorJuros: Number(r.valor_juros) || 0,
    valorMulta: Number(r.valor_multa) || 0,
    tipoBaixa: r.tipo_baixa ?? undefined,
    liquidado: Boolean(r.liquidado),
    contaCorrente: r.dim_conta_corrente?.descricao ?? undefined,
  }));

  return { rows: mapped, total: count ?? 0, page, pageSize };
}

// ---------------------------------------------------------------------------
// 5. getDimensionOptions
// ---------------------------------------------------------------------------

export async function getDimensionOptions(): Promise<DimensionOptions> {
  const [ccIdsResult, deptIdsResult, vendIdsResult] = await Promise.all([
    supabaseAdmin.from('fact_titulo_receber').select('conta_corrente_id').not('conta_corrente_id', 'is', null).gt('saldo_em_aberto', 0),
    supabaseAdmin.from('fact_titulo_receber').select('departamento_id').not('departamento_id', 'is', null).gt('saldo_em_aberto', 0),
    supabaseAdmin.from('fact_titulo_receber').select('vendedor_id').not('vendedor_id', 'is', null).gt('saldo_em_aberto', 0),
  ]);

  const ccIds = [...new Set((ccIdsResult.data ?? []).map((r) => r.conta_corrente_id))];
  const deptIds = [...new Set((deptIdsResult.data ?? []).map((r) => r.departamento_id))];
  const vendIds = [...new Set((vendIdsResult.data ?? []).map((r) => r.vendedor_id))];

  const [ccResult, deptResult, vendResult] = await Promise.all([
    ccIds.length > 0 ? supabaseAdmin.from('dim_conta_corrente').select('id, descricao').in('id', ccIds).order('descricao') : { data: [] },
    deptIds.length > 0 ? supabaseAdmin.from('dim_departamento').select('id, descricao').in('id', deptIds).order('descricao') : { data: [] },
    vendIds.length > 0 ? supabaseAdmin.from('dim_vendedor').select('id, nome').in('id', vendIds).order('nome') : { data: [] },
  ]);

  return {
    contasCorrentes: ((ccResult as any).data ?? []).map((c: any) => ({ id: c.id, label: c.descricao })),
    departamentos: ((deptResult as any).data ?? []).map((d: any) => ({ id: d.id, label: d.descricao })),
    vendedores: ((vendResult as any).data ?? []).map((v: any) => ({ id: v.id, label: v.nome })),
  };
}

// ---------------------------------------------------------------------------
// 6. getAgingAnalysis
// ---------------------------------------------------------------------------

export async function getAgingAnalysis(filters: DashboardFilters): Promise<AgingBucket[]> {
  const today = todayISO();

  const rows = await fetchAllRows<{ data_vencimento: string; saldo_em_aberto: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('data_vencimento, saldo_em_aberto')
      .lt('data_vencimento', today)
      .gt('saldo_em_aberto', 0)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const buckets: Record<string, { total: number; count: number }> = {
    '1-30': { total: 0, count: 0 },
    '31-60': { total: 0, count: 0 },
    '61-90': { total: 0, count: 0 },
    '90+': { total: 0, count: 0 },
  };

  for (const r of rows) {
    const days = daysOverdueFromString(r.data_vencimento);
    const saldo = Number(r.saldo_em_aberto) || 0;
    if (days <= 30) { buckets['1-30'].total += saldo; buckets['1-30'].count++; }
    else if (days <= 60) { buckets['31-60'].total += saldo; buckets['31-60'].count++; }
    else if (days <= 90) { buckets['61-90'].total += saldo; buckets['61-90'].count++; }
    else { buckets['90+'].total += saldo; buckets['90+'].count++; }
  }

  return [
    { bucket: '1-30' as const, label: '1-30 dias', ...buckets['1-30'] },
    { bucket: '31-60' as const, label: '31-60 dias', ...buckets['31-60'] },
    { bucket: '61-90' as const, label: '61-90 dias', ...buckets['61-90'] },
    { bucket: '90+' as const, label: '90+ dias', ...buckets['90+'] },
  ];
}

// ---------------------------------------------------------------------------
// 7. getTopClientesInadimplentes
// ---------------------------------------------------------------------------

export async function getTopClientesInadimplentes(
  filters: DashboardFilters,
  limit: number = 20,
): Promise<ClienteInadimplente[]> {
  const today = todayISO();

  const rows = await fetchAllRows<{
    cliente_id: number;
    data_vencimento: string;
    saldo_em_aberto: number;
    dim_cliente: { razao_social: string; cnpj_cpf?: string } | null;
  }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('cliente_id, data_vencimento, saldo_em_aberto, dim_cliente(razao_social, cnpj_cpf)')
      .lt('data_vencimento', today)
      .gt('saldo_em_aberto', 0)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const clienteMap = new Map<number, {
    nome: string; cnpj?: string; total: number; count: number; oldest: string;
  }>();

  for (const r of rows) {
    if (!r.cliente_id) continue;
    const saldo = Number(r.saldo_em_aberto) || 0;
    const existing = clienteMap.get(r.cliente_id);
    if (existing) {
      existing.total += saldo;
      existing.count++;
      if (r.data_vencimento < existing.oldest) existing.oldest = r.data_vencimento;
    } else {
      clienteMap.set(r.cliente_id, {
        nome: r.dim_cliente?.razao_social ?? 'Desconhecido',
        cnpj: r.dim_cliente?.cnpj_cpf ?? undefined,
        total: saldo,
        count: 1,
        oldest: r.data_vencimento,
      });
    }
  }

  return Array.from(clienteMap.entries())
    .map(([clienteId, data]) => ({
      clienteId,
      clienteNome: data.nome,
      clienteCnpjCpf: data.cnpj,
      totalVencido: data.total,
      titulosVencidos: data.count,
      diasMaisAntigo: daysOverdueFromString(data.oldest),
      dataVencimentoMaisAntigo: data.oldest,
    }))
    .sort((a, b) => b.totalVencido - a.totalVencido)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 8. getConcentracaoCarteira
// ---------------------------------------------------------------------------

export async function getConcentracaoCarteira(
  filters: DashboardFilters,
): Promise<ConcentracaoData[]> {
  const rows = await fetchAllRows<{
    cliente_id: number;
    saldo_em_aberto: number;
    dim_cliente: { razao_social: string } | null;
  }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('cliente_id, saldo_em_aberto, dim_cliente(razao_social)')
      .gt('saldo_em_aberto', 0)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const clienteMap = new Map<number, { nome: string; saldo: number }>();
  let grandTotal = 0;
  for (const r of rows) {
    if (!r.cliente_id) continue;
    const saldo = Number(r.saldo_em_aberto) || 0;
    grandTotal += saldo;
    const existing = clienteMap.get(r.cliente_id);
    if (existing) { existing.saldo += saldo; }
    else { clienteMap.set(r.cliente_id, { nome: r.dim_cliente?.razao_social ?? 'Desconhecido', saldo }); }
  }

  const sorted = Array.from(clienteMap.values()).sort((a, b) => b.saldo - a.saldo);

  const result: ConcentracaoData[] = [];
  for (const topN of [5, 10, 20]) {
    const slice = sorted.slice(0, topN);
    const totalSaldo = slice.reduce((sum, c) => sum + c.saldo, 0);
    result.push({
      topN,
      label: `Top ${topN}`,
      totalSaldo,
      percentual: grandTotal > 0 ? (totalSaldo / grandTotal) * 100 : 0,
      clientes: slice,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 9. getEvolucaoMensal
// ---------------------------------------------------------------------------

export async function getEvolucaoMensal(
  filters: DashboardFilters,
): Promise<EvolucaoMensalData[]> {
  const months: { start: string; end: string; key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth();
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const shortMonth = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][month];
    const label = `${shortMonth}/${String(year).slice(2)}`;
    months.push({ start, end, key: `${year}-${String(month + 1).padStart(2, '0')}`, label });
  }

  // Recebimentos nos ultimos 12 meses
  const needsJoin = hasDimensionFilters(filters);
  const recebSelect = needsJoin
    ? 'data_baixa, valor_baixado, valor_juros, valor_multa, fact_titulo_receber!inner(conta_corrente_id, vendedor_id, departamento_id)'
    : 'data_baixa, valor_baixado, valor_juros, valor_multa';

  const recebRows = await fetchAllRows<{ data_baixa: string; valor_baixado: number; valor_juros: number; valor_multa: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_recebimento')
      .select(recebSelect)
      .gte('data_baixa', months[0].start)
      .lte('data_baixa', months[months.length - 1].end)
      .range(from, to);
    if (needsJoin) applyRecebDimensionFilters(q, filters);
    return q;
  });

  // Titulos vencidos (saldo aberto com vencimento no passado)
  const tituloRows = await fetchAllRows<{ data_vencimento: string; saldo_em_aberto: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('data_vencimento, saldo_em_aberto')
      .gt('saldo_em_aberto', 0)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  return months.map((m) => {
    const recebido = recebRows
      .filter((r) => r.data_baixa >= m.start && r.data_baixa <= m.end)
      .reduce((sum, r) => sum + (Number(r.valor_baixado) || 0) + (Number(r.valor_juros) || 0) + (Number(r.valor_multa) || 0), 0);

    // Saldo em aberto: titulos com vencimento neste mes que ainda tem saldo
    const saldoEmAberto = tituloRows
      .filter((r) => r.data_vencimento >= m.start && r.data_vencimento <= m.end)
      .reduce((sum, r) => sum + (Number(r.saldo_em_aberto) || 0), 0);

    // Vencido: titulos com vencimento antes deste mes que ainda tem saldo
    const vencido = tituloRows
      .filter((r) => r.data_vencimento < m.start)
      .reduce((sum, r) => sum + (Number(r.saldo_em_aberto) || 0), 0);

    return { mes: m.key, mesLabel: m.label, recebido, vencido, saldoEmAberto };
  });
}

// ---------------------------------------------------------------------------
// 10. getVendedorPerformance
// ---------------------------------------------------------------------------

export async function getVendedorPerformance(
  filters: DashboardFilters,
): Promise<VendedorPerformance[]> {
  const today = todayISO();

  const rows = await fetchAllRows<{
    vendedor_id: number;
    data_vencimento: string;
    saldo_em_aberto: number;
    dim_vendedor: { nome: string } | null;
  }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('vendedor_id, data_vencimento, saldo_em_aberto, dim_vendedor(nome)')
      .gt('saldo_em_aberto', 0)
      .not('vendedor_id', 'is', null)
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const vendMap = new Map<number, {
    nome: string; aReceber: number; vencido: number; titTotal: number; titVencidos: number;
  }>();

  for (const r of rows) {
    if (!r.vendedor_id) continue;
    const saldo = Number(r.saldo_em_aberto) || 0;
    const isOverdue = r.data_vencimento < today;
    const existing = vendMap.get(r.vendedor_id);
    if (existing) {
      existing.aReceber += saldo;
      existing.titTotal++;
      if (isOverdue) { existing.vencido += saldo; existing.titVencidos++; }
    } else {
      vendMap.set(r.vendedor_id, {
        nome: r.dim_vendedor?.nome ?? 'Sem vendedor',
        aReceber: saldo,
        vencido: isOverdue ? saldo : 0,
        titTotal: 1,
        titVencidos: isOverdue ? 1 : 0,
      });
    }
  }

  return Array.from(vendMap.entries())
    .map(([vendedorId, data]) => ({
      vendedorId,
      vendedorNome: data.nome,
      totalAReceber: data.aReceber,
      totalVencido: data.vencido,
      taxaInadimplencia: data.aReceber > 0 ? (data.vencido / data.aReceber) * 100 : 0,
      titulosTotal: data.titTotal,
      titulosVencidos: data.titVencidos,
    }))
    .sort((a, b) => b.totalAReceber - a.totalAReceber);
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function applyDimensionFilters(query: any, filters: DashboardFilters): void {
  if (filters.contaCorrenteId) query.eq('conta_corrente_id', filters.contaCorrenteId);
  if (filters.vendedorId) query.eq('vendedor_id', filters.vendedorId);
  if (filters.departamentoId) query.eq('departamento_id', filters.departamentoId);
}

/** Check if any dimension filter is active */
function hasDimensionFilters(filters: DashboardFilters): boolean {
  return !!(filters.contaCorrenteId || filters.vendedorId || filters.departamentoId);
}

/** Apply dimension filters to fact_recebimento queries through fact_titulo_receber join */
function applyRecebDimensionFilters(query: any, filters: DashboardFilters): void {
  if (filters.contaCorrenteId) query.eq('fact_titulo_receber.conta_corrente_id', filters.contaCorrenteId);
  if (filters.vendedorId) query.eq('fact_titulo_receber.vendedor_id', filters.vendedorId);
  if (filters.departamentoId) query.eq('fact_titulo_receber.departamento_id', filters.departamentoId);
}
