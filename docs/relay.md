# Aegis Relay — Phase 2 Behavior

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

Relay Monitoring is the Phase 2 feature. Relay Escrow, which holds and can execute release material when the self-hosted host is offline, is a Phase 3 feature. Do not conflate the two.

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
