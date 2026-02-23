import { omieListPages, type ListPagesConfig } from './client';
import { OMIE_ENDPOINTS } from './endpoints';
import { supabaseAdmin } from '../supabase/admin';

// ---------------------------------------------------------------------------
// Types for the nested MF response (movimentos[].detalhes + .resumo)
// ---------------------------------------------------------------------------

interface MFMovimento {
  detalhes: {
    nCodTitulo?: number;
    nCodCliente?: number;
    nCodCC?: number;
    cNatureza?: string;
    cStatus?: string;
    cNumTitulo?: string;
    cNumParcela?: string;
    dDtPagamento?: string;
    dDtVenc?: string;
    nValorTitulo?: number;
  };
  resumo: {
    cLiquidado?: string;
    nValPago?: number;
    nDesconto?: number;
    nJuros?: number;
    nMulta?: number;
    nValAberto?: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTituloLookup(): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  let from = 0;
  const PAGE = 5000;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('fact_titulo_receber')
      .select('id, omie_codigo_titulo')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Lookup fact_titulo_receber: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) map.set(row.omie_codigo_titulo, row.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return map;
}

async function buildContaCorrenteLookup(): Promise<Map<number, number>> {
  const { data, error } = await supabaseAdmin
    .from('dim_conta_corrente')
    .select('id, omie_codigo');
  if (error) throw new Error(`Lookup dim_conta_corrente: ${error.message}`);
  const map = new Map<number, number>();
  for (const row of data ?? []) map.set(row.omie_codigo, row.id);
  return map;
}

function parseOmieDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sync Recebimentos via ListarMovimentos (financas/mf)
// ---------------------------------------------------------------------------

export interface SyncRecebimentosResult {
  fetched: number;
  upserted: number;
  totalPages: number;
  lastPage: number;
  done: boolean;
}

const MF_CONFIG: ListPagesConfig = {
  endpoint: OMIE_ENDPOINTS.movimentosFinanceiros,
  call: 'ListarMovimentos',
  params: { cNatureza: 'R' },
  dataKey: 'movimentos',
  pageSize: 200,
  paginationStyle: 'mf',
};

/**
 * Sync recebimentos in page chunks to avoid serverless timeout.
 * Multiple movements for the same titulo are aggregated (summed).
 */
export async function syncRecebimentos(
  fromPage = 1,
  toPage?: number,
): Promise<SyncRecebimentosResult> {
  const endPage = toPage ?? fromPage + 19;

  const { records: raw, totalPages, lastPage } = await omieListPages<MFMovimento>(
    MF_CONFIG,
    fromPage,
    endPage,
  );

  // Filter movements with actual payments
  const recMovs = raw.filter((m) =>
    m.detalhes?.nCodTitulo &&
    m.resumo?.nValPago !== undefined &&
    m.resumo.nValPago > 0
  );

  if (recMovs.length === 0) {
    return { fetched: raw.length, upserted: 0, totalPages, lastPage, done: lastPage >= totalPages };
  }

  const [tituloMap, ccMap] = await Promise.all([
    buildTituloLookup(),
    buildContaCorrenteLookup(),
  ]);

  // Aggregate movements by titulo: a titulo can have multiple payments
  // We sum up values and keep the latest payment date
  const aggregated = new Map<number, {
    tituloOmie: number;
    tituloId: number | null;
    contaCorrenteId: number | null;
    dataBaixa: string | null;
    valorBaixado: number;
    valorDesconto: number;
    valorJuros: number;
    valorMulta: number;
    liquidado: boolean;
  }>();

  for (const mov of recMovs) {
    const d = mov.detalhes;
    const r = mov.resumo;
    const tituloOmie = d.nCodTitulo!;
    const existing = aggregated.get(tituloOmie);
    const dataBaixa = parseOmieDate(d.dDtPagamento) || parseOmieDate(d.dDtVenc);
    const liquidado = r.cLiquidado === 'S';

    if (existing) {
      existing.valorBaixado += r.nValPago ?? 0;
      existing.valorDesconto += r.nDesconto ?? 0;
      existing.valorJuros += r.nJuros ?? 0;
      existing.valorMulta += r.nMulta ?? 0;
      // Keep latest date
      if (dataBaixa && (!existing.dataBaixa || dataBaixa > existing.dataBaixa)) {
        existing.dataBaixa = dataBaixa;
      }
      // If any movement says liquidado, mark as liquidado
      if (liquidado) existing.liquidado = true;
    } else {
      aggregated.set(tituloOmie, {
        tituloOmie,
        tituloId: tituloMap.get(tituloOmie) ?? null,
        contaCorrenteId: d.nCodCC ? ccMap.get(d.nCodCC) ?? null : null,
        dataBaixa,
        valorBaixado: r.nValPago ?? 0,
        valorDesconto: r.nDesconto ?? 0,
        valorJuros: r.nJuros ?? 0,
        valorMulta: r.nMulta ?? 0,
        liquidado,
      });
    }
  }

  const rows = [...aggregated.values()]
    .filter((r) => r.dataBaixa && r.tituloOmie > 0)
    .map((r) => ({
      omie_codigo_lancamento: r.tituloOmie,
      titulo_id: r.tituloId,
      conta_corrente_id: r.contaCorrenteId,
      data_baixa: r.dataBaixa,
      valor_baixado: r.valorBaixado,
      valor_desconto: r.valorDesconto,
      valor_juros: r.valorJuros,
      valor_multa: r.valorMulta,
      tipo_baixa: r.liquidado ? 'BAIXA' : 'PARCIAL',
      liquidado: r.liquidado,
      updated_at: new Date().toISOString(),
    }));

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

  return { fetched: raw.length, upserted, totalPages, lastPage, done: lastPage >= totalPages };
}
