# Aegis DMS Site — Operations Guide

This guide covers day-to-day operational procedures for running the Aegis DMS Site SaaS alpha responsibly.

---

## Service Overview

| Component | Where it runs | Purpose |
|---|---|---|
| **Fastify API server** | Railway (Docker container) | REST API, session management, Stripe/Postmark integration |
| **React frontend** | Served as static files by the API server | Browser UI |
| **PostgreSQL** | Railway managed database service | All application state |
| **Background worker** | In-process thread within the API server | Relay offline detection, heartbeat monitoring |
| **R2/S3 storage** | Cloudflare R2 (or AWS S3) | Encrypted packet archives |
| **Stripe** | External (Stripe cloud) | Subscription billing, checkout, portal |
| **Postmark** | External (Postmark cloud) | Transactional email delivery |

The entire server-side process runs in a single Railway service. There is no separate worker dyno in the alpha — the monitor loop runs as an in-process interval.

---

## Required Environment Variables

See [`docs/deployment.md`](deployment.md) for the complete, authoritative list of required and optional environment variables.

The required secrets are:

- `DATABASE_URL`
- `AEGIS_SECRET_KEY`
- `AEGIS_FIELD_ENCRYPTION_KEY`
- `AEGIS_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_RELAY_PRICE_ID`
- `STRIPE_HOSTED_PRICE_ID`
- `POSTMARK_API_TOKEN`
- `POSTMARK_FROM_EMAIL`
- `AEGIS_ADMIN_EMAILS`

The server will refuse to start in production if any required secret is missing, too short, or set to a default value.

---

## Migration Procedure

Drizzle migrations must be applied after the first deploy and after any schema change is deployed.

### Via Railway CLI (preferred)

```bash
railway run npm run db:migrate
```

### Via Railway shell

In Railway → Service → Shell:

```bash
npm run db:migrate
```

### Locally (against production DB — use with caution)

```bash
DATABASE_URL="postgresql://..." npm run db:migrate --workspace=server
```

> Always take a database snapshot (Railway → PostgreSQL → Backups) before running migrations against production data.

---

## Deploy Procedure

### Automatic deploy (normal path)

Railway auto-deploys when a commit is pushed to the tracked branch (usually `main`). The flow is:

1. Railway detects the push.
2. Builds the Docker image using the multi-stage `Dockerfile`.
3. Starts the new container.
4. Polls `GET /health` until it returns 200 (timeout: 100s).
5. Switches traffic to the new container.
6. Keeps the previous deployment available for rollback.

### Manual deploy

In Railway → Service → **Deployments** → **Deploy Now**, or:

```bash
railway up
```

### Rollback

In Railway → Service → **Deployments**, find the last successful deployment and click **Redeploy**. If a schema migration was applied, a corresponding down-migration SQL may need to be run manually before rollback.

---

## Log Review

### Accessing logs

In Railway → Service → **Logs**. Filter by deployment or time range.

### What to look for

| Signal | Likely cause |
|---|---|
| `Server refusing to start: missing secret` | Required env var not set |
| `database connection failed` | DATABASE_URL wrong or PostgreSQL service down |
| `Stripe webhook signature invalid` | STRIPE_WEBHOOK_SECRET mismatch or request body buffered before verification |
| `Postmark error` | POSTMARK_API_TOKEN invalid or from-email not verified |
| `relay monitor: connection X marked offline` | Expected — a relay connection missed its heartbeat |
| `relay monitor: alert sent for connection X` | Expected — offline alert email dispatched |
| `storage: put failed` | R2/S3 credentials wrong or bucket unreachable |
| HTTP 5xx spike | Check for DB connection exhaustion or upstream API failure |

---

## Health Check

```
GET /health
```

Returns:

```json
{ "status": "ok", "version": "0.1.0", "uptime": 42 }
```

- HTTP 200: server is up and accepting requests.
- No auth required.
- Railway uses this endpoint to validate deploys. If it returns non-200 within 100s, the deploy fails and the previous version is kept.

To test manually:

```bash
curl https://your-domain.com/health
```

---

## Backup Assumptions

### Database

Railway PostgreSQL includes automatic daily backups. Retention and point-in-time recovery depend on your Railway plan. Before any destructive operation (migration, bulk delete), manually trigger a backup via Railway → PostgreSQL → **Backups** → **Create backup**.

### Object storage (R2/S3)

Cloudflare R2 provides 99.999999999% (11 nines) durability. Objects are not versioned by default — a deleted packet is gone. There is no automatic cross-region replication in the alpha.

AWS S3 standard storage also provides 11 nines durability. Enable versioning on the bucket if you want protection against accidental deletes.

---

## Known Limitations (Alpha)

- **No high availability.** Single Railway container — a crash or deploy causes a brief outage.
- **No TOTP / MFA.** Password + email verification only.
- **No Shamir Secret Sharing.** The encryption key is a single server-held secret.
- **No zero-knowledge guarantees.** Server holds field encryption keys.
- **No formal security audit.** Has not been reviewed by a third-party security firm.
- **In-process worker.** The relay monitor loop runs in the same process as the API server. A crash takes both down simultaneously.
- **No formal SLA.** Alpha availability is best-effort.
- **Prices are placeholders.** Do not treat displayed amounts as final.
- **Relay Escrow contact cascade not yet automated.** The release run is created but contacts are not yet notified automatically (targeted for Phase 4).
