# Incident Response Runbook

Operational runbook for common incidents in the Aegis DMS Site alpha. Each section describes the symptom, immediate actions, and follow-up.

---

## Lost API Key (Relay)

**Symptom:** User reports they no longer have the relay API key and cannot re-enter it in their OSS instance.

**Immediate actions:**

1. Instruct the user to go to `/app/relay` in the Aegis dashboard.
2. Click **Rotate Key** on the affected connection.
3. The old key is immediately invalidated. A new key is shown **once** — the user must copy it now.
4. The user updates the API key in their Aegis Core config.
5. Heartbeats resume with the new key.

**Notes:** The raw key is never recoverable — only the SHA-256 hash is stored. Key rotation is the only recovery path. No admin action is required.

---

## Compromised API Key (Relay)

**Symptom:** User suspects their relay API key has been exposed (e.g. committed to a public repo, included in logs).

**Immediate actions:**

1. Instruct the user to go to `/app/relay` → **Rotate Key** immediately. This invalidates the old key.
2. Check the audit log (`audit_events` table or admin dashboard) for recent `relay_heartbeat_received` events from the connection. Look for unexpected sources or timing.
3. If there is evidence of unauthorized access, also revoke the connection via **Revoke** to prevent further use until a new connection is established.
4. If Relay Escrow is enabled on the connection, review whether the escrow material may have been exposed. Consider revoking escrow (`POST /api/relay/:id/escrow/revoke`) and re-enabling after the situation is resolved.

**Follow-up:**

- Notify the user of any unauthorized heartbeat activity found in the audit log.
- Advise the user to audit their OSS instance logs and environment for the root cause of the exposure.

---

## Stripe Webhook Failure

**Symptom:** Stripe events are not being processed (subscription status not updating, checkout not being recorded).

**Immediate actions:**

1. Check Railway logs for errors from the webhook handler:
   - `Stripe webhook signature invalid` — signing secret mismatch (see below)
   - `database error` — DB connectivity issue
2. In **Stripe Dashboard** → **Developers** → **Webhooks** → your endpoint → **Recent deliveries**, check for failed deliveries and the HTTP response codes.
3. If the webhook endpoint returned a non-200 response, find the specific event in Stripe and click **Resend** to replay it.

**Signature mismatch fix:**

- Verify `STRIPE_WEBHOOK_SECRET` in Railway matches the signing secret for the registered webhook endpoint.
- If using the Stripe CLI for local testing, ensure the CLI-generated secret is used locally and the dashboard secret is used in production.

**Follow-up:**

- After fixing the root cause, replay any failed events from the Stripe Dashboard to bring subscription state back in sync.
- Check the `stripe_webhook_events` table for the event ID to confirm it was processed after replay.

---

## Postmark Failure

**Symptom:** Transactional emails (verification, password reset, release notifications, relay alerts) are not being delivered.

**Immediate actions:**

1. Check Railway logs for errors from `EmailService` (look for Postmark API errors or HTTP 422/500 responses).
2. In the **Postmark dashboard** → **Activity**, check if the message was accepted by Postmark. If it appears there but was not received, the issue is downstream of Postmark (recipient spam filter, DNS).
3. If the message is not in Postmark Activity, the server failed to send it — check `POSTMARK_API_TOKEN` is correct and the server can reach the Postmark API.

**Domain configuration issues:**

- Go to Postmark → **Sender Signatures** and verify the sending domain/address is verified with a green checkmark.
- If DKIM or SPF records are missing, emails will be delivered but with lower trust, increasing spam rates. Add or re-verify DNS records.

**Suppression list:**

- If a specific recipient is not receiving emails, check Postmark → **Suppressions**. If their address is suppressed (due to a prior bounce or spam complaint), remove them from the suppression list only after confirming the address is valid.

**Follow-up:**

- Identify whether the failure was transient (Postmark outage) or persistent (misconfiguration).
- For release notification failures: manually verify the contact has received the claim link, or re-trigger notification from the admin dashboard if the release run is still active.

---

## Storage Outage

**Symptom:** Packet uploads or downloads are failing. Users or contacts cannot complete claim flows.

**Immediate actions:**

1. Check Railway logs for `storage: put failed` or `storage: get failed` errors.
2. Verify the storage provider status:
   - Cloudflare R2: [cloudflarestatus.com](https://cloudflarestatus.com)
   - AWS S3: [status.aws.amazon.com](https://status.aws.amazon.com)
3. Verify storage credentials are correct: `AEGIS_STORAGE_BUCKET`, `AEGIS_STORAGE_ACCESS_KEY_ID`, `AEGIS_STORAGE_SECRET_ACCESS_KEY`, `AEGIS_STORAGE_ENDPOINT`.

**Impact assessment:**

- A storage outage means packet upload and download are blocked.
- This is **not data loss** — existing objects remain in the bucket; they are temporarily inaccessible.
- The rest of the application (auth, relay heartbeats, billing, switch management) continues to function.
- Claim flows that require packet download will fail until storage recovers.

**Follow-up:**

- Once storage recovers, verify that in-progress release runs can resume. Check the `release_runs` table for runs that were active during the outage.
- Notify affected users if claim notifications were sent but the download link was inaccessible during the outage window.

---

## False Trigger Report

**Symptom:** A user reports their dead man's switch triggered (release run created) when it should not have.

**Immediate actions:**

1. Check the `release_runs` table for the user. Identify the run's `source` field:
   - `switch_trip` — the switch's own heartbeat deadline was missed
   - `relay_escrow` — the relay connection went offline and escrow triggered
   - `admin` — manually triggered by an admin
2. Check `audit_events` for the user around the trigger time. Look for:
   - `switch_tripped` — confirms the switch was in an armed state and missed check-in
   - `relay_assisted_release_started` — confirms relay escrow was the trigger
3. Check `hosted_switches` for the switch's `mode` (`heartbeat` vs `trip`), `armedAt`, `lastCheckinAt`, and `tripDeadline`.

**If the trigger was legitimate** (user missed check-in or relay went offline):

- Explain the trigger to the user.
- If the release run created unintended notifications, assess whether contacts received claim links and whether any action is needed.

**If the trigger appears erroneous** (bug):

- Do not delete the `release_runs` row without preserving evidence.
- Document the state of `hosted_switches`, `release_runs`, and relevant `audit_events`.
- Cancel the release run if the cascade has not yet proceeded to notification.
- File a bug report.

---

## Claim Abuse Report

**Symptom:** A contact reports receiving a claim notification they did not expect, or a user reports that an unauthorized person received a claim link.

**Immediate actions:**

1. Check `audit_events` for `claim_notification_sent` and `claim_accessed` events related to the affected release run.
2. Identify which contact received the claim link and whether it was claimed.
3. If the claim token has not been used yet:
   - Revoke or expire the claim token if there is an admin route to do so.
   - Contact the affected user immediately.
4. If the claim was already completed (packet downloaded):
   - Assess whether the contact was a legitimate recipient or if a contact record was tampered with.
   - Check `contacts` table and audit log for any contact record changes prior to the release.

**Follow-up:**

- If there is evidence of unauthorized contact record modification, treat this as a potential data exposure incident (see below).
- Preserve audit log records — do not delete them.
- Notify the affected user.

---

## Suspected Data Exposure

**Symptom:** Evidence or report that user data (estate items, contact details, packets) may have been accessed without authorization.

**Immediate actions:**

1. Pull `audit_events` for the affected user. Look for:
   - Unexpected `estate_item_viewed`, `contact_viewed`, or `packet_downloaded` events
   - Logins from unexpected IP addresses (if IP is logged)
   - Admin access events (`admin_viewed_metrics`, etc.) around the exposure window
2. Check if the user's session was compromised (look for active sessions from unexpected sources in `sessions` table, if applicable).
3. If the exposure is confirmed or likely:
   - Invalidate all active sessions for the affected user (manual DB update or admin action).
   - Force password reset.
   - Notify the affected user immediately with details of what was accessed.
4. If admin credentials may be compromised: rotate `AEGIS_SECRET_KEY` (this invalidates all sessions) and `AEGIS_FIELD_ENCRYPTION_KEY` (this requires re-encrypting all data — do not do this lightly; coordinate carefully).

**Follow-up:**

- Preserve all audit logs and Railway logs from the exposure window.
- Identify the root cause (compromised credential, session fixation, API bug).
- Assess whether regulatory notification obligations apply (depends on jurisdiction and nature of data exposed).
- Do not make public statements until the scope is understood.
