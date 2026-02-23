import { omieListAll, omieListPages } from './client';
import { OMIE_ENDPOINTS } from './endpoints';
import {
  ClienteSchema,
  ContaCorrenteSchema,
  DepartamentoSchema,
  CategoriaSchema,
  VendedorSchema,
  type OmieCliente,
  type OmieContaCorrente,
  type OmieDepartamento,
  type OmieCategoria,
  type OmieVendedor,
} from './types';
import { supabaseAdmin } from '../supabase/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse + validate an array of raw records through a Zod schema, skipping bad rows. */
function safeParse<T>(schema: { safeParse: (d: unknown) => { success: boolean; data?: T } }, raw: unknown[]): T[] {
  const out: T[] = [];
  for (const r of raw) {
    const parsed = schema.safeParse(r);
    if (parsed.success && parsed.data) out.push(parsed.data);
  }
  return out;
}

/** Upsert a batch of rows into a Supabase table. Returns number of rows upserted. */
async function upsertBatch(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string,
): Promise<number> {
  if (rows.length === 0) return 0;

  // Supabase upsert in chunks of 500 to avoid payload limits
  const CHUNK = 500;
  let total = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin
      .from(table)
      .upsert(chunk, { onConflict: conflictColumn, count: 'exact' });

    if (error) throw new Error(`Upsert ${table}: ${error.message}`);
    total += count ?? chunk.length;
  }

  return total;
}

// ---------------------------------------------------------------------------
// Individual dimension syncs
// ---------------------------------------------------------------------------

export interface SyncClientesResult {
  records: number;
  totalPages: number;
  lastPage: number;
  done: boolean;
}

/**
 * Sync clientes in page chunks to avoid serverless timeout.
 * Default: 20 pages at a time (~4000 records).
 */
export async function syncClientes(
  fromPage = 1,
  toPage?: number,
): Promise<SyncClientesResult> {
  const endPage = toPage ?? fromPage + 19;

  const { records: raw, totalPages, lastPage } = await omieListPages<OmieCliente>(
    {
      endpoint: OMIE_ENDPOINTS.clientes,
      call: 'ListarClientes',
      params: { apenas_importado_api: 'N' },
      dataKey: 'clientes_cadastro',
      pageSize: 200,
    },
    fromPage,
    endPage,
  );

  const parsed = safeParse(ClienteSchema, raw);

  const rows = parsed.map((c) => ({
    omie_codigo: c.codigo_cliente_omie,
    codigo_integracao: c.codigo_cliente_integracao || null,
    razao_social: c.razao_social,
    nome_fantasia: c.nome_fantasia || null,
    cnpj_cpf: c.cnpj_cpf || null,
    cidade: c.cidade || null,
    estado: c.estado || null,
    email: c.email || null,
    telefone: c.telefone1_numero || null,
    ativo: c.inativo !== 'S',
    updated_at: new Date().toISOString(),
  }));

  const records = await upsertBatch('dim_cliente', rows, 'omie_codigo');
  return { records, totalPages, lastPage, done: lastPage >= totalPages };
}

export async function syncContasCorrentes(): Promise<number> {
  const raw = await omieListAll<OmieContaCorrente>({
    endpoint: OMIE_ENDPOINTS.contasCorrentes,
    call: 'ListarContasCorrentes',
    params: {},
    dataKey: 'ListarContasCorrentes',
    pageSize: 200,
  });

  const parsed = safeParse(ContaCorrenteSchema, raw);

  const rows = parsed.map((cc) => ({
    omie_codigo: cc.nCodCC,
    descricao: cc.descricao,
    tipo: cc.tipo_conta_corrente || null,
    banco: cc.codigo_banco || null,
    agencia: cc.codigo_agencia || null,
    conta: cc.numero_conta_corrente || null,
    ativo: cc.inativo !== 'S',
    updated_at: new Date().toISOString(),
  }));

  return upsertBatch('dim_conta_corrente', rows, 'omie_codigo');
}

export async function syncDepartamentos(): Promise<number> {
  const raw = await omieListAll<OmieDepartamento>({
    endpoint: OMIE_ENDPOINTS.departamentos,
    call: 'ListarDepartamentos',
    params: {},
    dataKey: 'departamentos',
    pageSize: 200,
  });

  const parsed = safeParse(DepartamentoSchema, raw);

  const rows = parsed.map((d) => ({
    omie_codigo: Number(d.codigo),
    descricao: d.descricao,
    ativo: d.inativo !== 'S',
    updated_at: new Date().toISOString(),
  })).filter((r) => !isNaN(r.omie_codigo));

  return upsertBatch('dim_departamento', rows, 'omie_codigo');
}

export async function syncCategorias(): Promise<number> {
  const raw = await omieListAll<OmieCategoria>({
    endpoint: OMIE_ENDPOINTS.categorias,
    call: 'ListarCategorias',
    params: {},
    dataKey: 'categoria_cadastro',
    pageSize: 200,
  });

  const parsed = safeParse(CategoriaSchema, raw);

  const rows = parsed.map((cat) => ({
    omie_codigo: cat.codigo,
    descricao: cat.descricao,
    descricao_padrao: cat.descricao_padrao || null,
    ativo: cat.conta_inativa !== 'S',
    updated_at: new Date().toISOString(),
  }));

  return upsertBatch('dim_categoria', rows, 'omie_codigo');
}

export async function syncVendedores(): Promise<number> {
  const raw = await omieListAll<OmieVendedor>({
    endpoint: OMIE_ENDPOINTS.vendedores,
    call: 'ListarVendedores',
    params: {},
    dataKey: 'cadastro',
    pageSize: 200,
  });

  const parsed = safeParse(VendedorSchema, raw);

  const rows = parsed.map((v) => ({
    omie_codigo: v.codigo,
    nome: v.nome,
    email: v.email || null,
    ativo: v.inativo !== 'S',
    updated_at: new Date().toISOString(),
  }));

  return upsertBatch('dim_vendedor', rows, 'omie_codigo');
}

// ---------------------------------------------------------------------------
// Public: run all dimension syncs in parallel
// ---------------------------------------------------------------------------

export interface DimensionSyncResult {
  entity: string;
  records: number;
  status: 'success' | 'error';
  error?: string;
}

export async function syncAllDimensions(): Promise<DimensionSyncResult[]> {
  const tasks: { entity: string; fn: () => Promise<number> }[] = [
    { entity: 'dim_cliente', fn: async () => (await syncClientes()).records },
    { entity: 'dim_conta_corrente', fn: syncContasCorrentes },
    { entity: 'dim_departamento', fn: syncDepartamentos },
    { entity: 'dim_categoria', fn: syncCategorias },
    { entity: 'dim_vendedor', fn: syncVendedores },
  ];

  const results = await Promise.allSettled(
    tasks.map(async (t) => {
      const records = await t.fn();
      return { entity: t.entity, records, status: 'success' as const };
    }),
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
    console.error(`[sync-dimensions] ${tasks[i].entity} failed:`, errMsg);
    return { entity: tasks[i].entity, records: 0, status: 'error' as const, error: errMsg };
  });
}
