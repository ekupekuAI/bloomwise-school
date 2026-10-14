-- SmartSchool Manager — security hardening. Run AFTER 001 and 002.
-- Safe to re-run.
--
-- Fixes:
--  1. Users could UPDATE their own `role` / `school_id` (teacher → admin, or hop into
--     another school and read its students). Only `full_name` is now editable.
--  2. Rows could reference a student/subject/exam from a different school as long as
--     `school_id` was the caller's own. A trigger now enforces tenant consistency.
--  3. Audit columns (marked_by, created_by, sent_by) were client-supplied and spoofable.
--  4. The `student-photos` bucket was public and its SELECT policy allowed anyone
--     (including signed-out visitors) to list and download every school's student
--     photos. The bucket is now private, readable only by the same school, and the app
--     uses short-lived signed URLs.

-- ---------------------------------------------------------------------------
-- 1. users: only full_name is user-editable
-- ---------------------------------------------------------------------------

REVOKE UPDATE ON public.users FROM anon, authenticated;
GRANT UPDATE (full_name) ON public.users TO authenticated;

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Defence in depth in case column grants are ever widened again.
CREATE OR REPLACE FUNCTION public.users_lock_identity_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
       NEW.id IS DISTINCT FROM OLD.id
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.school_id IS DISTINCT FROM OLD.school_id
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'Only full_name can be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_lock_identity_columns ON public.users;
CREATE TRIGGER users_lock_identity_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_lock_identity_columns();

-- ---------------------------------------------------------------------------
-- 2. Tenant consistency for rows that point at students / subjects / exams
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_same_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.students WHERE id = NEW.student_id AND school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Student does not belong to this school' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'marks' THEN
    IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = NEW.subject_id AND school_id = NEW.school_id)
       OR NOT EXISTS (SELECT 1 FROM public.exams WHERE id = NEW.exam_id AND school_id = NEW.school_id) THEN
      RAISE EXCEPTION 'Subject or exam does not belong to this school' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_same_school ON public.attendance;
CREATE TRIGGER attendance_same_school BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_school();

DROP TRIGGER IF EXISTS fees_same_school ON public.fees;
CREATE TRIGGER fees_same_school BEFORE INSERT OR UPDATE ON public.fees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_school();

DROP TRIGGER IF EXISTS fee_payments_same_school ON public.fee_payments;
CREATE TRIGGER fee_payments_same_school BEFORE INSERT OR UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_school();

DROP TRIGGER IF EXISTS marks_same_school ON public.marks;
CREATE TRIGGER marks_same_school BEFORE INSERT OR UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_same_school();

CREATE OR REPLACE FUNCTION public.enforce_subject_teacher_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.teacher_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = NEW.teacher_id AND school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Teacher does not belong to this school' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subjects_teacher_school ON public.subjects;
CREATE TRIGGER subjects_teacher_school BEFORE INSERT OR UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subject_teacher_school();

-- ---------------------------------------------------------------------------
-- 3. Audit columns are stamped server-side from the caller's JWT
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stamp_actor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], auth.uid()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_stamp_actor ON public.attendance;
CREATE TRIGGER attendance_stamp_actor BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.stamp_actor('marked_by');

DROP TRIGGER IF EXISTS fee_payments_stamp_actor ON public.fee_payments;
CREATE TRIGGER fee_payments_stamp_actor BEFORE INSERT ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_actor('created_by');

DROP TRIGGER IF EXISTS alerts_stamp_actor ON public.alerts;
CREATE TRIGGER alerts_stamp_actor BEFORE INSERT ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.stamp_actor('sent_by');

-- ---------------------------------------------------------------------------
-- 4. Private student photos, scoped to the school folder
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "student_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_delete" ON storage.objects;

CREATE POLICY "student_photos_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.get_my_school_id()::text
  );

CREATE POLICY "student_photos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.get_my_school_id()::text
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "student_photos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.get_my_school_id()::text
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "student_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = public.get_my_school_id()::text
    AND public.get_my_role() = 'admin'
  );
