import { toLocalISODate } from './dates';

/** Academic year starts June 1 → e.g. June 2025 → 2025-2026 */
function startYear(date: Date): number {
  return date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
}

export function currentAcademicYearLabel(date = new Date()): string {
  const y = startYear(date);
  return `${y}-${y + 1}`;
}

/** Inclusive date range of the academic year, for filtering payment_date. */
export function academicYearRange(date = new Date()): { start: string; end: string } {
  const y = startYear(date);
  return {
    start: toLocalISODate(new Date(y, 5, 1)),
    end: toLocalISODate(new Date(y + 1, 4, 31)),
  };
}
