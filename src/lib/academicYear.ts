export function currentAcademicYearLabel(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  // Academic year starts June 1 → e.g. June 2025 → 2025-2026
  const startYear = m >= 5 ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}
