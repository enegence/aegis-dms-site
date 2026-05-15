# Aegis DMS Site — Deployment Guide

This guide covers deploying Aegis DMS Site to Railway with PostgreSQL, Stripe, Postmark, and R2/S3 storage.

---

## Architecture Overview

The production deployment is a single Docker container that:

- Serves the compiled React frontend (Vite → `server/static/`) as static files
- Runs the Fastify API server on port 8001
- Connects to a Railway-managed PostgreSQL database
- Communicates with Stripe, Postmark, and R2/S3 via env vars

---

## Railway Services Setup

### 1. Create a Railway project

1. Go to [railway.app](https://railway.app) and create a new project.
2. Add a **PostgreSQL** service from the Railway template.
3. Add a **new service** and connect it to this GitHub repo.

### 2. Configure the web service

Railway detects the `railway.toml` and `Dockerfile` automatically.

- **Build**: Dockerfile (multi-stage, node:20-alpine)
- **Health check path**: `/health`
- **Health check timeout**: 100s
- **Restart policy**: On failure, max 3 retries

### 3. Set environment variables

In Railway → Service → Variables, add all required vars listed below.

---

## Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Railway PostgreSQL connection string (auto-set by Railway plugin) | `postgresql://user:pass@host:5432/dbname` |
| `AEGIS_SECRET_KEY` | Session signing secret, >= 32 chars, random | `openssl rand -hex 32` |
| `AEGIS_FIELD_ENCRYPTION_KEY` | AES-256 field encryption key, exactly 32 chars | `openssl rand -hex 16` |
| `AEGIS_BASE_URL` | Public URL of the deployed app (no trailing slash) | `https://app.aegisdms.life` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_RELAY_PRICE_ID` | Stripe price ID for the Relay plan | `price_...` |
| `STRIPE_HOSTED_PRICE_ID` | Stripe price ID for the Hosted plan | `price_...` |
| `POSTMARK_API_TOKEN` | Postmark server API token | `abc123...` |
| `POSTMARK_FROM_EMAIL` | Verified sender email for Postmark | `noreply@aegisdms.life` |
| `AEGIS_ADMIN_EMAILS` | Comma-separated admin email addresses | `admin@aegisdms.life` |

### Optional environment variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Must be `production` in production | `production` |
| `AEGIS_PORT` | Server port | `8001` |
| `AEGIS_HOST` | Server bind host | `0.0.0.0` |
| `AEGIS_TELEGRAM_BOT_TOKEN` | Telegram bot token for Telegram alerts | (disabled if empty) |
| `AEGIS_STORAGE_ENDPOINT` | R2/S3 endpoint URL (empty = AWS S3) | (AWS S3) |
| `AEGIS_STORAGE_REGION` | Storage region | `auto` |
| `AEGIS_STORAGE_BUCKET` | Storage bucket name | (required for packet uploads) |
| `AEGIS_STORAGE_ACCESS_KEY_ID` | Storage access key ID | (required for packet uploads) |
| `AEGIS_STORAGE_SECRET_ACCESS_KEY` | Storage secret access key | (required for packet uploads) |
| `AEGIS_STORAGE_PREFIX` | Key prefix for stored packets | `packets/` |
| `AEGIS_STORAGE_FORCE_PATH_STYLE` | Use path-style S3 URLs (for MinIO) | `false` |

> **Note:** The server will refuse to start in production if any required secret is missing, set to a default value, or too short. Check Railway logs for the specific validation error.

---

## PostgreSQL Provisioning

Railway provides a managed PostgreSQL service.

1. In your Railway project, click **+ New Service** → **Database** → **PostgreSQL**.
2. Railway automatically sets `DATABASE_URL` as a shared variable — reference it in your app service using `${{Postgres.DATABASE_URL}}`.
3. Run migrations after first deploy (see Migrations section below).

---

## Stripe Webhook Setup

1. In the Stripe Dashboard → **Developers** → **Webhooks**, add an endpoint:
   - URL: `https://your-domain.com/api/billing/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
2. Copy the **Signing secret** (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET`.

---

## Postmark Domain Setup

1. In the [Postmark account](https://account.postmarkapp.com), add a **Sender Signature** or set up a **Domain** for your sending email.
2. Add DKIM and Return-Path DNS records to your domain.
3. Create a **Server** in Postmark and copy the **Server API Token**.
4. Set `POSTMARK_API_TOKEN` and `POSTMARK_FROM_EMAIL` accordingly.

---

## R2 / S3 Storage Setup (for packet uploads)

Aegis Hosted uses S3-compatible storage to store encrypted packet archives.

### Cloudflare R2 (recommended)

1. In the Cloudflare dashboard, go to **R2** → **Create bucket**.
2. In **R2 → Manage R2 API tokens**, create a token with **Object Read & Write** on the bucket.
3. Set env vars:
   ```
   AEGIS_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   AEGIS_STORAGE_REGION=auto
   AEGIS_STORAGE_BUCKET=aegis-packets
   AEGIS_STORAGE_ACCESS_KEY_ID=<r2-access-key-id>
   AEGIS_STORAGE_SECRET_ACCESS_KEY=<r2-secret-access-key>
   ```

### AWS S3

1. Create an S3 bucket in your preferred region.
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the bucket.
3. Set env vars (omit `AEGIS_STORAGE_ENDPOINT` for AWS):
   ```
   AEGIS_STORAGE_REGION=us-east-1
   AEGIS_STORAGE_BUCKET=aegis-packets
   AEGIS_STORAGE_ACCESS_KEY_ID=<access-key-id>
   AEGIS_STORAGE_SECRET_ACCESS_KEY=<secret-access-key>
   ```

---

## Health Checks

The health endpoint is at `GET /health` and returns:

```json
{ "status": "ok", "version": "0.1.0", "uptime": 42 }
```

Railway polls this endpoint after each deploy. If it doesn't return 200 within 100 seconds, the deploy is marked failed and the previous version is kept.

---

## Migration Commands

Drizzle migrations must be run after first deploy and after any schema changes.

### Using Railway CLI

```bash
railway run npm run db:migrate
```

### Using Railway shell

In Railway → Service → Shell:

```bash
npm run db:migrate
```

This runs `tsx src/db/migrate.ts` which applies all pending Drizzle migrations.

---

## Custom Domain and DNS Setup

### Pointing `aegisdms.life` to Railway

1. In Railway → Service → **Settings** → **Domains**, click **Generate Domain** to get your Railway service URL (e.g. `aegis-site-production.up.railway.app`).
2. In your DNS provider (e.g. Cloudflare), add a **CNAME** record:
   - **Name**: `app` (or `@` for apex, using CNAME flattening)
   - **Target**: your Railway service URL (without `https://`)
   - **TTL**: 300 (or Automatic)
3. Back in Railway → Domains, click **+ Custom Domain** and enter `app.aegisdms.life`.
4. Railway provisions a TLS certificate automatically via Let's Encrypt. Wait ~2 minutes for DNS propagation and certificate issuance.
5. Update `AEGIS_BASE_URL` to `https://app.aegisdms.life`.

> **Note:** Railway does not support bare apex CNAME on all DNS providers without CNAME flattening. Use a `www.` or `app.` subdomain if your DNS provider does not support CNAME flattening.

### Cookie / CORS / CSRF production settings

These are validated at startup when `NODE_ENV=production`. Verify:

- `SESSION_SECRET` (mapped to `AEGIS_SECRET_KEY`) is >= 32 chars and does not contain "change-me"
- `AEGIS_BASE_URL` is `https://app.aegisdms.life` (no trailing slash, no localhost)
- The React frontend `VITE_API_BASE_URL` points to the same origin (same-origin deployment; the server serves the frontend)
- Cookies are `HttpOnly`, `Secure`, `SameSite=Lax` — enforced by the server in production
- CORS allows `https://app.aegisdms.life` explicitly (no wildcard in production)
- CSRF token is fetched at `/api/csrf` and sent as `X-CSRF-Token` header on all state-changing requests

---

## Environment Separation

Aegis DMS uses three Railway environments:

| Environment | Branch | `NODE_ENV` | `AEGIS_BASE_URL` | Purpose |
|---|---|---|---|---|
| **Production** | `main` | `production` | `https://app.aegisdms.life` | Live traffic |
| **Staging** | `phase-5` or `staging` | `production` | `https://staging.aegisdms.life` | Pre-release validation |
| **Development** | Feature branches | `development` | `http://localhost:8001` | Local dev (no Railway) |

### Setting up a staging environment

1. In Railway → **Environments**, click **+ New Environment** → name it `staging`.
2. In the staging environment, add a new service pointing to the same repo.
3. Set `NODE_ENV=production` and all required secrets (use separate Stripe test-mode keys).
4. Add a staging domain (e.g. `staging.aegisdms.life`) following the same DNS setup steps above.

Staging uses **Stripe test-mode** keys (`sk_test_...`, `pk_test_...`). Never use live-mode keys in staging.

---

## Rollback Procedure

Railway automatically keeps the previous successful deployment. To rollback:

1. Go to Railway → Service → **Deployments**.
2. Find the last successful deployment and click **Redeploy**.
3. Verify the rollback succeeded by checking the health endpoint: `curl https://app.aegisdms.life/health`

**If a schema migration was applied before the rollback:**
- Drizzle does not auto-generate down migrations.
- Keep a SQL dump before applying any destructive schema change: `railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql`
- Manually apply a reverting SQL statement via Railway shell if the migration must be rolled back.

**Rollback decision matrix:**

| Condition | Action |
|---|---|
| Code bug, no schema change | Redeploy previous via Railway UI |
| Code bug + additive schema change (new nullable column) | Redeploy previous (old code tolerates new column) |
| Code bug + destructive schema change (column removed) | Restore DB from backup, redeploy previous |

---

## Post-Deploy Smoke-Test Checklist

Run these checks after every production deploy before marking the release complete.

| # | Check | Command / Action | Expected |
|---|---|---|---|
| 1 | **Health endpoint** | `curl -sf https://app.aegisdms.life/health` | `{"status":"ok"}` with HTTP 200 |
| 2 | **CSRF endpoint** | `curl -sf https://app.aegisdms.life/api/csrf` | Returns `{"token":"..."}` |
| 3 | **Static assets load** | Open `https://app.aegisdms.life` in browser | Landing page renders, no console errors |
| 4 | **Auth: register flow** | Create a new test account | Registration succeeds, verification email received via Postmark |
| 5 | **Auth: login flow** | Log in with the test account | Dashboard loads, session cookie set |
| 6 | **Auth: logout flow** | Log out | Redirected to `/`, session cleared |
| 7 | **Stripe billing portal** | Navigate to `/app/billing` | Billing page loads, "Manage Subscription" link visible |
| 8 | **Postmark delivery** | Trigger a password-reset email | Email received in < 2 minutes |
| 9 | **Database connectivity** | `/health` returns 200 (server connected) + check Railway Metrics → DB connections > 0 | No DB errors in Railway logs |
| 10 | **TLS certificate** | `curl -Iv https://app.aegisdms.life` | TLS handshake succeeds, cert valid, no hostname mismatch |

If any check fails: roll back immediately (see Rollback Procedure above) and investigate Railway logs.

---

## Local Production Build Test

To test the Docker build locally (without prod secrets):

```bash
docker build -t aegis-site .
```

To run the built image in dev mode (no prod validation):

```bash
docker run -p 8001:8001 \
  -e DATABASE_URL=postgresql://aegis:aegis@host.docker.internal:5432/aegis_site \
  -e AEGIS_SECRET_KEY=dev-only-key-not-for-production-use \
  -e AEGIS_FIELD_ENCRYPTION_KEY=dev-only-field-key-32-bytes-long \
  aegis-site
```

> Do not set `NODE_ENV=production` unless all required secrets are populated — the server will refuse to start.
