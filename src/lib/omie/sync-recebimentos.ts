import { omieListAll } from './client';
import { OMIE_ENDPOINTS } from './endpoints';
import { MovimentoFinanceiroSchema, type MovimentoFinanceiro } from './types';
import { supabaseAdmin } from '../supabase/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a lookup map  omie_codigo_titulo -> id  for fact_titulo_receber. */
async function buildTituloLookup(): Promise<Map<number, number>> {
  const { data, error } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id, omie_codigo_titulo');

  if (error) throw new Error(`Lookup fact_titulo_receber: ${error.message}`);

  const map = new Map<number, number>();
  for (const row of data ?? []) {
    map.set(row.omie_codigo_titulo, row.id);
  }
  return map;
}

/** Build a lookup map  omie_codigo -> id  for dim_conta_corrente. */
async function buildContaCorrenteLookup(): Promise<Map<number, number>> {
  const { data, error } = await supabaseAdmin
    .from('dim_conta_corrente')
    .select('id, omie_codigo');

  if (error) throw new Error(`Lookup dim_conta_corrente: ${error.message}`);

  const map = new Map<number, number>();
  for (const row of data ?? []) {
    map.set(row.omie_codigo, row.id);
  }
  return map;
}

/** Parse Omie date string (dd/mm/yyyy) into ISO date (yyyy-mm-dd). Returns null for empty/invalid. */
function parseOmieDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Determine the tipo_baixa from a movimento financeiro record.
 * Omie encodes the nature of the movement; we map to a simplified enum.
 */
function deriveTipoBaixa(mov: MovimentoFinanceiro): string {
  if (mov.nDesconto && mov.nDesconto !== 0) return 'DESCONTO';
  if (mov.nJuros && mov.nJuros !== 0) return 'JUROS';
  if (mov.nMulta && mov.nMulta !== 0) return 'MULTA';
  // nCodBaixa > 0 normally indicates a standard payment (baixa)
  if (mov.nCodBaixa && mov.nCodBaixa > 0) return 'BAIXA';
  // Negative nValorPago could indicate an estorno
  if ((mov.nValorPago ?? 0) < 0) return 'ESTORNO';
  return 'BAIXA';
}

// ---------------------------------------------------------------------------
// Sync Recebimentos (movimentos financeiros filtered to REC)
// ---------------------------------------------------------------------------

export interface SyncRecebimentosResult {
  fetched: number;
  upserted: number;
}

/**
 * Fetch movimentos financeiros from Omie (natureza REC) and upsert into fact_recebimento.
 *
 * Uses the `PesquisarLancamentos` call on the movimentos financeiros endpoint
 * with pagination style "mf" (nPagina / nRegPorPagina / nTotPaginas).
 *
 * When `lastCursor` is provided (ISO date), only records from that date onward are fetched.
 */
export async function syncRecebimentos(lastCursor?: string): Promise<SyncRecebimentosResult> {
  const params: Record<string, unknown> = {
    cNatureza: 'REC',
  };

  if (lastCursor) {
    const d = new Date(lastCursor);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    params.dDtPagtoDe = `${dd}/${mm}/${yyyy}`;
    params.dDtPagtoAte = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  const raw = await omieListAll<MovimentoFinanceiro>({
    endpoint: OMIE_ENDPOINTS.movimentosFinanceiros,
    call: 'PesquisarLancamentos',
    params,
    dataKey: 'movimentos',
    pageSize: 100,
    paginationStyle: 'mf',
  });

  const parsed: MovimentoFinanceiro[] = [];
  for (const r of raw) {
    const result = MovimentoFinanceiroSchema.safeParse(r);
    if (result.success) parsed.push(result.data);
  }

  // Filter only REC movements (extra safety in case API returns mixed results)
  const recMovs = parsed.filter((m) => (m.cNatureza ?? '').toUpperCase() === 'REC');

  if (recMovs.length === 0) {
    return { fetched: 0, upserted: 0 };
  }

  // Build FK lookup maps
  const [tituloMap, ccMap] = await Promise.all([
    buildTituloLookup(),
    buildContaCorrenteLookup(),
  ]);

  // Map to DB rows
  const rows = recMovs.map((mov) => ({
    omie_codigo_lancamento: mov.nCodMov ?? 0,
    codigo_baixa_integracao: mov.nCodBaixa ? String(mov.nCodBaixa) : null,
    titulo_id: mov.nCodTitulo ? tituloMap.get(mov.nCodTitulo) ?? null : null,
    conta_corrente_id: mov.nCodCC ? ccMap.get(mov.nCodCC) ?? null : null,
    data_baixa: parseOmieDate(mov.dDtPagamento),
    valor_baixado: mov.nValorPago ?? 0,
    valor_desconto: mov.nDesconto ?? 0,
    valor_juros: mov.nJuros ?? 0,
    valor_multa: mov.nMulta ?? 0,
    tipo_baixa: deriveTipoBaixa(mov),
    liquidado: mov.cStatus === 'LIQUIDADO',
    observacao: null,
    updated_at: new Date().toISOString(),
  }));

  // Upsert in chunks
  const CHUNK = 500;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin
      .from('fact_recebimento')
      .upsert(chunk, { onConflict: 'omie_codigo_lancamento', count: 'exact' });

    if (error) throw new Error(`Upsert fact_recebimento: ${error.message}`);
    upserted += count ?? chunk.length;
  }

  return { fetched: recMovs.length, upserted };
}
