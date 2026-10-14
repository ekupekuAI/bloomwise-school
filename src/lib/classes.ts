/** Dropdown value for a class + section. Parse with parseClassKey (splits on the last '-'). */
export function classKey(cls: string, section: string): string {
  return `${cls}-${section}`;
}

export function parseClassKey(key: string): { cls: string; section: string } {
  const i = key.lastIndexOf('-');
  if (i < 0) return { cls: key, section: '' };
  return { cls: key.slice(0, i), section: key.slice(i + 1) };
}

/** Unique class keys, sorted naturally (9 before 10). */
export function uniqueClassKeys(rows: { class: string; section: string }[]): string[] {
  return Array.from(new Set(rows.map((r) => classKey(r.class, r.section)))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}
