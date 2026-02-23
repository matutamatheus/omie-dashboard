import { supabaseAdmin } from '../supabase/admin';

/**
 * Recalculate derived columns on fact_titulo_receber based on fact_recebimento data.
 *
 * For each titulo that has recebimentos:
 *   - caixa_recebido = sum(valor_baixado + valor_juros + valor_multa)
 *   - desconto_concedido = sum(valor_desconto)
 *   - principal_liquidado = sum(valor_baixado + valor_desconto)
 *   - saldo_em_aberto = max(0, valor_documento - principal_liquidado)
 *
 * Uses a raw SQL query for efficiency (single UPDATE from aggregated subquery).
 */
export async function recalcTituloMetrics(): Promise<{ updated: number }> {
  const { data, error } = await supabaseAdmin.rpc('recalc_titulo_metrics');

  if (error) {
    // If the RPC doesn't exist yet, fall back to manual calculation
    if (error.message.includes('not exist') || error.code === '42883') {
      return recalcManual();
    }
    throw new Error(`recalc_titulo_metrics RPC: ${error.message}`);
  }

  return { updated: data ?? 0 };
}

/**
 * Fallback: manually query recebimentos and update titulos in JS.
 */
async function recalcManual(): Promise<{ updated: number }> {
  // Get aggregated recebimento data per titulo
  const { data: recebimentos, error: recErr } = await supabaseAdmin
    .from('fact_recebimento')
    .select('omie_codigo_lancamento, valor_baixado, valor_desconto, valor_juros, valor_multa');

  if (recErr) throw new Error(`Query fact_recebimento: ${recErr.message}`);

  // Aggregate by titulo omie_codigo (omie_codigo_lancamento = titulo's omie_codigo)
  const tituloAgg = new Map<number, {
    caixa: number;
    desconto: number;
    liquidado: number;
  }>();

  for (const r of recebimentos ?? []) {
    const key = r.omie_codigo_lancamento;
    const existing = tituloAgg.get(key);
    const baixado = Number(r.valor_baixado) || 0;
    const desconto = Number(r.valor_desconto) || 0;
    const juros = Number(r.valor_juros) || 0;
    const multa = Number(r.valor_multa) || 0;

    if (existing) {
      existing.caixa += baixado + juros + multa;
      existing.desconto += desconto;
      existing.liquidado += baixado + desconto;
    } else {
      tituloAgg.set(key, {
        caixa: baixado + juros + multa,
        desconto,
        liquidado: baixado + desconto,
      });
    }
  }

  // Get all titulos to calculate saldo
  const { data: titulos, error: titErr } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id, omie_codigo_titulo, valor_documento');

  if (titErr) throw new Error(`Query fact_titulo_receber: ${titErr.message}`);

  let updated = 0;
  const CHUNK = 100;
  const updates: { id: number; caixa_recebido: number; desconto_concedido: number; principal_liquidado: number; saldo_em_aberto: number }[] = [];

  for (const titulo of titulos ?? []) {
    const agg = tituloAgg.get(titulo.omie_codigo_titulo);
    if (!agg) continue;

    const valorDoc = Number(titulo.valor_documento) || 0;
    const saldo = Math.max(0, valorDoc - agg.liquidado);

    updates.push({
      id: titulo.id,
      caixa_recebido: Math.round(agg.caixa * 100) / 100,
      desconto_concedido: Math.round(agg.desconto * 100) / 100,
      principal_liquidado: Math.round(agg.liquidado * 100) / 100,
      saldo_em_aberto: Math.round(saldo * 100) / 100,
    });
  }

  // Update in chunks
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    for (const upd of chunk) {
      const { error: updErr } = await supabaseAdmin
        .from('fact_titulo_receber')
        .update({
          caixa_recebido: upd.caixa_recebido,
          desconto_concedido: upd.desconto_concedido,
          principal_liquidado: upd.principal_liquidado,
          saldo_em_aberto: upd.saldo_em_aberto,
        })
        .eq('id', upd.id);

      if (updErr) {
        console.error(`[recalc] Failed to update titulo ${upd.id}:`, updErr.message);
      } else {
        updated++;
      }
    }
  }

  return { updated };
}
