# Postmark Setup Guide

This guide covers configuring Postmark for transactional email delivery in Aegis DMS Site.

---

## Server Token Setup

1. Log in to the [Postmark account portal](https://account.postmarkapp.com).
2. Go to **Servers** → **+ Create Server**.
3. Name the server (e.g. `Aegis DMS Production`).
4. In the server settings, go to the **API Tokens** tab.
5. Copy the **Server API Token** (it looks like a UUID).
6. Set it as `POSTMARK_API_TOKEN` in your Railway environment variables.

> Use one Postmark server per environment (production / staging). Do not share a server token between environments.

---

## From Email and Domain Setup

Postmark requires that the sender email address is verified before it can be used.

### Option A: Sender Signature (single address)

1. In Postmark → **Sender Signatures** → **+ Add Domain or Sender Signature**.
2. Choose **Single Address**, enter your from address (e.g. `noreply@aegisdms.life`).
3. Postmark sends a verification email to that address. Click the link to verify.
4. Set `POSTMARK_FROM_EMAIL=noreply@aegisdms.life`.

### Option B: Domain (recommended for production)

1. In Postmark → **Sender Signatures** → **+ Add Domain or Sender Signature**.
2. Choose **Domain**, enter your domain (e.g. `aegisdms.life`).
3. Add the DNS records Postmark provides:
   - **DKIM**: TXT record (e.g. `pm._domainkey.aegisdms.life`)
   - **Return-Path / SPF**: CNAME or TXT record at your domain registrar/DNS provider
4. Wait for DNS propagation (typically minutes to hours).
5. Click **Verify** in the Postmark dashboard.
6. Once verified, any `@aegisdms.life` address can be used as `POSTMARK_FROM_EMAIL`.

> SPF and DKIM are required for good deliverability. Skipping them increases the likelihood of emails landing in spam, especially for release/claim notifications that users depend on.

---

## Email Types Sent

| Email | Trigger | Recipient |
|---|---|---|
| **Email verification** | User registers or requests reverification | Registered user |
| **Password reset** | User requests a password reset | Registered user |
| **Release notification** | Switch trips and release run is created | Contacts in the estate |
| **Claim notification** | A claim token is issued for a contact | Contact email address |
| **Relay offline alert** | Relay monitor detects a missed heartbeat | Relay connection owner |

All emails are sent via the `EmailService` class (`server/src/services/email.ts`). No PII from audit logs or encrypted fields appears in email bodies — only the minimum information needed for the recipient to act.

---

## Bounce and Failure Handling

### Viewing delivery status

In the Postmark dashboard, go to **Activity** to see sent messages, bounces, spam complaints, and opens.

### Bounce webhooks (optional, recommended)

Postmark can notify your server when an email bounces permanently. To set this up:

1. In Postmark → Server → **Webhooks** → **+ Add Webhook**.
2. Set the URL to an endpoint you control (e.g. `https://your-domain.com/api/email/bounce`).
3. Select **Bounce** and/or **Spam Complaint** events.

> Bounce webhook handling is not implemented in the alpha. Permanent bounces are visible in the Postmark Activity dashboard but are not automatically acted on by the server. This is a known alpha limitation — users with bouncing contact email addresses will not have release notifications delivered until the bounce webhook is implemented.

### Suppression list

Postmark automatically suppresses future sends to addresses that hard-bounce or mark mail as spam. Check the **Suppressions** tab in Postmark → Server if a contact is not receiving expected emails. Remove from the suppression list only if you have confirmed the address is valid.

### Delivery troubleshooting

1. Check **Activity** in the Postmark dashboard for the message.
2. If the message is not listed, the server failed to call the Postmark API — check Railway logs for errors from `EmailService`.
3. If the message shows as bounced, check the bounce reason and the recipient's address.
4. If the message was delivered but not received, ask the recipient to check spam folders and add the sender domain to their allowlist.
