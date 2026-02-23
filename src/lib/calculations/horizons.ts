import { isWithinInterval } from 'date-fns';
import { getHorizonRange, HORIZON_LABELS, type HorizonKey, type DateRange } from '@/lib/utils/dates';
import type { TituloCalculado } from './titulo-metrics';

export interface HorizonResult {
  key: HorizonKey;
  label: string;
  previsto: number;
  quantidade: number;
}

type DateMode = 'vencimento' | 'previsao';

function getDateField(titulo: TituloCalculado, mode: DateMode): Date {
  if (mode === 'previsao' && titulo.dataPrevisao) {
    return titulo.dataPrevisao;
  }
  return titulo.dataVencimento;
}

export function calculateHorizons(
  titulos: TituloCalculado[],
  mode: DateMode,
  referenceDate: Date = new Date()
): HorizonResult[] {
  const horizonKeys: HorizonKey[] = ['today', '7d', '14d', '30d', '60d', '90d', '6m'];

  // Only open titles
  const openTitulos = titulos.filter(
    (t) => t.status !== 'CANCELADO' && t.status !== 'LIQUIDADO' && t.saldoEmAberto > 0
  );

  return horizonKeys.map((key) => {
    const range = getHorizonRange(key, referenceDate);
    const matching = openTitulos.filter((t) => {
      const dateVal = getDateField(t, mode);
      return isWithinInterval(dateVal, { start: range.start, end: range.end });
    });

    return {
      key,
      label: HORIZON_LABELS[key],
      previsto: matching.reduce((sum, t) => sum + t.saldoEmAberto, 0),
      quantidade: matching.length,
    };
  });
}

export function calculatePrevistoInRange(
  titulos: TituloCalculado[],
  range: DateRange,
  mode: DateMode
): number {
  return titulos
    .filter(
      (t) =>
        t.status !== 'CANCELADO' &&
        t.status !== 'LIQUIDADO' &&
        t.saldoEmAberto > 0
    )
    .filter((t) => {
      const dateVal = getDateField(t, mode);
      return isWithinInterval(dateVal, { start: range.start, end: range.end });
    })
    .reduce((sum, t) => sum + t.saldoEmAberto, 0);
}
