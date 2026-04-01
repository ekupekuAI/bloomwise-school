# SmartSchool Manager

React + Vite + Tailwind + shadcn/ui school management app: students, attendance, fees, marks, report cards, and parent alerts. Data is isolated per school via **Supabase** (PostgreSQL + Auth + Storage).

## Quick start

```bash
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run dev
```

Apply SQL from `supabase/migrations/` in the Supabase SQL editor, create the `student-photos` bucket (see `002_storage_student_photos.sql`), then register an admin at `/register`.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Dev server (port 8080) |
| `npm run build` | Production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E (Playwright) |

## Tech stack

Vite, React 18, TypeScript, React Router, TanStack Query, Supabase, jsPDF, xlsx, EmailJS (optional).

## License

Private / your terms — configure as needed for your repository.
