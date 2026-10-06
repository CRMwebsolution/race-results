# TrackScore

TrackScore is a standalone multi-tenant SaaS platform for track and venue owners to configure race events, record official results, publish live standings, and manage single meets or full seasons.

This repository implements the authoritative specification defined in `docs/TrackScore-Product-Engineering-Blueprint.md`.

For a breakdown of all implementation phases and current progress, see [**Phase Roadmap & Status Tracker**](docs/ROADMAP.md).

---

## Technical Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row-Level Security, Supabase Auth via `@supabase/ssr`)
- **Testing**: [Vitest](https://vitest.dev/)
- **Scoring Engine**: Framework-independent pure TypeScript contract and plug-ins

---

## Local Development Setup

### 1. Prerequisites
- Node.js 20+ (tested on v22)
- npm 10+ (or pnpm 10+)
- Supabase CLI (`supabase`)

### 2. Install Dependencies
Dependencies are strictly pinned in `package.json` with a committed lockfile:
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in the required values from your Supabase Project settings:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-never-expose-to-client>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
> **Security Note**: Never commit secrets, service-role keys, or credentials to Git. Client-side browser code only ever receives `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Supabase Connection & Migrations

### Project Reference
- **Scoped Project Reference**: `kzugyadzbqnurwbkmrik`
- **Database Schema**: Versioned migrations located in `supabase/migrations/`

### Applying Migrations
Apply migrations through the Supabase CLI or Supabase MCP:
```bash
supabase link --project-ref kzugyadzbqnurwbkmrik
supabase db push
```

### Row Level Security (RLS)
Every application table enforces Row Level Security (RLS). Authorization is evaluated on verified organization or track memberships linked to `auth.uid()`, never user-editable metadata.

---

## Test & Verification Commands

### Automated Unit Tests (Vitest)
Runs the framework-independent scoring engine tests, including parsing, ranking, fastest-pass, stopped-distance, consistency, disqualifications, blank attempts, and regression suites:
```bash
npm test
```
To run tests in watch mode:
```bash
npm run test:watch
```

### Type Checking
```bash
npm run typecheck
```

### Production Build
```bash
npm run build
```

---

## Architecture & Scoring Engine

The scoring engine is completely decoupled from UI components, React, Supabase, and the database:
- **`src/scoring/types.ts`**: Core types (`Score`, `Attempt`, `Scorer`, `compareScores`).
- **`src/scoring/fastest-pass.ts`**: Lowest valid timed pass wins; completed timed passes strictly outrank stopped distances; fallback to greatest stopped distance.
- **`src/scoring/consistency.ts`**: Two-pass consistency (absolute difference between two valid timed passes rounded to configured decimals); best pass is first tiebreaker.
- **`src/scoring/parser.ts`**: Normalization and parsing of raw attempt inputs (e.g. `9.082`, `200ft`, `DQ`, `DNF`) while preserving `raw_input` untouched.
