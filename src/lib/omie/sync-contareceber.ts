import { omieListAll } from './client';
import { OMIE_ENDPOINTS } from './endpoints';
import { ContaReceberSchema, type ContaReceber } from './types';
import { supabaseAdmin } from '../supabase/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a lookup map  omie_codigo -> id  for a given dimension table. */
async function buildLookup(table: string): Promise<Map<number, number>> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('id, omie_codigo');

  if (error) throw new Error(`Lookup ${table}: ${error.message}`);

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

// ---------------------------------------------------------------------------
// Sync Contas a Receber
// ---------------------------------------------------------------------------

export interface SyncContaReceberResult {
  fetched: number;
  upserted: number;
}

/**
 * Fetch contas a receber from Omie and upsert into fact_titulo_receber.
 *
 * When `lastCursor` is provided (ISO date string), only records altered since
 * that date are fetched (incremental sync). Otherwise all records are fetched.
 */
export async function syncContaReceber(lastCursor?: string): Promise<SyncContaReceberResult> {
  // Build filter params
  const params: Record<string, unknown> = {};

  if (lastCursor) {
    // Omie expects dd/mm/yyyy for date filters
    const d = new Date(lastCursor);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    params.dDtAlterDe = `${dd}/${mm}/${yyyy}`;
    params.dDtAlterAte = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  // Fetch all pages
  const raw = await omieListAll<ContaReceber>({
    endpoint: OMIE_ENDPOINTS.contaReceber,
    call: 'ListarContasReceber',
    params,
    dataKey: 'conta_receber_cadastro',
    pageSize: 200,
  });

  const parsed: ContaReceber[] = [];
  for (const r of raw) {
    const result = ContaReceberSchema.safeParse(r);
    if (result.success) parsed.push(result.data);
  }

  if (parsed.length === 0) {
    return { fetched: 0, upserted: 0 };
  }

  // Build FK lookup maps in parallel
  const [clienteMap, contaCorrenteMap, categoriaMap, vendedorMap, departamentoMap] = await Promise.all([
    buildLookup('dim_cliente'),
    buildLookup('dim_conta_corrente'),
    buildLookup('dim_categoria'),
    buildLookup('dim_vendedor'),
    buildLookup('dim_departamento'),
  ]);

  // Map to DB rows
  const rows = parsed.map((cr) => {
    // Resolve departamento from distribuicao array (first entry)
    const firstDept = cr.distribuicao?.[0]?.codigo_departamento;
    const deptOmie = firstDept ? Number(firstDept) : undefined;

    return {
      omie_codigo_titulo: cr.codigo_lancamento_omie,
      codigo_integracao: cr.codigo_lancamento_integracao || null,
      cliente_id: clienteMap.get(cr.codigo_cliente_fornecedor) ?? null,
      conta_corrente_id: cr.id_conta_corrente
        ? contaCorrenteMap.get(cr.id_conta_corrente) ?? null
        : null,
      categoria_id: cr.codigo_categoria
        ? categoriaMap.get(Number(cr.codigo_categoria)) ?? null
        : null,
      vendedor_id: cr.codigo_vendedor
        ? vendedorMap.get(cr.codigo_vendedor) ?? null
        : null,
      departamento_id: deptOmie
        ? departamentoMap.get(deptOmie) ?? null
        : null,
      numero_documento: cr.numero_documento || null,
      numero_parcela: cr.numero_parcela || null,
      data_emissao: parseOmieDate(cr.data_emissao),
      data_vencimento: parseOmieDate(cr.data_vencimento),
      data_previsao: parseOmieDate(cr.data_previsao),
      data_registro: parseOmieDate(cr.data_registro),
      valor_documento: cr.valor_documento,
      status_titulo: cr.status_titulo,
      observacao: cr.observacao || null,
      updated_at: new Date().toISOString(),
    };
  });

  // Upsert in chunks
  const CHUNK = 500;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin
      .from('fact_titulo_receber')
      .upsert(chunk, { onConflict: 'omie_codigo_titulo', count: 'exact' });

    if (error) throw new Error(`Upsert fact_titulo_receber: ${error.message}`);
    upserted += count ?? chunk.length;
  }

  return { fetched: parsed.length, upserted };
}
