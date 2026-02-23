import { supabaseAdmin } from '../supabase/admin';

export interface RecalcResult {
  updated: number;
  recebimentosLoaded: number;
  titulosLoaded: number;
  aggregations: number;
  matchesFound: number;
  errors: string[];
}

/**
 * Recalculate derived columns on fact_titulo_receber based on fact_recebimento data.
 */
export async function recalcTituloMetrics(): Promise<RecalcResult> {
  const errors: string[] = [];

  // 1. Load all recebimentos
  const recebimentos: Record<string, unknown>[] = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('fact_recebimento')
      .select('omie_codigo_lancamento, valor_baixado, valor_desconto, valor_juros, valor_multa')
      .range(from, from + PAGE - 1)
      .limit(PAGE);

    if (error) { errors.push(`Query recebimentos: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    recebimentos.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // 2. Aggregate by titulo omie_codigo
  const tituloAgg = new Map<number, { caixa: number; desconto: number; liquidado: number }>();

  for (const r of recebimentos) {
    const key = Number(r.omie_codigo_lancamento);
    if (!key || isNaN(key)) continue;

    const baixado = Number(r.valor_baixado) || 0;
    const desconto = Number(r.valor_desconto) || 0;
    const juros = Number(r.valor_juros) || 0;
    const multa = Number(r.valor_multa) || 0;

    const existing = tituloAgg.get(key);
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

  // 3. Load all titulos
  const titulos: Record<string, unknown>[] = [];
  from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('fact_titulo_receber')
      .select('id, omie_codigo_titulo, valor_documento')
      .range(from, from + PAGE - 1)
      .limit(PAGE);

    if (error) { errors.push(`Query titulos: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    titulos.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // 4. Build updates
  const updates: { id: number; caixa_recebido: number; desconto_concedido: number; principal_liquidado: number; saldo_em_aberto: number }[] = [];

  for (const titulo of titulos) {
    const omieCode = Number(titulo.omie_codigo_titulo);
    const agg = tituloAgg.get(omieCode);
    if (!agg) continue;

    const valorDoc = Number(titulo.valor_documento) || 0;
    const saldo = Math.max(0, valorDoc - agg.liquidado);

    updates.push({
      id: Number(titulo.id),
      caixa_recebido: Math.round(agg.caixa * 100) / 100,
      desconto_concedido: Math.round(agg.desconto * 100) / 100,
      principal_liquidado: Math.round(agg.liquidado * 100) / 100,
      saldo_em_aberto: Math.round(saldo * 100) / 100,
    });
  }

  // 5. Update in parallel batches (can't use upsert as it requires all NOT NULL cols)
  let updated = 0;
  const CONCURRENT = 20;

  for (let i = 0; i < updates.length; i += CONCURRENT) {
    const batch = updates.slice(i, i + CONCURRENT);
    const results = await Promise.allSettled(
      batch.map((upd) =>
        supabaseAdmin
          .from('fact_titulo_receber')
          .update({
            caixa_recebido: upd.caixa_recebido,
            desconto_concedido: upd.desconto_concedido,
            principal_liquidado: upd.principal_liquidado,
            saldo_em_aberto: upd.saldo_em_aberto,
          })
          .eq('id', upd.id)
      ),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && !r.value.error) updated++;
    }
  }

  return {
    updated,
    recebimentosLoaded: recebimentos.length,
    titulosLoaded: titulos.length,
    aggregations: tituloAgg.size,
    matchesFound: updates.length,
    errors,
  };
}
