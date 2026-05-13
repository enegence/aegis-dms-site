# Admin API

## Access Control

Admin routes require `role = 'admin'` or `role = 'sa'` on the requesting user's account. Roles are set directly in the database. There is no self-service role promotion in the alpha.

Regular users receive `403 Forbidden`. Unauthenticated requests receive `401 Unauthorized`.

## Endpoints

All admin endpoints are read-only in Phase 3 (no admin-triggered mutations). Visibility only.

```
GET /api/admin/metrics
GET /api/admin/users
GET /api/admin/users/:id
GET /api/admin/relay-connections
GET /api/admin/release-runs
GET /api/admin/packets
GET /api/admin/notifications
```

## Metrics

`GET /api/admin/metrics` returns aggregate counts:

| Field | Description |
|---|---|
| `totalUsers` | All registered users |
| `verifiedUsers` | Users with `emailVerified = true` |
| `activeSubscriptions` | Subscriptions with `status = active` |
| `relayConnectionsActive` | Relay connections with `status = active` |
| `relayConnectionsOffline` | Relay connections with `status = offline` |
| `activeReleaseRuns` | Release runs with `status = active` or `pending` |
| `packetsStored` | Total packet rows |
| `notificationFailuresLast24h` | Notification events with `status = failed` in the last 24h |

## Redaction

Admin endpoints never return:

- `passwordHash`, `passwordResetTokenHash` — user credential hashes
- `emailVerifyToken`, `totpSecretEncrypted` — user auth tokens
- `apiKeyHash` — relay API key hashes
- `encryptedContent`, `storageKey`, `packetKeyEncrypted` — encrypted packet material
- Claim tokens or their hashes
- Storage credentials or bucket URLs

Encrypted field values (`*Encrypted` columns) are not returned in admin responses. Admin sees only plaintext metadata fields.

## Audit

Admin visibility is not currently audit-logged in the alpha. Future versions should log `admin_viewed_metrics`, `admin_viewed_user`, etc.

## UI

The admin UI is available at:

- `/admin` — metrics overview
- `/admin/users` — user list
- `/admin/relay` — relay connection list
- `/admin/release-runs` — release run list

All admin UI routes require auth (checked client-side via `ProtectedRoute`). The server enforces the `admin`/`sa` role check on every request regardless of client-side gating.
