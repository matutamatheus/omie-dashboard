import { supabaseAdmin } from './admin';
import { format, startOfDay } from 'date-fns';
import { toISODate, getHorizonRange, HORIZON_LABELS, type HorizonKey } from '@/lib/utils/dates';
import type {
  KPIData,
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
  const recebidoRows = await fetchAllRows<{ valor_baixado: number; valor_juros: number; valor_multa: number }>((from, to) =>
    supabaseAdmin
      .from('fact_recebimento')
      .select('valor_baixado, valor_juros, valor_multa')
      .gte('data_baixa', dateStart)
      .lte('data_baixa', dateEnd)
      .range(from, to),
  );

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
      .not('status_titulo', 'in', '("CANCELADO","LIQUIDADO")')
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const aReceber = aReceberRows.reduce(
    (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
    0,
  );

  // vencido: titulos com vencimento < hoje e saldo > 0
  const vencidoRows = await fetchAllRows<{ saldo_em_aberto: number }>((from, to) => {
    const q = supabaseAdmin
      .from('fact_titulo_receber')
      .select('saldo_em_aberto')
      .lt('data_vencimento', today)
      .gt('saldo_em_aberto', 0)
      .not('status_titulo', 'in', '("CANCELADO","LIQUIDADO")')
      .range(from, to);
    applyDimensionFilters(q, filters);
    return q;
  });

  const vencido = vencidoRows.reduce(
    (sum, r) => sum + (Number(r.saldo_em_aberto) || 0),
    0,
  );

  return { recebido, aReceber, vencido };
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
        .not('status_titulo', 'in', '("CANCELADO","LIQUIDADO")')
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
// 3. getTitulos
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
// Shared
// ---------------------------------------------------------------------------

function applyDimensionFilters(query: any, filters: DashboardFilters): void {
  if (filters.contaCorrenteId) query.eq('conta_corrente_id', filters.contaCorrenteId);
  if (filters.vendedorId) query.eq('vendedor_id', filters.vendedorId);
  if (filters.departamentoId) query.eq('departamento_id', filters.departamentoId);
}
