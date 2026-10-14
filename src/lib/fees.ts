export type FeeStatus = 'paid' | 'partial' | 'unpaid' | 'none';

/** Single source of truth for a student's fee status (total = annual fee, paid = this year's payments). */
export function feeStatus(total: number, paid: number): FeeStatus {
  if (total <= 0) return paid > 0 ? 'paid' : 'none';
  if (paid >= total) return 'paid';
  if (paid <= 0) return 'unpaid';
  return 'partial';
}

export const feeStatusLabel: Record<FeeStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  none: 'No fee set',
};

export const feeStatusBadge: Record<FeeStatus, string> = {
  paid: 'badge-paid',
  partial: 'badge-overdue',
  unpaid: 'badge-unpaid',
  none: 'badge-none',
};

export function sumPaymentsByStudent(
  rows: { student_id: string; amount_paid: number | string }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((p) => {
    out[p.student_id] = (out[p.student_id] ?? 0) + Number(p.amount_paid);
  });
  return out;
}
