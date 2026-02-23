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
  const { data, error } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id, omie_codigo_titulo');
  if (error) throw new Error(`Lookup fact_titulo_receber: ${error.message}`);
  const map = new Map<number, number>();
  for (const row of data ?? []) map.set(row.omie_codigo_titulo, row.id);
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
 * @param fromPage Starting page (1-based)
 * @param toPage   Ending page (inclusive). If not set, fetches 20 pages.
 */
export async function syncRecebimentos(
  fromPage = 1,
  toPage?: number,
): Promise<SyncRecebimentosResult> {
  const endPage = toPage ?? fromPage + 19; // 20 pages at a time = ~4000 records

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

  const rows = recMovs
    .map((mov) => {
      const d = mov.detalhes;
      const r = mov.resumo;
      return {
        omie_codigo_lancamento: d.nCodTitulo ?? 0,
        titulo_id: d.nCodTitulo ? tituloMap.get(d.nCodTitulo) ?? null : null,
        conta_corrente_id: d.nCodCC ? ccMap.get(d.nCodCC) ?? null : null,
        data_baixa: parseOmieDate(d.dDtPagamento) || parseOmieDate(d.dDtVenc),
        valor_baixado: r.nValPago ?? 0,
        valor_desconto: r.nDesconto ?? 0,
        valor_juros: r.nJuros ?? 0,
        valor_multa: r.nMulta ?? 0,
        tipo_baixa: r.cLiquidado === 'S' ? 'BAIXA' : 'PARCIAL',
        liquidado: r.cLiquidado === 'S',
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r) => r.data_baixa && r.omie_codigo_lancamento > 0);

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
