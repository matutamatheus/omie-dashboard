import { addDays, addMonths, format, parse, differenceInDays, startOfDay, endOfDay } from 'date-fns';

/** Convert JS Date to Omie DD/MM/AAAA string */
export function toOmieDate(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

/** Convert Omie DD/MM/AAAA string to JS Date */
export function fromOmieDate(omieDate: string): Date {
  return parse(omieDate, 'dd/MM/yyyy', new Date());
}

/** Convert JS Date to ISO date string (YYYY-MM-DD) for Supabase */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Calculate days overdue (0 if not overdue) */
export function daysOverdue(dueDate: Date, referenceDate: Date = new Date()): number {
  return Math.max(0, differenceInDays(startOfDay(referenceDate), startOfDay(dueDate)));
}

/** Horizon definitions */
export type HorizonKey = 'today' | '7d' | '14d' | '30d' | '60d' | '90d' | '6m' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export function getHorizonRange(horizon: HorizonKey, referenceDate: Date = new Date()): DateRange {
  const start = startOfDay(referenceDate);
  switch (horizon) {
    case 'today':
      return { start, end: endOfDay(referenceDate) };
    case '7d':
      return { start, end: endOfDay(addDays(referenceDate, 7)) };
    case '14d':
      return { start, end: endOfDay(addDays(referenceDate, 14)) };
    case '30d':
      return { start, end: endOfDay(addDays(referenceDate, 30)) };
    case '60d':
      return { start, end: endOfDay(addDays(referenceDate, 60)) };
    case '90d':
      return { start, end: endOfDay(addDays(referenceDate, 90)) };
    case '6m':
      return { start, end: endOfDay(addMonths(referenceDate, 6)) };
    case 'custom':
      return { start, end: endOfDay(addDays(referenceDate, 30)) }; // default fallback
  }
}

export const HORIZON_LABELS: Record<HorizonKey, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '14d': '14 dias',
  '30d': '30 dias',
  '60d': '60 dias',
  '90d': '90 dias',
  '6m': '6 meses',
  custom: 'Personalizado',
};
