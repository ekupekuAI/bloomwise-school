# SmartSchool Manager

React + Vite + Tailwind + shadcn/ui school management app: students, attendance, fees, marks, report cards, and parent alerts. Data is isolated per school via **Supabase** (PostgreSQL + Auth + Storage, with Row Level Security).

- **Admin**: registers the school, gets a school code, manages students (single or bulk Excel/CSV upload), fees and receipts, marks, report cards (PDF / ZIP), parent alerts.
- **Teacher**: joins with the school code, marks attendance, enters marks, views students.

## Quick start

```bash
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
npm run dev            # http://localhost:8080
```

Supabase setup (SQL editor, in order):

1. `supabase/migrations/001_initial_schema.sql`
2. Create the `student-photos` storage bucket, then run `002_storage_student_photos.sql`
3. `supabase/migrations/003_security_hardening.sql` — **required**; also run it on existing projects (see below)

Then open `/register` and create the first school (admin).

If your Supabase project requires email confirmation (the default), the school / teacher profile is created the first time the user signs in after confirming.

## Environment variables

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `VITE_SUPABASE_URL` | yes | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Same page → `anon` `public` key |
| `VITE_EMAILJS_SERVICE_ID` | for email alerts | [EmailJS](https://dashboard.emailjs.com) → Email Services |
| `VITE_EMAILJS_TEMPLATE_ID` | for email alerts | EmailJS → Email Templates (variables: `to_email`, `message`, `school`, `type`) |
| `VITE_EMAILJS_PUBLIC_KEY` | for email alerts | EmailJS → Account → Public Key |

Without the Supabase variables the app shows a setup message on the sign-in pages instead of crashing. Without EmailJS, alerts can still be logged ("Log only").

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Dev server (port 8080) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E (Playwright; dashboard tests need `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`) |

## What changed in this version

Security (migration `003_security_hardening.sql`):

- Users could change their own `role` / `school_id` — a teacher could make themselves admin or move into another school and read its students. Only `full_name` is editable now.
- Student photos were in a public bucket whose policy let anyone, even signed-out visitors, list and download every school's photos. The bucket is now private, readable only by the same school, and the app uses short-lived signed URLs. Existing photo URLs keep working.
- Attendance, fees, payments and marks can no longer reference a student / subject / exam from another school; `marked_by` / `created_by` / `sent_by` are set by the database.

Bug fixes:

- Blank page when `.env` was missing (now a clear setup message).
- Sign-up with email confirmation left users without a profile, unable to log in — now finished on first sign-in.
- Fee totals, balances and defaulters counted payments from previous academic years; fee status differed between the Students and Fees pages ("Overdue" is now "Partial", plus "No fee set"; teachers, who can't see fees, no longer get a misleading fee column).
- Rapid clicks on "Collect Fee" recorded duplicate payments; receipt numbers could collide; the PDF receipt printed a garbled ₹ sign.
- Dates used UTC (attendance / payments could land on the wrong day in India before 5:30 am).
- Marks entry saved blank fields as 0, allowed marks above the maximum, and didn't show marks already entered.
- Report cards mixed every exam into one total — pick the exam and the student now.
- Admin dashboard showed made-up "pending" bars and "0% present" when attendance wasn't marked; teacher dashboard was entirely hard-coded sample data — it now shows today's attendance per class and the teacher's subjects.
- Parent alerts were logged as "sent" even when email wasn't configured or failed.
- Bulk upload: Excel dates and DD/MM/YYYY DOBs failed or were read as MM/DD; missing gender defaulted to "Male"; failures now list the reason.
- Student search broke on commas/brackets; classes containing "-" broke class filters; photo picker showed no preview; unknown student IDs spun forever.

## Tech stack

Vite, React 18, TypeScript, React Router, TanStack Query, Supabase, jsPDF, xlsx, EmailJS (optional).

## License

Private / your terms — configure as needed for your repository.
