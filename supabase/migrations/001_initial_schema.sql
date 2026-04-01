-- SmartSchool Manager — run in Supabase SQL Editor (or via CLI migrations)
-- Requires: extensions pgcrypto (for gen_random_uuid) if not already enabled

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text,
  logo_url text,
  school_code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'teacher')),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_school ON public.users (school_id);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  roll_number text NOT NULL,
  class text NOT NULL,
  section text NOT NULL,
  dob date,
  gender text,
  parent_name text,
  parent_phone text,
  parent_email text,
  address text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, roll_number)
);

CREATE INDEX IF NOT EXISTS idx_students_school ON public.students (school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students (school_id, class, section);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  marked_by uuid REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON public.attendance (school_id, date);

CREATE TABLE IF NOT EXISTS public.fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  total_fee_amount numeric NOT NULL DEFAULT 0,
  academic_year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, academic_year)
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  amount_paid numeric NOT NULL,
  payment_date date NOT NULL,
  payment_mode text NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'bank', 'cheque')),
  receipt_number text NOT NULL,
  note text,
  created_by uuid REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON public.fee_payments (student_id);

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  name text NOT NULL,
  class text NOT NULL,
  section text NOT NULL,
  teacher_id uuid REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_school_class ON public.subjects (school_id, class, section);

CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('unit_test', 'mid_term', 'final')),
  class text NOT NULL,
  section text NOT NULL,
  date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exams_school_class ON public.exams (school_id, class, section);

CREATE TABLE IF NOT EXISTS public.marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams (id) ON DELETE CASCADE,
  marks_obtained numeric NOT NULL DEFAULT 0,
  max_marks numeric NOT NULL DEFAULT 100,
  grade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, exam_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_marks_student ON public.marks (student_id);

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  message text NOT NULL,
  type text NOT NULL,
  recipient_type text NOT NULL,
  sent_by uuid REFERENCES public.users (id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS idx_alerts_school ON public.alerts (school_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER for RLS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Bootstrap first admin: call after auth.signUp while session is active
-- Required args first; all parameters after the first DEFAULT must also have defaults (PostgreSQL rule).
CREATE OR REPLACE FUNCTION public.register_new_school(
  p_school_name text,
  p_full_name text,
  p_address text DEFAULT '',
  p_phone text DEFAULT '',
  p_email text DEFAULT '',
  p_logo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_code text;
  v_auth_email text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User profile already exists';
  END IF;

  SELECT email INTO v_auth_email FROM auth.users WHERE id = auth.uid();
  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.schools (name, address, phone, email, logo_url, school_code)
  VALUES (p_school_name, p_address, p_phone, p_email, p_logo_url, v_code)
  RETURNING id INTO v_school_id;

  INSERT INTO public.users (id, email, full_name, role, school_id)
  VALUES (auth.uid(), v_auth_email, p_full_name, 'admin', v_school_id);

  RETURN v_school_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_new_school(text, text, text, text, text, text) TO authenticated;

-- Teacher self-registration with existing school code
CREATE OR REPLACE FUNCTION public.register_teacher(
  p_school_code text,
  p_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_auth_email text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User profile already exists';
  END IF;

  SELECT id INTO v_school_id FROM public.schools WHERE school_code = upper(trim(p_school_code));
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Invalid school code';
  END IF;

  SELECT email INTO v_auth_email FROM auth.users WHERE id = auth.uid();
  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.users (id, email, full_name, role, school_id)
  VALUES (auth.uid(), v_auth_email, p_full_name, 'teacher', v_school_id);

  RETURN v_school_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_teacher(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- schools
CREATE POLICY schools_select ON public.schools
  FOR SELECT USING (id = public.get_my_school_id());
CREATE POLICY schools_update_admin ON public.schools
  FOR UPDATE USING (id = public.get_my_school_id() AND public.get_my_role() = 'admin');

-- users
CREATE POLICY users_select ON public.users
  FOR SELECT USING (id = auth.uid() OR school_id = public.get_my_school_id());
CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (id = auth.uid());

-- students — admin full; teacher read
CREATE POLICY students_admin_all ON public.students
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());
CREATE POLICY students_teacher_read ON public.students
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'teacher');

-- attendance — admin + teacher (same school)
CREATE POLICY attendance_admin_all ON public.attendance
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());
CREATE POLICY attendance_teacher_rw ON public.attendance
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'teacher')
  WITH CHECK (school_id = public.get_my_school_id());

-- marks — admin + teacher
CREATE POLICY marks_admin_all ON public.marks
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());
CREATE POLICY marks_teacher_rw ON public.marks
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'teacher')
  WITH CHECK (school_id = public.get_my_school_id());

-- subjects — admin full; teacher read
CREATE POLICY subjects_admin_all ON public.subjects
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());
CREATE POLICY subjects_teacher_read ON public.subjects
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'teacher');

-- exams — admin full; teacher read
CREATE POLICY exams_admin_all ON public.exams
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());
CREATE POLICY exams_teacher_read ON public.exams
  FOR SELECT USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'teacher');

-- fees & fee_payments — admin only
CREATE POLICY fees_admin_all ON public.fees
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());
CREATE POLICY fee_payments_admin_all ON public.fee_payments
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());

-- alerts — admin only
CREATE POLICY alerts_admin_all ON public.alerts
  FOR ALL USING (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
  WITH CHECK (school_id = public.get_my_school_id());

-- ---------------------------------------------------------------------------
-- Storage bucket policies (run AFTER creating bucket "student-photos" in Dashboard)
-- ---------------------------------------------------------------------------
-- Storage → New bucket → id: student-photos → Public bucket (recommended for <img src>)
-- Then run:
/*
INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO NOTHING;

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
*/
