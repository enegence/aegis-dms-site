# Aegis DMS — Support Runbook

**Audience:** Internal support staff and on-call engineers.
**Version:** Phase 5 (beta)

---

## What Support Must Never Ask For

**Support must never ask for passwords, TOTP codes, API keys, storage credentials, or packet/release keys.**

This includes:
- Account passwords or password hints
- TOTP/authenticator codes or backup recovery codes
- Aegis API keys (used by OSS Relay instances)
- Storage provider credentials (S3 keys, R2 tokens)
- Encryption keys, packet keys, or release material
- Stripe secret keys or webhook secrets
- Postmark API tokens

Asking for these is a security violation. Escalate if a user offers them unprompted.

---

## What Support Cannot See

Support staff and admins have access to account metadata only. The following are
technically inaccessible to support:

- Plaintext estate item descriptions, institution names, or account hints (encrypted at rest)
- Contact names, emails, phone numbers, or Telegram handles (encrypted at rest)
- Packet contents or release material (encrypted, key not held by platform in self-hosted mode)
- TOTP secrets (encrypted at rest)
- Password hashes
- Stripe customer/subscription IDs at the user-facing level

The admin panel returns only: email, displayName, emailVerified, subscription status/plan,
relay connection count, active release run count, failed notification count.

---

## How to Inspect Account Status

**Via admin panel:** `/admin/users/:id`

Shows:
- Account creation date and email verification status
- Subscription plan and status (active / past_due / cancelled / paused / trialing)
- Number of active relay connections
- Number of active release runs
- Count of failed notifications

**Via database (engineering only):**
```sql
SELECT id, email, email_verified, role, totp_enabled, created_at
FROM users WHERE email = '<user email>';

SELECT plan, status, current_period_end, cancelled_at, updated_at
FROM subscriptions WHERE user_id = '<userId>'
ORDER BY created_at DESC LIMIT 1;
```

---

## How to Diagnose Failed Relay Connection

1. Ask the user to check the Relay status indicator in their dashboard Settings > Relay.
2. In the admin panel, check the user's relay connection count.
3. If count > 0, check relay connection details via:
   ```sql
   SELECT id, label, mode, status, last_heartbeat_at, offline_alert_sent_at, revoked_at
   FROM relay_connections WHERE user_id = '<userId>' ORDER BY created_at DESC;
   ```
4. Common causes:
   - `status = 'offline'` with old `last_heartbeat_at`: Relay instance is not running or unreachable
   - `status = 'revoked'`: Key was revoked; user must re-link
   - `offline_alert_sent_at` is set: alert was fired, user may have missed notification
5. Resolution steps for user:
   - Verify their self-hosted Aegis instance is running (`systemctl status aegis` or Docker)
   - Verify outbound internet connectivity from their server
   - Re-link Relay if key was revoked (Settings > Relay > Remove and Re-link)

---

## How to Diagnose Failed Notification

1. Check notification events in the database:
   ```sql
   SELECT id, channel, status, error_message, attempt_count, created_at, updated_at
   FROM notification_events
   WHERE user_id = '<userId>'
   ORDER BY created_at DESC LIMIT 20;
   ```
2. Status meanings:
   - `failed_permanent`: Delivery failed and will not retry (e.g., invalid email address, contact deleted)
   - `failed_retryable`: Temporary failure; worker will retry on next tick
   - `skipped`: Contact was inactive or no valid channel
3. Common causes by channel:
   - **Email:** Postmark rejection (bounced address, spam block). Check Postmark dashboard.
   - **Telegram:** Bot was blocked by user or chat was deleted.
4. If permanent failure: inform user that the notification did not reach the contact and suggest
   they verify contact details in Settings > Contacts.

---

## How to Resend Verification Email

**Self-service (preferred):**
Direct the user to the login page. If their email is unverified, the app will offer
a "Resend verification email" option.

**Engineering override (if self-service is broken):**
```sql
-- Check current token status
SELECT email, email_verified, email_verify_token, email_verify_token_expires_at
FROM users WHERE email = '<user email>';
```
If expired, trigger a resend via the API (requires admin tooling endpoint — not yet implemented
for beta; escalate to engineering to trigger email re-send manually).

---

## How to Guide User Through Export and Deletion

### Export
1. Direct user to Settings > Account > Export Data (feature in roadmap; not yet available in beta).
2. For beta: inform user that all data is associated with their account and can be accessed
   from the Aegis dashboard. Planned full export will be added post-beta.

### Account Deletion
1. User initiates from Settings > Account > Delete Account.
2. A confirmation email is sent to their registered address.
3. User clicks the link in the email to confirm deletion.
4. Account and associated data are scheduled for deletion per the retention policy.
5. If user did not receive the confirmation email:
   - Check spam/junk folder.
   - Verify the registered email address is correct.
   - Check Postmark delivery logs for bounces.
6. **Support must not perform account deletion on behalf of users without written confirmation.**
   Escalate to engineering if automated deletion fails.

---

## Escalation Path for Release Incidents

A **release incident** is any situation where the automated release process has
fired, failed, or may have released information incorrectly.

**Immediate response:**
1. Do not attempt to reverse or halt a completed release without engineering approval.
2. Contact the on-call engineer immediately (see escalation contacts in internal wiki).
3. Document: which user, when the release run started, what triggered it (Relay offline / manual),
   what notifications were sent (check `notification_events`).

**Engineering escalation query:**
```sql
SELECT id, user_id, source, status, started_at, completed_at, cancelled_at
FROM release_runs WHERE user_id = '<userId>' ORDER BY created_at DESC LIMIT 5;
```

**Do not:**
- Delete or modify release run records
- Contact claim recipients directly
- Share release content with anyone other than verified account holders

---

## Incident Severity Levels

### P1 — Critical (respond within 15 minutes)
- Release triggered incorrectly (false positive)
- Release failed to trigger when it should have (false negative, user reports)
- Account data exposure (potential breach)
- Production service completely down
- Stripe webhook processing halted (subscriptions not updating)

**P1 actions:** Page on-call engineer immediately. Open incident channel. Do not resolve
without engineering sign-off.

### P2 — High (respond within 2 hours)
- Notification delivery failing for multiple users
- Relay connection monitoring offline for multiple users
- User unable to log in (auth service issue)
- Subscription status incorrect (billing webhook lag)

**P2 actions:** Escalate to engineering. Acknowledge user within 1 hour. Track in issue tracker.

### P3 — Normal (respond within 24 hours)
- Single user notification failure
- UI rendering issue or broken link
- Feature request or non-critical UX bug
- User unable to resend verification email (self-service path broken)

**P3 actions:** Log in issue tracker. Respond to user with workaround if available.
No immediate escalation required unless pattern emerges across multiple users.

---

## Internal Reference

- Admin panel: `/admin`
- Stripe dashboard: see internal wiki for access
- Postmark dashboard: see internal wiki for access
- Railway (infrastructure): see internal wiki for access
- On-call contacts: see internal wiki
