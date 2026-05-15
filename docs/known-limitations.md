# Known Limitations — Aegis DMS (Beta)

Last updated: 2026-05-14

These are known limitations of the current alpha/beta release. They are not bugs — they are explicit design choices, deferred features, or architecture boundaries. This document exists so no user or operator misunderstands the current reliability or trust model.

---

## Security

- **No independent third-party security audit has been performed.** The architecture is designed with security in mind (AES-256-GCM field encryption, Argon2id, CSRF protection, rate limiting, audit logs) but has not been externally reviewed. A third-party audit is planned before general availability.
- **No formal penetration testing.** Not SOC 2, HIPAA, or any regulated compliance framework.
- **No zero-knowledge architecture.** Aegis Hosted and Relay Escrow use server-managed keys. Aegis can decrypt hosted data. This is documented in the trust model and acknowledged by users before enabling these features.
- **No Shamir Secret Sharing or multi-party key management.** Single server-managed key for hosted data in alpha/beta.
- **No SMS notification support.** Notifications are delivered via email (Postmark) and Telegram. SMS is not implemented.

---

## Guarantees and Delivery

- **No SLA during alpha/beta.** Service availability is best-effort. No uptime guarantees.
- **No guaranteed release delivery.** Aegis makes reasonable efforts to deliver estate packages. Delivery depends on: valid contact email addresses, non-blocked email delivery, contacts opening and acknowledging notifications, and Aegis service availability. None of these are guaranteed.
- **No guaranteed trigger accuracy.** Heartbeat-mode switch triggers depend on the worker running and detecting a missed check-in. Worker failures can delay or prevent trigger detection. This is documented in the product disclaimers.
- **Vault Mode has no automated release.** Vault Mode stores data locally. Without Relay or Hosted services, there is no automated release mechanism if the user's own server goes offline.

---

## Legal and Regulatory

- **Aegis is not a legal instrument.** It does not replace a will, trust, power of attorney, or advance directive. No legal effect on asset distribution.
- **Not legal or financial advice.** Nothing in the platform or docs constitutes legal, financial, or estate planning advice.
- **Legal pages are working drafts.** Terms, Privacy Policy, and other legal pages have not been reviewed by legal counsel. They will be finalized before general availability.
- **No jurisdiction-specific compliance.** GDPR/CCPA compliance has not been formally assessed. Data deletion and export tools exist, but formal DPA (Data Processing Agreement) templates are not yet available.

---

## Features

- **No public DeadDrop API.** The DeadDrop API is a future infrastructure product. No external API compatibility is promised in alpha/beta. See `docs/deaddrop-api-preview.md`.
- **No TOTP in SaaS auth.** Two-factor authentication (TOTP) is available in Aegis Core (self-hosted). The SaaS platform does not currently offer TOTP login.
- **No SMS 2FA.** Not planned for beta.
- **No mobile app.** Web only.
- **Relay Monitoring ≠ Relay Escrow.** Relay Monitoring tracks heartbeats and alerts. It does not hold release material. Relay Escrow holds encrypted release material but requires explicit trust acknowledgement before enabling.
- **OSS Relay auth-code linking is stubbed.** The real authorization-code exchange flow between Aegis Core and Aegis Relay SaaS is targeted for Task 10. Currently OSS connects using a link code flow that may require manual steps.
- **No TOTP recovery codes in OSS.** A known limitation from OSS Phase 4. Targeted for Task 10.
- **Pricing is placeholder.** All prices shown during alpha are indicative and subject to change before general availability.
- **Email templates are functional but not branded.** Transactional emails work but have not been professionally designed. Branded templates are targeted for Task 11.

---

## Infrastructure

- **No HA deployment.** Single Railway instance. No multi-region, no auto-scaling, no redundant workers.
- **No production rollback automation.** Rollback is manual. See `docs/deployment.md`.
- **Worker is single-process.** The background worker runs as a single polling loop. No queue, no distributed execution.
- **Backup is user-initiated.** There is no automated DB backup in alpha. Railway provides periodic backups at the infrastructure level. Operators should configure external backup separately.

---

## How to Report Issues

- Security vulnerabilities: security@aegisdms.com (private disclosure)
- Bugs and feature requests: see the public issue tracker (link TBD before GA)
- Billing issues: support@aegisdms.com
