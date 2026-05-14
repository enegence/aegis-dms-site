# Aegis Relay — Operations and Behavior

## What Relay Monitoring Does

Relay Monitoring allows self-hosted Aegis Core instances to report periodic heartbeats to the Aegis SaaS platform. The SaaS server tracks whether heartbeats arrive on schedule. If a heartbeat is missed beyond a configurable grace window, the connection is marked offline and the owning user receives an alert email via Postmark.

Relay Monitoring increases situational awareness — the user knows their self-hosted instance has gone silent. It does **not** complete a release by itself. The local Aegis Core host may still be required for final release unless Relay Escrow is configured (Phase 3).

## Heartbeat Setup

Aegis Core sends a `POST /api/relay/heartbeat` request on the configured interval using the relay API key:

```
POST /api/relay/heartbeat
Authorization: Bearer <relay_api_key>
Content-Type: application/json
```

The request body is validated against `HeartbeatRequestSchema` from `packages/contracts`. The schema includes at minimum:

```typescript
{
  intervalHours: number;  // expected interval between heartbeats
  // additional fields per contracts package
}
```

On success the server updates:
- `lastHeartbeatAt` — timestamp of the accepted heartbeat
- `lastExpectedHeartbeatAt` — computed as `now + intervalHours`
- `lastHeartbeatData` — the raw validated payload (no sensitive local config stored)
- `status` — reset to `active`

The status endpoint `GET /api/relay/status` (authenticated by API key) returns:

```typescript
{
  accepted: true,
  serverTimestamp: string,
  status: 'active' | 'offline' | 'disconnected',
  lastHeartbeatAt: string | null,
  nextExpectedAt: string | null
}
```

## API Key Handling

- Keys are generated with a `rlk_` prefix and high entropy.
- The raw key is shown exactly once: at creation and at rotation. After that, only the SHA-256 hash is retained.
- The raw key is never logged and never included in audit metadata.
- Key storage: only `SHA-256(raw_key)` is stored in `relay_connections.apiKeyHash`.
- Rotation: `POST /api/relay/connections/:id/rotate-key` generates a new key, returns it once, and immediately invalidates the previous key. Any in-flight heartbeats using the old key are rejected after rotation.
- Revocation: `POST /api/relay/connections/:id/revoke` marks the connection `disconnected`. Heartbeats from a revoked/disconnected connection are rejected.

The UI shows a one-time copy prompt at creation/rotation:

> Copy this key now. Aegis stores only a hash and cannot show it again.

## Offline Detection

The monitor worker computes whether a connection is overdue using `lastExpectedHeartbeatAt`:

```
if now > lastExpectedHeartbeatAt + AEGIS_RELAY_OFFLINE_GRACE_MINUTES:
  mark connection offline
  send alert if alert not recently sent
```

The default grace window is 10 minutes (`AEGIS_RELAY_OFFLINE_GRACE_MINUTES=10`).

`AEGIS_RELAY_DEFAULT_INTERVAL_HOURS` is used when a connection has no `lastExpectedHeartbeatAt` yet (before the first heartbeat arrives) to set a reasonable initial expectation window.

## Alert Behavior

- A single alert email is sent per offline event per connection.
- `offlineAlertSentAt` on the `relay_connections` row gates repeat sends. If the connection recovers (new heartbeat received) and goes offline again, a new alert is sent.
- Alerts are sent via Postmark using the server's email service.
- Alert email subject: "Aegis Relay has not heard from your self-hosted instance"
- Alert body notes that Relay Monitoring detects the missed heartbeat but does not complete release on its own.
- No estate data, contact data, or API key material appears in alert emails.

## Relay Monitoring vs. Relay Escrow

| | Relay Monitoring (Phase 2) | Relay Escrow (Phase 3) |
|---|---|---|
| Tracks heartbeats | Yes | Yes |
| Detects missed heartbeats | Yes | Yes |
| Sends offline alert | Yes | Yes |
| Holds release material | No | Yes |
| Executes release if host offline | No | Yes |
| Trust required | Low (awareness only) | High (holds material) |

Relay Monitoring is now complete. Relay Escrow is implemented in Phase 3. Do not conflate the two.

## Relay Escrow (Phase 3)

Relay Escrow is an explicit trust layer that allows Aegis SaaS to execute the configured release policy when the user's self-hosted instance remains offline.

### Enabling Escrow

Escrow is enabled per connection via a two-step process:

1. **Acknowledge** — `POST /api/relay/:id/escrow/acknowledge` — records a versioned trust acknowledgement confirming the user understands the trust model.
2. **Enable** — `POST /api/relay/:id/escrow/enable` — uploads encrypted release material (`materialEncrypted`) and the material type (`release_key`). The material is encrypted before transmission and stored in `relay_escrow_materials`. The plaintext is never stored server-side.

Both steps require CSRF. Escrow cannot be enabled without a prior acknowledgement for the current policy version.

### What Escrow Does in Alpha

When a connection remains offline and escrow is enabled:
- The Aegis SaaS worker detects the offline state.
- It checks eligibility: escrow enabled, not revoked, active subscription, no existing active release run for the user.
- If eligible, a release run is created with `source = relay_escrow` and `status = active`.
- An audit event `relay_assisted_release_started` is written with no PII in metadata.

**Alpha limitation:** Creating the release run is the extent of the automated action in the current release. Contact notification using the stored escrow material is not yet implemented. The release run record correctly occupies the "one active run" slot and is visible in the admin dashboard. Full relay-escrow contact cascade (delivering the decryption key to contacts) is targeted for Phase 4.

### Revocation

`POST /api/relay/:id/escrow/revoke` immediately revokes escrow. The `relay_escrow_materials` record is marked revoked (`revokedAt` set). A revoked escrow will not trigger a relay-assisted release even if the connection goes offline.

### Trust Model

Relay Escrow requires explicit trust in Aegis SaaS:
- The SaaS server holds encrypted release material.
- The SaaS server holds the decryption key.
- A compromised Aegis SaaS instance could decrypt the stored material.
- There is no zero-knowledge claim for Relay Escrow in the alpha.

Users must accept a versioned trust acknowledgement before escrow can be enabled. The acknowledgement records the policy version, timestamp, and hashed IP/user-agent.

### Escrow Routes

```
POST /api/relay/:id/escrow/acknowledge
POST /api/relay/:id/escrow/enable
POST /api/relay/:id/escrow/revoke
GET  /api/relay/:id/escrow/status
```

## Connection Management Routes

All connection management routes require browser auth + CSRF:

```
GET    /api/relay/connections
POST   /api/relay/connections
GET    /api/relay/connections/:id
PATCH  /api/relay/connections/:id
POST   /api/relay/connections/:id/rotate-key
POST   /api/relay/connections/:id/revoke
DELETE /api/relay/connections/:id
```

Heartbeat and status routes use API key auth (no browser CSRF required):

```
POST /api/relay/heartbeat   — Bearer <relay_api_key>
GET  /api/relay/status      — Bearer <relay_api_key>
```

## Env Vars

| Variable | Default | Purpose |
|---|---|---|
| `AEGIS_RELAY_DEFAULT_INTERVAL_HOURS` | `24` | Default expected interval before first heartbeat |
| `AEGIS_RELAY_OFFLINE_GRACE_MINUTES` | `10` | Grace window after expected time before marking offline |
| `AEGIS_WORKER_ENABLED` | `true` | Whether the background monitor loop runs |
| `AEGIS_WORKER_INTERVAL_SECONDS` | `60` | How often the monitor worker polls |

## Audit Events

The following events are written to `audit_events` with no PII in metadata:

- `relay_connection_created`
- `relay_connection_updated`
- `relay_key_rotated`
- `relay_connection_revoked`
- `relay_connection_deleted`
- `relay_heartbeat_received`

---

## Relay Linking Flow (OSS Instance → SaaS)

Linking an Aegis Core (self-hosted) instance to Aegis SaaS uses an auth code exchange to avoid passing the API key in a URL.

### Step 1 — Start linking from the SaaS dashboard

The user goes to `/app/relay`, clicks **Add Connection**, and the frontend calls:

```
POST /api/relay/connections
Authorization: <session cookie>
X-CSRF-Token: <csrf-token>
```

The server creates a new relay connection record, generates the API key (shown once), and returns the connection details.

### Step 2 — Enter the API key in the OSS instance

The user copies the API key from the SaaS dashboard one-time display and pastes it into the Aegis Core config (e.g. `config.json` or environment variable). The OSS instance then starts sending heartbeats:

```
POST /api/relay/heartbeat
Authorization: Bearer <relay_api_key>
```

The SaaS server validates the key against the stored SHA-256 hash and updates `lastHeartbeatAt`.

> The API key is never passed in a URL query string. It is always transmitted in the `Authorization: Bearer` header.

### Step 3 — Verify the connection

On the SaaS dashboard, the connection status changes from `pending` to `active` after the first heartbeat is received. The user can confirm the link is working via `GET /api/relay/status` (authenticated by API key) from the OSS instance, or by checking the dashboard.

---

## Key Rotation

If an API key is lost or suspected compromised:

1. Go to `/app/relay` in the SaaS dashboard.
2. Click **Rotate Key** on the connection.
3. The server calls `POST /api/relay/connections/:id/rotate-key`, generates a new key, invalidates the old key immediately, and returns the new key **once**.
4. Update the API key in the Aegis Core instance config.
5. The next heartbeat must use the new key.

> After rotation, any in-flight heartbeats using the old key are rejected.

---

## Revocation

To permanently disconnect an Aegis Core instance:

```
POST /api/relay/connections/:id/revoke
```

Or use the **Revoke** button on `/app/relay`. The connection is marked `disconnected`. Heartbeats from a revoked connection are rejected. Escrow (if enabled) is not automatically revoked — revoke it separately via `POST /api/relay/:id/escrow/revoke` if needed.

To fully remove the connection record:

```
DELETE /api/relay/connections/:id
```
