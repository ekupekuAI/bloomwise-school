/** YYYY-MM-DD in the browser's local timezone (toISOString() would use UTC and shift the day). */
export function toLocalISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First and last day (inclusive) of the month containing `d`, as local YYYY-MM-DD. */
export function monthBounds(d: Date): { start: string; end: string } {
  return {
    start: toLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toLocalISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}
