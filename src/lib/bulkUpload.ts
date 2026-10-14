import { toLocalISODate } from './dates';

/** Spreadsheet DOB → YYYY-MM-DD, or '' if unparseable. Handles Excel serials, Date, ISO and dd/mm/yyyy. */
export function normalizeDob(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : toLocalISODate(v);
  if (typeof v === 'number') {
    if (v < 1 || v > 100000) return '';
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d+(\.\d+)?$/.test(s)) return normalizeDob(Number(s));
  return '';
}

export function normalizeGender(v: string): string {
  const g = v.trim().toLowerCase();
  if (g === 'm' || g === 'male') return 'Male';
  if (g === 'f' || g === 'female') return 'Female';
  if (g) return 'Other';
  return '';
}
