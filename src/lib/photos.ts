export const PHOTO_BUCKET = 'student-photos';

/**
 * Storage path for a student photo. Older rows stored the full public URL; newer rows
 * store just the path (the bucket is private and read through signed URLs).
 */
export function photoPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/${PHOTO_BUCKET}/`;
  const i = value.indexOf(marker);
  if (/^https?:\/\//.test(value)) return i >= 0 ? decodeURIComponent(value.slice(i + marker.length).split('?')[0]) : null;
  return value;
}
