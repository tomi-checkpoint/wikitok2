# Deploying Supabase on Railway

## Prerequisites
- Railway account (https://railway.app)
- Railway CLI installed: `npm i -g @railway/cli`

## Step 1: Deploy from Template

1. Go to https://railway.app/template/supabase
2. Click "Deploy Now"
3. Railway will create a new project with these services:
   - **Postgres** — primary database
   - **Kong** — API gateway
   - **GoTrue** — authentication (Auth)
   - **PostgREST** — REST API for Postgres
   - **Realtime** — WebSocket server
   - **Storage** — file storage API
   - **Studio** — admin dashboard UI
   - **PgBouncer** — connection pooler

4. Wait for all services to deploy (5-10 minutes)

## Step 2: Configure Environment Variables

After deployment, go to each service's settings in Railway and verify/update:

### Required Variables (set on the Kong service)
- `JWT_SECRET` — auto-generated, note this value
- `ANON_KEY` — auto-generated
- `SERVICE_ROLE_KEY` — auto-generated

### SMTP (set on GoTrue service for email verification)
```
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=<your-resend-api-key>
GOTRUE_SMTP_ADMIN_EMAIL=admin@wikitok.app
GOTRUE_SMTP_SENDER_NAME=WikiTok
GOTRUE_MAILER_AUTOCONFIRM=false
```

If you don't have an SMTP provider yet, set `GOTRUE_MAILER_AUTOCONFIRM=true` temporarily.

## Step 3: Get Your API URL

Your Supabase API URL is the **public domain** of the Kong service. Find it in:
Railway Dashboard → Your Project → Kong service → Settings → Domains

It will look like: `https://kong-production-XXXX.up.railway.app`

## Step 4: Generate Local .env

Copy `.env.example` to `.env` and fill in:
```bash
cp .env.example .env
```

Required values from Railway:
- `SUPABASE_URL` — Kong's public domain
- `SUPABASE_ANON_KEY` — from Kong service vars
- `SUPABASE_SERVICE_ROLE_KEY` — from Kong service vars
- `POSTGRES_URL` — direct Postgres connection string (from Postgres service)
- `PGBOUNCER_URL` — pooled connection string (from PgBouncer service)

## Step 5: Set Up Storage Buckets

```bash
cd infra
npx tsx scripts/setup-storage.ts
```

## Step 6: Run Gate 1 Tests

```bash
cd infra
npx tsx tests/gate1.test.ts
```

All 7 tests must pass before proceeding to Phase 2.

## Step 7: Run Database Migrations

```bash
cd infra
npx tsx scripts/run-migrations.ts
```

## Step 8: Run Gate 2 Tests

```bash
cd infra
npx tsx tests/gate2.test.ts
```

All 25 tests must pass before proceeding to Phase 3.
