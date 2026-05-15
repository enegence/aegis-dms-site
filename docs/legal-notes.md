# Legal Notes — Aegis DMS

## Status

All legal pages are working drafts. They have not been reviewed by legal counsel. They will be finalized before general availability.

## Pages

| Path | Purpose |
|------|---------|
| `/terms` | Terms of Service — core use agreement, billing, limitations |
| `/privacy` | Privacy Policy — data collected, encryption, third parties |
| `/security` | Security page — encryption model, trust models, alpha limitations |
| `/acceptable-use` | Acceptable Use Policy — what must not be stored |
| `/disclaimers` | Disclaimers — not a will, no guaranteed delivery, alpha software |
| `/data-deletion` | Data Deletion — export, delete account, retention info |

## Terms Version

The current terms version is `terms-v1`. When users register with terms acceptance, a `trust_acknowledgements` row is written with `mode='terms'` and `version='terms-v1'`.

When terms are materially updated, increment the version (e.g. `terms-v2`) and implement a re-acceptance flow.

## Trust Acknowledgement Modes

| Mode | Version | When Written |
|------|---------|-------------|
| `terms` | `terms-v1` | At registration when user accepts terms |
| `hosted` | `hosted-v1` | During onboarding when user accepts hosted trust model |
| `relay_escrow` | current relay escrow version | When user enables Relay Escrow |

## Key Disclosures

These concepts must be clearly communicated across legal pages and product UX:

- Aegis is not a will, trust, or legal instrument
- Aegis does not provide legal or financial advice
- Aegis does not guarantee asset transfer — only information delivery
- Aegis stores estate metadata and instructions, not credentials or seed phrases
- Users must not store passwords, private keys, or seed phrases
- Relay Escrow requires explicit trust in Aegis as a service provider
- Hosted uses server-managed encryption — Aegis can decrypt hosted data
- Stripe handles payment information; Aegis does not store card details
- No independent security audit has been conducted (alpha)
- Prices are indicative and subject to change

## OSS / Self-Hosted Disclosure

For self-hosted Aegis Core users: data stays on user infrastructure. Project maintainers receive no telemetry unless Relay or Hosted services are used. This is documented in the Privacy Policy (`/privacy`).

The OSS documentation should reference:
- Aegis Hosted terms: `https://aegisdms.com/terms`
- Aegis Relay terms: `https://aegisdms.com/terms`
- Security model: `https://aegisdms.com/security`
- Privacy policy: `https://aegisdms.com/privacy`

## Before GA Checklist

- [ ] Legal review of Terms of Service
- [ ] Legal review of Privacy Policy
- [ ] Legal review of Disclaimers
- [ ] GDPR/CCPA compliance review
- [ ] Independent security audit
- [ ] Remove "draft" and "beta notice" banners from legal pages
- [ ] Implement re-acceptance flow for material terms updates
- [ ] Add jurisdiction-specific notices if required
