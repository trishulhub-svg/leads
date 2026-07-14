# Trishulhub Leads

Automated **Lead Generation + 8-SMTP Email Marketing + Minimalist CRM** — a single-owner application built for founders who want to run cold email outreach without the complexity of a multi-tenant SaaS.

Built as one full-stack **Next.js 15 (App Router)** app with **Turso (libSQL)**, deployable to **Vercel**.

---

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#    → Edit .env.local: set AUTH_SECRET, OWNER_EMAIL, OWNER_PASSWORD
#    → For local dev, leave TURSO_DATABASE_URL=file:local.db (no Turso account needed)

# 3. Create the database schema
cp .env.local .env        # drizzle-kit reads .env
npx drizzle-kit push

# 4. Seed the owner account + 4 default email templates
npx tsx drizzle/seed.ts

# 5. Run the dev server
npm run dev
#    → Open http://localhost:3000 and log in with your OWNER_EMAIL / OWNER_PASSWORD
```

## Deploy to Vercel + Turso (production)

1. **Create a Turso database** at [turso.tech](https://turso.tech):
   ```bash
   turso db create trishulhub-leads
   turso db tokens create trishulhub-leads    # → your auth token
   turso db show trishulhub-leads --url        # → your database URL
   ```
2. **Push the schema** to Turso (set the env vars locally first):
   ```bash
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx drizzle-kit push
   ```
3. **Seed** the owner + templates:
   ```bash
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... OWNER_EMAIL=you@... OWNER_PASSWORD=... npx tsx drizzle/seed.ts
   ```
4. **Deploy to Vercel** and set these environment variables in the Vercel dashboard:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   - `AUTH_SECRET` (a long random string)
   - `OWNER_EMAIL`, `OWNER_PASSWORD` (only used by seed)
   - `NEXT_PUBLIC_BASE_URL` (your Vercel URL, e.g. `https://your-app.vercel.app`)
   - `CRON_SECRET` (a random string — secures the cron endpoints)
   - Optional: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`
     (these can also be saved securely from Settings)

The checked-in `vercel.json` uses Hobby-compatible once-daily schedules so a
new deployment works without a paid plan:
- **00:00 UTC daily**: drains the sending queue (`/api/cron/process-campaigns`)
- **00:15 UTC daily**: polls inboxes for replies (`/api/cron/check-replies`)
- **01:00 UTC daily**: resets SMTP daily counters (`/api/cron/reset-smtp-limits`)

> **Throughput note:** Vercel **Hobby** limits each cron to once/day and does not
> guarantee minute-level precision. For active outreach, upgrade to **Vercel
> Pro**, then change `process-campaigns` to `* * * * *` and `check-replies` to
> `*/5 * * * *`. You may also invoke the protected cron endpoints from another
> scheduler using the `Authorization: Bearer <CRON_SECRET>` header.

---

## Features

### 1. Lead Acquisition
- **Location discovery (India)**: enter a city/locality/PIN code, business type,
  and radius. The app finds public business records through OpenStreetMap,
  scans their websites and contact pages, and imports discovered emails.
- **DeepSeek ranking**: optionally ranks verified discovery results for relevance.
  The API URL and model identifier are configurable, including future DeepSeek
  V4 Flash identifiers exposed by your provider. AI does not invent lead records.
- **URL scraping**: fetch any page and extract all email addresses + `mailto:` links.
- **File import**: upload CSV, Excel (.xlsx), or TXT files. CSV/Excel columns are auto-detected (email, first_name, company).
- **Smart deduplication**: a unique index on `sent_emails` guarantees an email can only ever be sent once — **if an email was ever sent before, it cannot be added to a new campaign** (enforced at the database level).

### 2. The 8-SMTP Load Balancer
- Configure exactly **4 Primary + 4 Emergency** SMTP servers in Settings.
- **Load balancing**: sends are split round-robin across the 4 Primaries.
- **Failover**: when a Primary hits its daily limit or fails a health check, traffic automatically routes to the next healthy Primary; when all Primaries are exhausted, it fails over to the 4 Emergency SMTPs.
- **Test Connection**: each SMTP has a one-click test that verifies the connection without sending mail.
- SMTP passwords are **encrypted at rest** (AES-256-GCM, derived from `AUTH_SECRET`).

### 3. Campaign & Template Engine
- **4 default professional HTML templates** (Cold Intro, Follow-up, Value Offer, Case Study) — seeded automatically and editable.
- Templates support dynamic variables: `{{first_name}}`, `{{company}}`, `{{email}}`.
- Clear CTAs: landing-page links or WhatsApp click-to-chat.
- Open-tracking pixel included (best-effort — many email clients block images).

### 4. Reply-to-CRM Workflow
- The system polls each SMTP's IMAP inbox (every 5 minutes via cron) for replies.
- **CRM transfer rule**: leads stay in "Raw Leads" until they reply. A detected reply auto-promotes them into the CRM.
- Replies are classified automatically:
  - **Positive** → CRM stage "Contacted"
  - **Negative** (unsubscribe, not interested) → CRM stage "Wasted"
  - **Bounce** (delivery failure) → lead blacklisted + email marked bounced
  - **Autoreply** (out of office) → logged, no action
- Classification uses keyword heuristics in v1. There's a clearly-marked **LLM hook** (`classifyReply()` in `src/lib/replyClassifier.ts`) — swap in an OpenAI call by editing one function.

### 5. Minimalist CRM
- Only shows leads that have replied.
- **Strict stages**: Contacted → Discussed → Done OR Wasted.
- Kanban + List views, search, notes per lead.

### 6. Single-Owner Auth & Security
- Beautiful, minimal login page with dark/light mode.
- JWT (HS256 via `jose`) in an httpOnly cookie, bcrypt password hashing.
- Password reset via OTP sent through your bound SMTP.
- Edge middleware gates all routes — unauthenticated users redirect to login.

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Turso (libSQL) via Drizzle ORM |
| Auth | `jose` JWT + bcrypt + httpOnly cookie + edge middleware |
| Email sending | nodemailer (8-SMTP pool with load balancing + failover) |
| Reply monitoring | ImapFlow + mailparser (IMAP polling via Vercel Cron) |
| Lead discovery | OpenStreetMap/Nominatim/Overpass + public website scanning |
| AI ranking | DeepSeek-compatible chat completions API (optional) |
| Queue | Turso-backed job table drained by Vercel Cron (replaces Redis/BullMQ) |
| UI | Tailwind CSS + shadcn-style components + next-themes (dark/light) |

### Why no Redis/BullMQ/Docker?
The original spec assumed Express + Postgres + Redis + Docker. You chose Next.js + Turso on Vercel. That platform is **serverless** — there are no always-on processes. So the queue and inbox listener are replaced with their idiomatic Vercel equivalents: a DB-backed job table drained by **cron routes**. This is more robust for a single-owner system and requires zero infrastructure to operate.

---

## NPM scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:seed` | Seed the owner account + default templates |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |
| `npm run typecheck` | TypeScript type-check |

## Test scripts

Smoke tests for the core engines (run with `npx tsx scripts/...`):
- `scripts/test-auth.ts` — login credential verification
- `scripts/test-loadbalancer.ts` — 8-SMTP round-robin + failover
- `scripts/test-leads.ts` — dedup + import logic
- `scripts/test-campaign.ts` — campaign enqueue + dedup
- `scripts/test-classifier.ts` — reply classification

---

## What's intentionally out of scope (v1)

- **Deep site crawling / search-engine email harvesting**: ToS-sensitive and needs a dedicated scraping service. v1 does single-URL extraction; a clean seam (`scrapeBySearch`) is left to add later.
- **LLM-based reply classification**: heuristic keywords ship first. One function to swap (`classifyReply`).
- **A full preference/unsubscribe center**: a one-click "reply stop to unsubscribe" footer is included; a hosted preference center is not.
