import { supabaseAdmin } from '../supabase/admin';
import { syncAllDimensions, type DimensionSyncResult } from './sync-dimensions';
import { syncContaReceber, type SyncContaReceberResult } from './sync-contareceber';
import { syncRecebimentos, type SyncRecebimentosResult } from './sync-recebimentos';
import { syncExtrato, type SyncExtratoResult } from './sync-extrato';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncRunResult {
  runId: number;
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  dimensions: DimensionSyncResult[];
  contaReceber: SyncContaReceberResult | null;
  recebimentos: SyncRecebimentosResult | null;
  extrato: SyncExtratoResult | null;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

async function createSyncRun(entity: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('audit_sync_runs')
    .insert({
      entity,
      started_at: new Date().toISOString(),
      status: 'running',
      records_fetched: 0,
      records_upserted: 0,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Create audit_sync_runs: ${error.message}`);
  return data.id;
}

async function completeSyncRun(
  runId: number,
  status: 'success' | 'error',
  recordsFetched: number,
  recordsUpserted: number,
  cursor: string | null,
  errorMessage: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('audit_sync_runs')
    .update({
      finished_at: new Date().toISOString(),
      status,
      records_fetched: recordsFetched,
      records_upserted: recordsUpserted,
      last_sync_cursor: cursor,
      error_message: errorMessage,
    })
    .eq('id', runId);

  if (error) console.error(`[sync-orchestrator] Failed to update audit run ${runId}:`, error.message);
}

/**
 * Get the last successful sync cursor for a given entity.
 * Returns the ISO date stored in last_sync_cursor, or undefined if no prior sync.
 */
async function getLastCursor(entity: string): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin
    .from('audit_sync_runs')
    .select('last_sync_cursor')
    .eq('entity', entity)
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.last_sync_cursor) return undefined;
  return data.last_sync_cursor;
}

// ---------------------------------------------------------------------------
// Full Sync Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full Omie -> Supabase sync pipeline.
 *
 * Execution order:
 *   1. Dimension tables (all 5 in parallel)
 *   2. Contas a Receber (incremental)
 *   3. Recebimentos (incremental)
 *   4. Extrato CC (incremental)
 *
 * Each step is tracked in audit_sync_runs. If a step fails, subsequent
 * steps still attempt to run (best-effort), and all errors are collected.
 */
export async function runFullSync(): Promise<SyncRunResult> {
  const startedAt = new Date().toISOString();
  const runId = await createSyncRun('full_sync');
  const errors: string[] = [];
  const now = new Date().toISOString();

  let dimensionResults: DimensionSyncResult[] = [];
  let contaReceberResult: SyncContaReceberResult | null = null;
  let recebimentosResult: SyncRecebimentosResult | null = null;
  let extratoResult: SyncExtratoResult | null = null;

  let totalFetched = 0;
  let totalUpserted = 0;

  // -----------------------------------------------------------------------
  // Step 1: Dimensions (parallel)
  // -----------------------------------------------------------------------
  try {
    console.log('[sync-orchestrator] Step 1/4: Syncing dimensions...');
    dimensionResults = await syncAllDimensions();

    for (const dr of dimensionResults) {
      totalUpserted += dr.records;
      totalFetched += dr.records; // dimensions do full load, fetched ~= upserted
      if (dr.status === 'error' && dr.error) {
        errors.push(`[${dr.entity}] ${dr.error}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[dimensions] ${msg}`);
    console.error('[sync-orchestrator] Dimensions step failed:', msg);
  }

  // -----------------------------------------------------------------------
  // Step 2: Contas a Receber (incremental)
  // -----------------------------------------------------------------------
  try {
    console.log('[sync-orchestrator] Step 2/4: Syncing contas a receber...');
    contaReceberResult = await syncContaReceber();
    totalFetched += contaReceberResult.fetched;
    totalUpserted += contaReceberResult.upserted;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[fact_titulo_receber] ${msg}`);
    console.error('[sync-orchestrator] Contas a receber step failed:', msg);
  }

  // -----------------------------------------------------------------------
  // Step 3: Recebimentos (incremental)
  // -----------------------------------------------------------------------
  try {
    console.log('[sync-orchestrator] Step 3/4: Syncing recebimentos...');
    recebimentosResult = await syncRecebimentos();
    totalFetched += recebimentosResult.fetched;
    totalUpserted += recebimentosResult.upserted;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[fact_recebimento] ${msg}`);
    console.error('[sync-orchestrator] Recebimentos step failed:', msg);
  }

  // -----------------------------------------------------------------------
  // Step 4: Extrato CC (incremental)
  // -----------------------------------------------------------------------
  try {
    console.log('[sync-orchestrator] Step 4/4: Syncing extrato...');
    const cursor = await getLastCursor('fact_extrato_cc');
    extratoResult = await syncExtrato(cursor);
    totalFetched += extratoResult.fetched;
    totalUpserted += extratoResult.upserted;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`[fact_extrato_cc] ${msg}`);
    console.error('[sync-orchestrator] Extrato step failed:', msg);
  }

  // -----------------------------------------------------------------------
  // Finalize audit record
  // -----------------------------------------------------------------------
  const finishedAt = new Date().toISOString();
  const overallStatus = errors.length === 0 ? 'success' : 'error';

  await completeSyncRun(
    runId,
    overallStatus,
    totalFetched,
    totalUpserted,
    now, // cursor = timestamp of this sync run
    errors.length > 0 ? errors.join(' | ') : null,
  );

  const result: SyncRunResult = {
    runId,
    status: overallStatus,
    startedAt,
    finishedAt,
    dimensions: dimensionResults,
    contaReceber: contaReceberResult,
    recebimentos: recebimentosResult,
    extrato: extratoResult,
    errors,
  };

  console.log(
    `[sync-orchestrator] Finished. Status=${overallStatus}, Fetched=${totalFetched}, Upserted=${totalUpserted}, Errors=${errors.length}`,
  );

  return result;
}
