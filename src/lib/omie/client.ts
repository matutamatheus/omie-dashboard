const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_CONCURRENT = 3;
const MIN_DELAY_MS = 300;

let activeRequests = 0;
let lastRequestTime = 0;

async function waitForSlot(): Promise<void> {
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
}

export interface OmieCallParams {
  endpoint: string;
  call: string;
  params: Record<string, unknown>;
}

export async function omieCall<T>(config: OmieCallParams): Promise<T> {
  await waitForSlot();

  const body = {
    call: config.call,
    app_key: process.env.OMIE_APP_KEY || '',
    app_secret: process.env.OMIE_APP_SECRET || '',
    param: [config.params],
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      activeRequests++;
      lastRequestTime = Date.now();

      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      activeRequests--;

      if (res.ok) return (await res.json()) as T;

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const text = await res.text().catch(() => '');
        throw new Error(`Omie ${res.status}: ${text}`);
      }

      lastError = new Error(`Omie HTTP ${res.status}`);
    } catch (err) {
      activeRequests = Math.max(0, activeRequests - 1);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes('Omie 4') && !lastError.message.includes('429')) throw lastError;
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export interface ListPagesConfig {
  endpoint: string;
  call: string;
  params: Record<string, unknown>;
  dataKey: string;
  pageSize?: number;
  paginationStyle?: 'default' | 'mf';
}

export interface ListPagesResult<TRecord> {
  records: TRecord[];
  totalPages: number;
  lastPage: number;
}

/**
 * Fetch a range of pages from a paginated Omie endpoint.
 * If `toPage` is not provided, fetches all pages from `fromPage`.
 */
export async function omieListPages<TRecord>(
  config: ListPagesConfig,
  fromPage = 1,
  toPage?: number,
): Promise<ListPagesResult<TRecord>> {
  const { endpoint, call, params, dataKey, pageSize = 100, paginationStyle = 'default' } = config;
  const all: TRecord[] = [];
  let page = fromPage;
  let totalPages = 1;

  const pageField = paginationStyle === 'mf' ? 'nPagina' : 'pagina';
  const sizeField = paginationStyle === 'mf' ? 'nRegPorPagina' : 'registros_por_pagina';
  const totalField = paginationStyle === 'mf' ? 'nTotPaginas' : 'total_de_paginas';

  do {
    const result = await omieCall<Record<string, unknown>>({
      endpoint,
      call,
      params: { ...params, [pageField]: page, [sizeField]: pageSize },
    });

    const records = (result[dataKey] as TRecord[]) || [];
    all.push(...records);
    totalPages = (result[totalField] as number) || 1;
    page++;
  } while (page <= totalPages && (!toPage || page <= toPage));

  return { records: all, totalPages, lastPage: page - 1 };
}

export async function omieListAll<TRecord>(config: ListPagesConfig): Promise<TRecord[]> {
  const { records } = await omieListPages<TRecord>(config);
  return records;
}
