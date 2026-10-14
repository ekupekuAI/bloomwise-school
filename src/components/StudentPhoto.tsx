import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PHOTO_BUCKET, photoPath } from '@/lib/photos';
import { cn } from '@/lib/utils';

const cache = new Map<string, { url: string; expires: number }>();

/** Signed URL for a photo in the private student-photos bucket (cached for ~50 min). */
export function useSignedPhotoUrl(value: string | null | undefined): string | null {
  const path = photoPath(value);
  const [url, setUrl] = useState<string | null>(() => {
    const hit = path ? cache.get(path) : undefined;
    return hit && hit.expires > Date.now() ? hit.url : null;
  });

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const hit = cache.get(path);
    if (hit && hit.expires > Date.now()) {
      setUrl(hit.url);
      return;
    }
    let alive = true;
    void supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!alive) return;
        if (data?.signedUrl) cache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
        setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return url;
}

type Props = { value: string | null | undefined; className?: string; iconClassName?: string };

export function StudentPhoto({ value, className, iconClassName }: Props) {
  const url = useSignedPhotoUrl(value);
  return (
    <div className={cn('rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0', className)}>
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <User className={cn('w-4 h-4 text-primary', iconClassName)} />
      )}
    </div>
  );
}
