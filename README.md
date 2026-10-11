# Fund Pulse: Mutual Fund Tracker

Track your mutual funds weekly against a market index (proxy) and the average of similar funds, with a plain-language AI summary emailed every Saturday at 8 AM IST.

**Stack:** Next.js 14 (App Router, TypeScript, Tailwind) · Supabase · Gemini Flash (`@google/genai`) · Resend · NewsData.io · Vercel Cron

---

## 1. Get your keys (all free tiers)

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | [supabase.com](https://supabase.com) → **New project** (pick region *Mumbai*, save the DB password somewhere) → wait ~2 min → **Project Settings → API**. Copy *Project URL* and the **`service_role`** secret (not `anon`). Newer projects show it under **API Keys → Secret keys**; a `sb_secret_...` key works too. |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → sign in with Google → **Create API key** → copy. |
| `GEMINI_MODEL` | Set to `gemini-3.6-flash` unless you want another Flash model. |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → sign up → **API Keys → Create API Key** (permission: *Sending access*) → copy (shown once). |
| `REPORT_EMAIL_TO` | The email address you signed up to Resend with. Without a verified domain, Resend's test sender `onboarding@resend.dev` **can only send to that address**. To send elsewhere, verify a domain under **Domains** and set `RESEND_FROM`. |
| `NEWSDATA_API_KEY` | [newsdata.io/register](https://newsdata.io/register) → verify email → **Dashboard** shows your API key. Free plan = 200 credits/day; we use 1/day. If it fails, the app falls back to Google News RSS. |
| `CRON_SECRET` | Any long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |

## 2. Create the database

Supabase dashboard → **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**. You should see 5 tables under **Table Editor**.

## 3. Run locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev                  # http://localhost:3000
```

Add a fund from the page (search by name, click it). Adding a fund saves it, picks the benchmark proxy and 10 peers, and backfills two years of NAVs plus 52 weekly snapshots for all of them (~20–40 s).

Optional CLI backfill / bulk add:

```bash
npm run seed                    # re-backfill all active funds
npm run seed -- 122639 118989   # add these scheme codes, then backfill
```

Test the jobs locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly
```

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. [vercel.com/new](https://vercel.com/new) → import the repo (framework auto-detected as Next.js).
3. Under **Environment Variables** add every variable from `.env.example`.
4. **Deploy**. Crons from `vercel.json` are registered automatically on production deploys (see **Settings → Cron Jobs**):
   - daily `30 18 * * *` UTC (midnight IST): refresh NAVs + store news
   - weekly `30 2 * * 6` UTC (Sat 8:00 AM IST): snapshot + Gemini report + email

   Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes automatically. On the Hobby plan, cron timing can drift within the hour.

> **Privacy:** the dashboard, `/api/funds` and `/api/report/run` have no login. If you share the URL, anyone can add or remove funds and trigger a report (rate-limited to once every 2 minutes). Turn on **Settings → Deployment Protection** in Vercel if that matters to you.

## How numbers are calculated

- **Returns:** `% = (current / past − 1) × 100`. WoW = vs 7 days ago, MoM = vs 1 month ago, YTD = vs last NAV of previous December. `getNavOnOrBefore()` steps back over weekends and holidays.
- **Indices tracked (proxies):** only the three in the brief: Nifty 50 (UTI Nifty 50 Index Fund, 120716), Nifty Midcap 150 (Motilal Oswal Nifty Midcap 150 Index Fund, 147622), Nifty Smallcap 100 (Zerodha Nifty Smallcap 100 ETF, 153837). mfapi has no index data, so index-fund NAVs stand in. Each Indian equity fund is matched to one of them by category; debt and overseas funds have no matching index and are compared with their similar-funds average only.
- **Category average:** mean return of 10 Direct-Growth peers from the same AMFI category (parsed from `NAVAll.txt`), stored in `funds.peer_codes`.

## Project layout

```
app/api/cron/daily     NAV + news refresh (cron, bearer auth)
app/api/cron/weekly    snapshot + report + email (cron, bearer auth)
app/api/report/run     same as weekly, for the dashboard button
app/api/funds          GET list / POST add / DELETE (soft) remove
app/api/search         mfapi name search
app/api/dashboard      data for the page
lib/                   returns, mfapi, AMFI, benchmarks, news, gemini, email, jobs
scripts/seed.ts        CLI backfill
supabase/schema.sql    tables
```
