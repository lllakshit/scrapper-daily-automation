# Career Autopilot

A private, single-user career workflow for Lakshit. It discovers legitimate public job feeds, removes expired and duplicate listings, permanently suppresses jobs already shown, ranks relevant opportunities, and supports application and interview tracking.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill the required values.
3. Start the app: `npm run dev`
4. Open the displayed local URL and sign in with `APP_EMAIL` plus the configured password.

Local development stores state in `.data/`. Production uses Vercel Blob state when `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID` is configured. Resume uploads are also written to Blob paths under `career-autopilot/resumes/`. Without Blob credentials, the app falls back to per-instance memory so the UI can run, but seen jobs, profile data, and resume artifacts are not durable across cold starts or redeploys.

## Required Vercel environment variables

- `APP_EMAIL` — the only permitted account email
- `APP_PASSWORD_HASH` — recommended scrypt password hash; `APP_PASSWORD` is supported for initial setup
- `APP_SESSION_SECRET` (or `SESSION_SECRET`) — random secret containing at least 32 bytes
- `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID` — Vercel Blob storage for durable production state
- `CRON_SECRET` — protects scheduled scans
- `AI_API_KEY`, `AI_MODEL`, `AI_API_URL` — optional OpenAI-compatible structured matching; deterministic ranking is the safe fallback
- `APP_ORIGIN` — optional canonical deployment origin for same-origin validation
- `RAPIDAPI_KEY` — optional; enables RapidAPI job searches for LinkedIn, Indeed, Glassdoor, Workday, Ashby, Greenhouse, Lever, and Wellfound
- `RAPIDAPI_JOBS_HOST` — optional; defaults to `jsearch.p.rapidapi.com`
- `RAPIDAPI_JOB_SOURCE_LIMIT` — optional; limits RapidAPI platform queries per scan, default `8`; set `0` to use only open/free sources

Never prefix secrets with `NEXT_PUBLIC_`.

## First-use workflow

1. Sign in.
2. Upload a PDF, DOCX, or TXT resume from **Profile**.
3. Review and approve the extracted draft.
4. Save target roles, locations, work modes, employment types, and salary preferences.
5. Run **Scan now**.
6. Review only strong, active, unseen opportunities.

Resume extraction is conservative. It never invents experience and requires explicit approval.

## Job safety rules

- Expired or closed jobs are removed before matching.
- Exact and conservative cross-source duplicates are merged.
- Each surfaced listing records multiple durable identity aliases. It remains in the decision queue until you save, prepare, or reject it, but URL variants, cross-posts, and unchanged reposts never return as new opportunities in a later scan.
- One failing source does not cancel successful source results.
- Built-in no-key sources are Remotive, Arbeitnow, and RemoteOK. RapidAPI platform sources are used only when `RAPIDAPI_KEY` is configured.
- No application or follow-up is submitted automatically.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run test:e2e
npm run build
```

The scheduled scan is configured for 8:00 AM India time (`02:30 UTC`) in `vercel.json` and calls `/api/cron/scan` with Vercel's cron authorization header.
