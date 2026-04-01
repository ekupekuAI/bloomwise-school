/** Grade from percentage (marks / max * 100). */
export function gradeFromPercentage(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'F';
}

export function gradeFromMarks(obtained: number, maxMarks: number): string {
  if (!maxMarks || maxMarks <= 0) return 'F';
  return gradeFromPercentage((obtained / maxMarks) * 100);
}
