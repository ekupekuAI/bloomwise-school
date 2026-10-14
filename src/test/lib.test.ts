import { describe, it, expect } from 'vitest';
import { toLocalISODate, monthBounds } from '@/lib/dates';
import { academicYearRange, currentAcademicYearLabel } from '@/lib/academicYear';
import { feeStatus, sumPaymentsByStudent } from '@/lib/fees';
import { classKey, parseClassKey, uniqueClassKeys } from '@/lib/classes';
import { gradeFromMarks } from '@/lib/grades';
import { generateReceiptNumber } from '@/lib/receipt';
import { normalizeDob, normalizeGender } from '@/lib/bulkUpload';
import { sanitizeSearchTerm } from '@/lib/search';
import { photoPath } from '@/lib/photos';

describe('dates', () => {
  it('formats in local time, not UTC', () => {
    expect(toLocalISODate(new Date(2026, 0, 2, 0, 30))).toBe('2026-01-02');
  });
  it('returns month bounds', () => {
    expect(monthBounds(new Date(2026, 1, 14))).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds(new Date(2028, 1, 1))).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
});

describe('academic year', () => {
  it('starts in June', () => {
    expect(currentAcademicYearLabel(new Date(2026, 5, 1))).toBe('2026-2027');
    expect(currentAcademicYearLabel(new Date(2026, 4, 31))).toBe('2025-2026');
  });
  it('gives the inclusive date range', () => {
    expect(academicYearRange(new Date(2026, 9, 14))).toEqual({ start: '2026-06-01', end: '2027-05-31' });
  });
});

describe('fees', () => {
  it('derives one consistent status', () => {
    expect(feeStatus(0, 0)).toBe('none');
    expect(feeStatus(0, 500)).toBe('paid');
    expect(feeStatus(10000, 0)).toBe('unpaid');
    expect(feeStatus(10000, 4000)).toBe('partial');
    expect(feeStatus(10000, 10000)).toBe('paid');
  });
  it('sums payments per student', () => {
    expect(
      sumPaymentsByStudent([
        { student_id: 'a', amount_paid: 100 },
        { student_id: 'a', amount_paid: '50' },
        { student_id: 'b', amount_paid: 10 },
      ])
    ).toEqual({ a: 150, b: 10 });
  });
});

describe('class keys', () => {
  it('round-trips when the class itself contains a hyphen', () => {
    expect(parseClassKey(classKey('LKG-1', 'A'))).toEqual({ cls: 'LKG-1', section: 'A' });
    expect(parseClassKey(classKey('10', 'B'))).toEqual({ cls: '10', section: 'B' });
  });
  it('dedupes and sorts naturally', () => {
    expect(
      uniqueClassKeys([
        { class: '10', section: 'A' },
        { class: '9', section: 'B' },
        { class: '9', section: 'A' },
        { class: '10', section: 'A' },
      ])
    ).toEqual(['9-A', '9-B', '10-A']);
  });
});

describe('grades', () => {
  it('maps percentages', () => {
    expect(gradeFromMarks(95, 100)).toBe('A+');
    expect(gradeFromMarks(45, 50)).toBe('A+');
    expect(gradeFromMarks(49, 100)).toBe('F');
    expect(gradeFromMarks(10, 0)).toBe('F');
  });
});

describe('receipts', () => {
  it('do not collide across rapid calls', () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateReceiptNumber()));
    expect(set.size).toBe(2000);
    expect(generateReceiptNumber(new Date(2026, 9, 14))).toMatch(/^RCP-20261014-[A-Z0-9]{6}$/);
  });
});

describe('bulk upload', () => {
  it('normalises Excel serials, Date objects and dd/mm/yyyy', () => {
    expect(normalizeDob(40193)).toBe('2010-01-15');
    expect(normalizeDob(new Date(2010, 0, 15))).toBe('2010-01-15');
    expect(normalizeDob('15/01/2010')).toBe('2010-01-15');
    expect(normalizeDob('2010-1-5')).toBe('2010-01-05');
    expect(normalizeDob('not a date')).toBe('');
  });
  it('normalises gender', () => {
    expect(normalizeGender('f')).toBe('Female');
    expect(normalizeGender('MALE')).toBe('Male');
    expect(normalizeGender('')).toBe('');
  });
});

describe('search', () => {
  it('strips PostgREST filter syntax', () => {
    expect(sanitizeSearchTerm(' Riya,(x)*% ')).toBe('Riya x');
  });
});

describe('photos', () => {
  it('extracts the storage path from legacy public URLs', () => {
    expect(photoPath('https://x.supabase.co/storage/v1/object/public/student-photos/s1/a.jpg')).toBe('s1/a.jpg');
    expect(photoPath('s1/a.jpg')).toBe('s1/a.jpg');
    expect(photoPath(null)).toBeNull();
  });
});
