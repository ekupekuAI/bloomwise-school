-- Run AFTER creating bucket "student-photos" in Supabase Dashboard → Storage.
-- Recommended: public bucket for simple <img src> URLs.

-- Optional: create bucket via SQL (if your project allows)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true)
-- ON CONFLICT (id) DO NOTHING;

CREATE POLICY "student_photos_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');

CREATE POLICY "student_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = (SELECT school_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "student_photos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = (SELECT school_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "student_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = (SELECT school_id::text FROM public.users WHERE id = auth.uid())
  );
