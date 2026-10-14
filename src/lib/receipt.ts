/** RCP-YYYYMMDD-XXXXXX — 6 random base36 chars (~2 billion combinations per day). */
export function generateReceiptNumber(date = new Date()): string {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `RCP-${ymd}-${rand}`;
}
