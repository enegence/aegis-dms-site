# Aegis DMS Site — Accessibility

Status: Beta (WCAG 2.1 AA target — not fully audited)
Last updated: 2026-05-15

---

## Overview

Aegis DMS Site targets WCAG 2.1 Level AA. The implementation work done in Phase 5 Task 10 lays a baseline across all user-facing auth and claim flows. A full audit has not been performed; known gaps are documented below.

---

## What Has Been Implemented (Phase 5 Task 10)

The following pages have received keyboard navigation, focus ring, ARIA label, and error association polish:

- **Login** (`/login`) — all inputs labeled, error messages linked via `aria-describedby`, focus visible on submit
- **Register** (`/register`) — field-level validation errors associated to inputs, terms link is keyboard reachable
- **Request Reset** (`/request-reset`) — email field labeled, status message announced via `aria-live`
- **Reset Password** (`/reset-password`) — password fields labeled, strength hint linked
- **Claim portal** (`/claim/*`) — token-gated flow; step headings use landmark roles, PIN input labeled, status announcements via `aria-live`
- **Onboarding** (`/onboarding`) — step indicators labeled, skip links present where applicable

General improvements applied across the site:

- Keyboard navigation works through all interactive controls without mouse
- Focus rings are visible on all interactive elements (no `outline: none` without a visible alternative)
- ARIA labels on icon-only buttons
- Color contrast meets WCAG AA minimums for text on background combinations used in auth flows

---

## API-Layer Guarantees

All error responses from the SaaS API return structured JSON. Error responses always include an `error` string field at the top level so client-side code can reliably announce errors to assistive technology without parsing freeform text.

Validation errors from registration include a `details.fieldErrors` map keyed by field name so UI code can associate error messages with the correct labeled form control.

See `server/tests/accessibility-smoke.test.ts` for tests that verify these shapes.

---

## Known Gaps

- **No automated axe / Playwright accessibility scan in CI.** Visual and keyboard testing is manual only. An automated `axe-playwright` scan is deferred to Phase 6.
- **Admin pages have limited a11y coverage.** The admin dashboard and user detail views have not been audited. They are internal-only surfaces.
- **Complex interactive components not fully audited.** The estate item editor and contact management tables have received basic label coverage but have not been tested with a screen reader.
- **No `aria-live` region on global flash/toast messages.** Toasts are visual-only in the current beta.
- **PDF or file downloads.** No PDF output exists in the current beta, so PDF accessibility is not a concern today.

---

## How to Test

### Manual keyboard walkthrough

Navigate to the running app and tab through each auth form. Verify:
- All inputs are reachable by tab
- Focus rings are visible at each step
- Error messages appear when submitting invalid data and are readable by screen reader

### Browser axe DevTools extension

Install the [axe DevTools browser extension](https://www.deque.com/axe/devtools/) and run an analysis on each page. Focus on WCAG 2.1 AA violations in the auth flows.

### Playwright E2E (visual inspection)

```bash
npm run test:e2e
```

E2E tests run the auth and claim flows but do not currently assert on ARIA roles or axe violations. Review screenshots in `e2e/screenshots/` after a run.

---

## Planned for Phase 6

- Automated `axe-playwright` scan integrated into the E2E CI workflow
- Screen reader smoke test script (NVDA / VoiceOver)
- Admin pages a11y pass
- `aria-live` on toast / flash message system
