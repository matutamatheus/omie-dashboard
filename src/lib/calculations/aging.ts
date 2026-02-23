export enum AgingBucket {
  EM_DIA = 'Em dia',
  DAYS_1_30 = '1-30 dias',
  DAYS_31_60 = '31-60 dias',
  DAYS_61_90 = '61-90 dias',
  OVER_90 = '90+ dias',
}

export const AGING_BUCKETS = [
  AgingBucket.EM_DIA,
  AgingBucket.DAYS_1_30,
  AgingBucket.DAYS_31_60,
  AgingBucket.DAYS_61_90,
  AgingBucket.OVER_90,
] as const;

export function classifyAging(diasAtraso: number): AgingBucket {
  if (diasAtraso <= 0) return AgingBucket.EM_DIA;
  if (diasAtraso <= 30) return AgingBucket.DAYS_1_30;
  if (diasAtraso <= 60) return AgingBucket.DAYS_31_60;
  if (diasAtraso <= 90) return AgingBucket.DAYS_61_90;
  return AgingBucket.OVER_90;
}

export interface AgingBucketResult {
  bucket: AgingBucket;
  saldo: number;
  quantidade: number;
}

export interface AgingByClient {
  clienteId: number;
  clienteNome: string;
  buckets: Record<AgingBucket, number>;
  total: number;
}

export function calculateAgingBuckets(
  titulos: Array<{ saldoEmAberto: number; diasAtraso: number }>
): AgingBucketResult[] {
  const map = new Map<AgingBucket, { saldo: number; quantidade: number }>();

  for (const bucket of AGING_BUCKETS) {
    map.set(bucket, { saldo: 0, quantidade: 0 });
  }

  for (const titulo of titulos) {
    const bucket = classifyAging(titulo.diasAtraso);
    const entry = map.get(bucket)!;
    entry.saldo += titulo.saldoEmAberto;
    entry.quantidade += 1;
  }

  return AGING_BUCKETS.map((bucket) => ({
    bucket,
    ...map.get(bucket)!,
  }));
}

export function calculateAgingByClient(
  titulos: Array<{
    clienteId: number;
    clienteNome: string;
    saldoEmAberto: number;
    diasAtraso: number;
  }>
): AgingByClient[] {
  const clientMap = new Map<number, AgingByClient>();

  for (const titulo of titulos) {
    if (!clientMap.has(titulo.clienteId)) {
      clientMap.set(titulo.clienteId, {
        clienteId: titulo.clienteId,
        clienteNome: titulo.clienteNome,
        buckets: {
          [AgingBucket.EM_DIA]: 0,
          [AgingBucket.DAYS_1_30]: 0,
          [AgingBucket.DAYS_31_60]: 0,
          [AgingBucket.DAYS_61_90]: 0,
          [AgingBucket.OVER_90]: 0,
        },
        total: 0,
      });
    }

    const client = clientMap.get(titulo.clienteId)!;
    const bucket = classifyAging(titulo.diasAtraso);
    client.buckets[bucket] += titulo.saldoEmAberto;
    client.total += titulo.saldoEmAberto;
  }

  return Array.from(clientMap.values()).sort((a, b) => b.total - a.total);
}
