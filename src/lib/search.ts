/** Remove characters that have meaning inside a PostgREST or=(...) filter. */
export function sanitizeSearchTerm(s: string): string {
  return s.replace(/[,()*%\\:"]/g, ' ').replace(/\s+/g, ' ').trim();
}
