# MYAIGURU

MYAIGURU is a Next.js learning platform with PostgreSQL persistence, Prisma, and Auth.js credentials authentication. Student and trainer dashboard information is loaded from authenticated API routes. Student AI Insights and the learning assistant use a configurable OpenAI-compatible chat completions API.

## Local setup

Requirements: Node.js 20+, npm, and PostgreSQL.

1. Install packages:

   ```powershell
   npm install
   ```

2. Create a local environment file and set the database connections and secret:

   ```powershell
   Copy-Item .env.example .env
   ```

   Neon CLI writes `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) to `.env.local`; the Prisma CLI loads `.env.local` for migrations. Both connections should include `sslmode=require`. Set `AUTH_SECRET` to a long, random value. `AUTH_TRUST_HOST=true` is needed for local production-mode testing and self-hosting behind a trusted proxy; do not enable it behind an untrusted proxy. Keep local environment files private and do not commit them.

3. Generate the Prisma client, apply the schema, and load demonstration data:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   To apply the existing migrations to Neon, run `npx prisma migrate deploy` instead of `npm run db:migrate`. The latter uses Prisma's development migration flow and may prompt for a migration name if the schema has changed.

4. Start the application:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000/login`.

## Configure AI Insights

Set these server-only variables in `.env.local` (or your hosting provider's environment settings):

```dotenv
AI_API_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="your-provider-api-key"
AI_API_MODEL="gpt-4o-mini"
```

Use your provider's OpenAI-compatible API base URL and model identifier. The base URL should include any API version prefix such as `/v1`, but not `/chat/completions`. Keep the API key out of source control and never use a `NEXT_PUBLIC_` prefix. AI requests are sent from the server; the learning assistant and dashboard insight require a signed-in student account. The insight prompt sends aggregate course progress, quiz performance, attendance, and study time to the configured provider, not the student's name or contact details.

Restart the Next.js server after changing these variables.

The connected Neon project is in `ap-southeast-2`, which is not currently supported by Neon AI Gateway. This integration therefore uses the external provider URL and key configured above.

## Demo accounts

The seed creates one admin, three trainers, and 120 students. The default password for all seeded accounts is `MyaiguruDemo2026!`; set `DEMO_PASSWORD` before seeding to choose a different password.

| Role | Email |
| --- | --- |
| Admin | `admin@myaiguru.demo` |
| Trainer | `trainer1@myaiguru.demo`, `trainer2@myaiguru.demo`, `trainer3@myaiguru.demo` |
| Student | `student001@myaiguru.demo` through `student120@myaiguru.demo` |

These are local demonstration credentials, not production credentials.

## Source layout

The app remains a single Next.js project; the source is organized by frontend and backend responsibility:

- `src/frontend/` — client-facing React components and frontend-only sample data.
- `src/backend/` — authentication, database access, API/business services, validation, and server utilities.
- `src/app/` — Next.js-required page and route entry points. API route files delegate to implementations in `src/backend/`.
- `prisma/` — database schema, migrations, and seed data.

This is a code organization split, not two independently deployable applications.

## API overview

- `/api/auth/*` — Auth.js sign-in/out and student registration.
- `/api/me` — authenticated user profile and notifications.
- `/api/student/*` — dashboard, courses, progress, attendance, assignments, quizzes, and study sessions.
- `/api/student/ai-insights` — authenticated AI learning assistant and personalized insight generation.
- `/api/trainer/*` — dashboard, assigned batches/students, attendance, assignments/reviews, lessons, and reports.
- `/api/admin/*` — user, course, batch, and enrollment administration.

Authorization is checked on the server for each API request. Trainers are scoped to their assigned batches; students are scoped to their own enrollments and records.

## Operational notes

- The API rate limiter is process-local and is suitable only for local/demo single-process use. Replace it with a shared store (for example Redis) before running multiple production instances.
- A PostgreSQL instance and valid `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `AUTH_SECRET` are required for sign-in, API requests, migrations, and seeding. The repository does not include database credentials.
- Keep `DATABASE_URL` and `AUTH_SECRET` server-side. Do not expose them through `NEXT_PUBLIC_*` environment variables.
- Keep `AI_API_KEY` server-side as well. If it is unset or the provider is unavailable, the AI endpoints return a clear configuration/provider error rather than mock content.
