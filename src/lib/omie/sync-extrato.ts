import { omieCall } from './client';
import { OMIE_ENDPOINTS } from './endpoints';
import { ExtratoMovSchema, type ExtratoMov } from './types';
import { supabaseAdmin } from '../supabase/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse Omie date string (dd/mm/yyyy) into ISO date (yyyy-mm-dd). Returns null for empty/invalid. */
function parseOmieDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** Format a JS Date to dd/mm/yyyy for Omie API. */
function formatOmieDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Extrato fetch per conta corrente
// ---------------------------------------------------------------------------

interface ObterExtratoResponse {
  movimentos?: unknown[];
  total_de_registros?: number;
}

/**
 * Fetch extrato movements for a single conta corrente from Omie.
 *
 * The ObterExtrato call is NOT paginated in the standard Omie way -- it
 * returns all movements for the given period. We call it once per CC.
 */
async function fetchExtrato(
  nCodCC: number,
  dDtDe: string,
  dDtAte: string,
): Promise<ExtratoMov[]> {
  const result = await omieCall<ObterExtratoResponse>({
    endpoint: OMIE_ENDPOINTS.extrato,
    call: 'ObterExtrato',
    params: {
      nCodCC,
      dDtDe,
      dDtAte,
    },
  });

  const rawMovs = result.movimentos ?? [];
  const parsed: ExtratoMov[] = [];
  for (const r of rawMovs) {
    const res = ExtratoMovSchema.safeParse(r);
    if (res.success) parsed.push(res.data);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Sync Extrato
// ---------------------------------------------------------------------------

export interface SyncExtratoResult {
  fetched: number;
  upserted: number;
}

/**
 * Fetch extrato for ALL active contas correntes and upsert into fact_extrato_cc.
 *
 * When `lastCursor` is provided (ISO date), only movements from that date onward
 * are fetched. Otherwise defaults to the last 90 days.
 */
export async function syncExtrato(lastCursor?: string): Promise<SyncExtratoResult> {
  // 1. Get all active contas correntes from Supabase
  const { data: contas, error: ccError } = await supabaseAdmin
    .from('dim_conta_corrente')
    .select('id, omie_codigo')
    .eq('ativo', true);

  if (ccError) throw new Error(`Fetch dim_conta_corrente: ${ccError.message}`);
  if (!contas || contas.length === 0) return { fetched: 0, upserted: 0 };

  // 2. Build date range
  const hoje = new Date();
  let dataDe: Date;

  if (lastCursor) {
    dataDe = new Date(lastCursor);
  } else {
    // Default: last 90 days
    dataDe = new Date();
    dataDe.setDate(dataDe.getDate() - 90);
  }

  const dDtDe = formatOmieDate(dataDe);
  const dDtAte = formatOmieDate(hoje);

  // 3. Fetch extrato for each CC (sequentially to respect rate limits)
  let totalFetched = 0;
  let totalUpserted = 0;

  for (const cc of contas) {
    try {
      const movs = await fetchExtrato(cc.omie_codigo, dDtDe, dDtAte);
      totalFetched += movs.length;

      if (movs.length === 0) continue;

      // Map to DB rows
      const rows = movs.map((mov) => {
        // Determine tipo: 'C' for credit (positive), 'D' for debit (negative)
        const valor = mov.nValor ?? 0;
        const tipo = mov.cOperacao || (valor >= 0 ? 'C' : 'D');

        return {
          omie_codigo_movimento: mov.nCodMov ?? 0,
          conta_corrente_id: cc.id,
          data_lancamento: parseOmieDate(mov.dDtLanc),
          descricao: mov.cDescricao || null,
          documento: mov.cDocumento || null,
          tipo,
          valor: Math.abs(valor),
          saldo: mov.nSaldo ?? null,
          data_conciliacao: parseOmieDate(mov.dDataConciliacao),
          updated_at: new Date().toISOString(),
        };
      });

      // Upsert in chunks
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error, count } = await supabaseAdmin
          .from('fact_extrato_cc')
          .upsert(chunk, { onConflict: 'omie_codigo_movimento', count: 'exact' });

        if (error) throw new Error(`Upsert fact_extrato_cc (CC ${cc.omie_codigo}): ${error.message}`);
        totalUpserted += count ?? chunk.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync-extrato] Error fetching extrato for CC ${cc.omie_codigo}:`, msg);
      // Continue with next CC - do not abort the whole sync
    }
  }

  return { fetched: totalFetched, upserted: totalUpserted };
}
