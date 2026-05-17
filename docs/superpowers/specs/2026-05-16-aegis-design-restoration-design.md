# Aegis DMS — Sketch Aesthetic Restoration — Design Spec

**Date:** 2026-05-16
**Status:** Approved design, pending implementation plan (writing-plans)
**Execution model:** To be implemented in a separate Sonnet session, task-by-task, **no subagents** (accountability required).
**Scope:** Two repos — `aegis-dms-site/` (SaaS) and `aegis/` (OSS). Restore the original hand-drawn "sketch" aesthetic and original information architecture **without regressing any functionality** delivered through Phases 1–5 (SaaS: 638+ passing tests; OSS: 504+ passing tests).

---

## 1. Background & Problem Statement

The original product design is a hand-drawn "blueprint sketch" aesthetic: Caveat display font, JetBrains Mono body, asymmetric "sketchy" border radii, slight card tilts, a dead-stick-figure mascot wordmark, animated mortality vignettes, illustrated SVG trust badges, a left-sidebar app shell, and a floating dev "Tweaks" panel with blueprint/cream/midnight themes.

The canonical source of this design is preserved intact in the backup repo at
`/home/eric/dev/aegis-dms-site.backup.20260515-025639/`:

- `index.html` — bootstrap, `THEMES` (blueprint/cream/midnight), `useTweaks` wiring, `TWEAK_DEFAULTS`.
- `aegis-app.jsx` — `LandingPage`, `OnboardingPage` (4-step), `AppShell` (sidebar), `AegisApp` router.
- `aegis-inner.jsx` — `SketchCard`, `InkButton`, `SectionTitle`, `StatPill`, and the six inner pages (`DashboardPage`, `LegacyPage`, `ContactsPage`, `TriggerPage`, `ReleasePage`, `DeploymentPage`).
- `aegis-icons.jsx` — `DrawIcon` + 17 hand-drawn icon components.
- `aegis-logo.jsx` — `AegisMascot`, `AegisLockup`.
- `aegis-animations.jsx` — `MortalityRow` + `PianoScene`/`OceanScene`/`BridgeScene`/`PlaneScene` + watercolor wash helpers.
- `tweaks-panel.jsx` — `TweaksPanel`, `useTweaks`, `TweakSection/Slider/Radio/Color/Toggle`, host message protocol.

**What happened:** The master plan (`docs/superpowers/plans/2026-05-06-aegis-master-plan.md`) explicitly specified this design system (lines 161–165: `ui/ SketchCard, InkButton, StatPill, SectionTitle`; `icons/`; `animations/ Mortality scene components`) and instructed "Marketing landing page (port existing design)" (line 683). However, **SaaS Phase 2 Task 19** (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase2.md`, lines 1276–1330) rewrote the landing from scratch with generic "legacy-release infrastructure" positioning and a "Four product surfaces" grid, using plain Tailwind (`rounded-lg`, no tilts, no mascot, no mortality, no sidebar, no tweaks). All subsequent SaaS UI inherited that plain treatment. The result:

- **SaaS (`aegis-dms-site/web`)**: Tailwind `brand.*` palette + `font-hand`/`font-mono` retained, but **all** sketch DNA stripped — no asymmetric radii, no tilt, no `SketchCard`/`InkButton`, no `AegisMascot`, no `MortalityRow`, no `TweaksPanel`, top nav instead of sidebar, rewritten landing copy/IA.
- **OSS (`aegis/web`)**: **Kept** sketchy radii (`3px 10px 3px 10px / 10px 3px 10px 3px`) and the blueprint palette, but via ad-hoc per-file inline `T` token objects — no shared kit, no `AegisMascot`, no `AppShell` sidebar, no `TweaksPanel`, no polished parity with the original.

**Goal:** Restore the original aesthetic and IA across both repos using a real, ported component kit, changing **presentation only** and preserving 100% of shipped functionality and accessibility work.

---

## 2. Approved Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | SaaS restoration scope | **Everything, uniformly** — full sketch treatment on every surface (marketing, auth, app, claim portal, admin, billing, settings, relay, legal pages). |
| 2 | App shell layout | **Restore original left sidebar** for the authenticated app; new pages (Billing/Settings/Relay/Admin) fold into the sidebar. |
| 3 | Tweaks panel | **Dev-only, gated** — mounts only in dev builds / behind a hidden flag; never exposed to production users. |
| 4 | Kit delivery | **Duplicate the kit per repo** as TSX — matches the deliberate "shared concepts, independent implementations" two-repo architecture; no new cross-repo coupling. |
| 5 | Landing copy + legal | **Original copy + IA verbatim**, retain Phase-5 legal scaffolding (alpha disclaimer, "not a will/trust" footer, legal-page footer links) and keep avoiding banned claims. Pricing tiers render **live `/api/pricing`** values inside the sketched 3-card layout. |
| 6 | OSS depth | **Full parity with the SaaS kit** — refactor OSS inline styles onto the shared kit + `AppShell` sidebar + `AegisMascot` + dev Tweaks; bring Setup/Login/Dashboard/Switches/Release/Settings/AuditLog/Claim to the original look. |
| 7 | Verification protocol | **Strict gates per surface** — dedicated branch, no force-push, commit per surface, full test suite + typecheck + `vite build` + Playwright screenshot vs original reference after each surface; any test/typecheck/build regression blocks progress. |
| 8 | Implementation approach | **Approach A** — component-kit port + in-place reskin. Original JSX is the visual source of truth; logic/data/routing layers are never moved. Tailwind preset remap as a backstop so un-migrated elements never look half-done. |
| 9 | OSS pre-wizard intro | **Reskin the existing `Setup.tsx` Step 0 ("Welcome")** into a branded hero: corner frame + `AegisLockup` + tagline + 3 trust badges + a single "Set Up Your Switch →" `InkButton` that calls the existing `nextStep()`. **No new step, no new route, no flow change.** Shown first-run only (existing setup-status gate). |

**Standing assumptions (flag if wrong):** Mortality scenes appear on the SaaS landing only; OSS ships no marketing/landing page; marketing pricing is live Stripe, not hardcoded; **all Phase-5 legal text and accessibility attributes are preserved through every reskin** (carried through, never dropped).

---

## 3. The Preservation Boundary (NON-NEGOTIABLE)

The reskin changes presentation only. The following are **never modified** by this work:

- `web/src/lib/*.ts` — API clients (`api.ts`, `dashboard.ts`, `estate.ts`, `contacts.ts`, `switches.ts`, `relay.ts`, `billing.ts`, `theme.ts` logic, `settings.ts`). (A new `lib/theme.tsx` provider is **added**; existing `theme.ts` semantics are not broken.)
- `server/**` — entire backend, in both repos.
- Route **paths** and route-guarding semantics in `web/src/App.tsx` (SaaS) and `web/src/App.tsx` (OSS). `ProtectedRoute`, the OSS `authStatus` state machine, the claim-portal path special-casing, and `Navigate` fallbacks keep identical behavior.
- Data hooks, `useEffect` data-loading, state machines, `Promise.all` orchestration, error/empty-state conditionals, onboarding/billing gating logic, the 5-step claim token flow, admin 403 enforcement, Stripe lifecycle, relay key rotation.
- `packages/contracts/**`, `packages/shared/**`, Zod schemas.
- **Every Phase-5 accessibility attribute** — `aria-live`, `aria-atomic`, `role="alert"`, `aria-describedby`, `aria-label`, `role="progressbar"`, visually-hidden live regions, focus-ring handling. These are ported through into the new markup verbatim, not removed.
- **Every piece of legal/compliance copy** — Terms, Privacy, Security, AUP, Disclaimers, Data Deletion text bodies; the alpha disclaimer; the "NOT A WILL, TRUST, OR LEGAL DOCUMENT" line; banned-claims constraint.

**Modified:** JSX structure, `className`/`style`, marketing-page copy (restored to original), the app-shell wrapper (top nav → sidebar).

**Added:** the kit modules (Section 4); the SaaS `components/layout/AppShell.tsx`; `lib/theme.tsx`; `components/dev/TweaksPanel.tsx`.

**Deleted (only after all consumers migrate):** SaaS `web/src/components/Nav.tsx`; OSS inline `Nav` in `web/src/App.tsx` (replaced by `AppShell`); per-file ad-hoc `T`/`T2` token objects in OSS (replaced by theme context).

---

## 4. Design System — Ported Kit (duplicated per repo)

All modules are ported **pixel-faithfully** from the backup JSX, converted JS→TSX with explicit prop types. Identical module set in both `aegis-dms-site/web/src/` and `aegis/web/src/`.

### 4.1 `lib/theme.tsx` — Theme + Tweaks context (replaces `window.__aegis*`)

- `THEMES` object (blueprint default, cream, midnight) copied from backup `index.html` lines 63–79.
- `TWEAK_DEFAULTS` copied from backup `index.html` lines 49–61.
- `ThemeProvider` React context exposing `{ theme, tweaks, setTweak }`. `theme` = `THEMES[tweaks.theme]` with `accent` overridable by `tweaks.accentColor` (mirrors backup `index.html` lines 105–109).
- Hooks: `useTheme()` → resolved theme object; `useTweaks()` → `[tweaks, setTweak]`.
- Replaces every `window.__aegisTheme` / `window.__aegisTweaks` read in the ported components with `useTheme()`/`useTweaks()`.
- Persistence: tweaks persisted to `localStorage` **only when the dev gate is active**; production always uses defaults (blueprint).
- Mount point: wrap `<App/>` in `web/src/main.tsx` (SaaS — inside `BrowserRouter`, inside `StrictMode`; OSS — equivalent root) with `<ThemeProvider>`.

### 4.2 `components/ui/` — Primitives (from `aegis-inner.jsx`)

- `SketchCard.tsx` — `aegis-inner.jsx` lines 33–57. Props: `tilt?: number`, `style?`, `children`. Honors `tweaks.cardStyle` (sketchy/sharp/pill), `tweaks.density`, `tweaks.tiltAmount`. Sketchy radius `3px 10px 3px 10px / 10px 3px 10px 3px`.
- `InkButton.tsx` — `aegis-inner.jsx` lines 59–99. Props: `variant: 'primary'|'ghost'|'danger'`, `size: 'sm'|'md'|'lg'`, `onClick`, `style`, `children`. Caveat font, ink offset shadow, hover lift, honors `tweaks.buttonShape`/`density`.
- `SectionTitle.tsx` — lines 21–31. Props: `children`, `sub?`. Honors `tweaks.headingScale`.
- `StatPill.tsx` — lines 5–19. Props: `label`, `value: ReactNode`, `accent?`.
- Barrel `components/ui/index.ts`.

### 4.3 `components/icons/` — Hand-drawn icons (from `aegis-icons.jsx`)

`DrawIcon` wrapper + all 17 icons: `IconHeartbeat, IconPlane, IconDashboard, IconLegacy, IconContacts, IconTrigger, IconDeployment, IconRelease, IconNoPassword, IconSelfHost, IconOpenSource, IconShield, IconCheck, IconCloud, IconEye, IconSkull, IconSettings`. Props: `size?`, `color?`, `style?`. Barrel export.

### 4.4 `components/brand/` — Mascot (from `aegis-logo.jsx`)

- `AegisMascot.tsx` — dead-stick-figure "D" + hand-drawn "MS" wordmark. Props: `height?`, `color?`.
- `AegisLockup.tsx` — mascot + "DIGITAL LEGACY SYSTEM" tagline. Props: `size: 'sm'|'md'|'lg'`, `color?`. Honors `tweaks.logoSize` where used in shell.
<!-- DEVIATION (2026-05-17): AegisLockup now also renders a hand-drawn "AEGIS" badge stamp (wobbly box + Caveat lettering + accent underlines, tilted -4deg) above the mascot/wordmark. This is the new canonical lockup, applied byte-identically in BOTH repos (aegis-dms-site + aegis). Supersedes the "byte-identical to $BACKUP/aegis-logo.jsx lines 1–81" port intent — the badge is a deliberate post-plan brand enhancement, not drift. -->
<!-- DEVIATION (2026-05-17): The three trust badges (No passwords stored / Self-hostable / Open source core) are now rendered as tinted PNG line-art via a CSS-mask `MaskArt` helper, NOT verbatim hand-drawn SVG. Applied in BOTH repos: SaaS `Landing.tsx` (inline MaskArt) and OSS `components/brand/TrustBadges.tsx` (MaskArt) on Setup Step 0. Assets live in `web/public/illustrations/{no-passwords,self-hostable,open-source-core}.png` in each repo. This supersedes the "verbatim SVG from $BACKUP/aegis-app.jsx lines 56–178" intent throughout this spec/plan. -->
<!-- BACKLOG: 2026-05-16 plan checkboxes (P0 Task 1 Step 1; P1 Step 2; P9 Task 9.4 Step 2) were never ticked though the work shipped; tracking superseded by these DEVIATION notes — do not re-execute as written. -->


### 4.5 `components/animations/` — Mortality scenes (from `aegis-animations.jsx`)

`MortalityRow.tsx` + `PianoScene`/`OceanScene`/`BridgeScene`/`PlaneScene` + watercolor helpers (`WcDefs`, `WcBlob`, `OutdoorWash`, `InteriorWash`, `WaterWash`) + `useCycleTime` and easing helpers. Ported ~as-is (≈720 lines) into TSX with typed props (`{ ink: string; accent: string }`). `SceneCard` export retained. **Used on the SaaS landing only.** Available but unused in OSS.

### 4.6 `components/layout/AppShell.tsx` — Sidebar shell (from `aegis-app.jsx` lines 416–497)

Left sidebar: `AegisLockup` (click → home/dashboard), sketch nav buttons (active = inked + tilt), red **Release Mode** button, status block. Main content area. Props: `page: string`, `setPage`/navigation adapter, `children`, plus an extended nav-item list (Section 5.3). Honors `tweaks.sidebarWidth`, `tweaks.logoSize`. Replaces SaaS `components/Nav.tsx` and the OSS inline `Nav`.

### 4.7 `components/dev/TweaksPanel.tsx` — Dev-gated panel (from `tweaks-panel.jsx` + `index.html` panel wiring)

- Full panel ported: `TweaksPanel`, `TweakSection`, `TweakSlider`, `TweakRadio`, `TweakColor`, `TweakToggle`, drag, host message protocol.
- Control set from `index.html` lines 139–209: Color Theme, Accent Color, Card Style, Button Shape, Density, Card Tilt, Heading Scale, Sidebar Width, Logo Size, Corner Doodles. Plus the `TweaksToggle` FAB (`index.html` lines 81–99).
- **Dev gate:** mounted **only** when `import.meta.env.DEV === true` **or** `localStorage.getItem('aegis:tweaks') === '1'` **or** URL contains `?tweaks=1` (sets the localStorage flag). In production builds with no flag, the panel, FAB, and tweak persistence are tree-shakeable and never rendered. Default theme in production is always blueprint.

### 4.8 `index.css` + Tailwind preset (backstop — Approach C safety net)

- Keep `@tailwind` directives + the existing reset.
- Add the original sketchy scrollbar rule (backup `index.html` lines 19–24).
- Add a small Tailwind layer/preset mapping stray `rounded`, `rounded-md`, `rounded-lg` to the sketchy asymmetric radius and providing `.tilt-*` utilities, so any element not yet migrated still reads as sketch rather than half-done mid-migration. This is a safety net, not the mechanism.
- **Fonts:** Verified present — both repos already load `Caveat` + `JetBrains Mono` (SaaS also `Inter`) via Google Fonts in `web/index.html`. No font work required; verify only.

---

## 5. Surface-by-Surface Mapping

Legend: **PRESERVE** = logic/data/a11y carried through unchanged; **RESKIN** = JSX/style swapped to kit; **COPY** = restore original verbiage.

### 5.1 SaaS — Marketing & Legal (`web/src/pages/marketing/`)

| File | Original analogue | Action |
|------|-------------------|--------|
| `Landing.tsx` | `aegis-app.jsx` `LandingPage` (lines 2–276) | **COPY+RESKIN.** Restore exact structure & verbiage: hero with corner doodles + `AegisLockup size="lg"` + H1 "What happens after you're gone?" + 3-line privacy tagline + `InkButton` "Set Up Your Switch →" (→ `/register`) & ghost "See the Dashboard" (→ `/login`; existing route guard already redirects an authenticated visitor on to `/dashboard`); 3 illustrated stick-figure trust badges (No passwords stored / Self-hostable / Open source core); `MortalityRow` with "any of these could happen on a perfectly ordinary tuesday"; "How it works" 3 steps; "Two trigger modes" (Heartbeat/Trip); "Pick your level of paranoia" 3-card pricing (Open Source / Aegis Relay `POPULAR` / Aegis Hosted). **PRESERVE/ADD:** keep alpha disclaimer block, "AEGIS IS NOT A WILL, TRUST, OR LEGAL DOCUMENT…" footer, and the legal-page footer links from the current `Landing.tsx`; keep the banned-claims rule (no "guaranteed release", "zero knowledge", "legal replacement", "production audited"). Pricing card amounts come from **live `/api/pricing`**, not hardcoded; show "Pricing coming soon"/link fallback when null. |
| `Pricing.tsx` | pricing section of `LandingPage` | **RESKIN+PRESERVE.** Sketched plan cards; keep existing `/api/pricing` fetch + null handling; legal text intact. |
| `Docs.tsx`, `Terms.tsx`, `Privacy.tsx`, `Security.tsx`, `AcceptableUse.tsx`, `Disclaimers.tsx`, `DataDeletion.tsx`, `Contact.tsx` | — (footer in `LandingPage`) | **RESKIN only.** Wrap content in a shared marketing shell: `AegisLockup` header, dashed-border footer with mascot + legal links, body in `SketchCard`. **All legal/policy text bodies unchanged.** `Contact.tsx` keeps its form logic. |

Add `components/marketing/MarketingShell.tsx` (header+footer) and reuse across all marketing/legal pages. The current `components/marketing/ProductSurfaceCards.tsx` / `PricingCards.tsx` (if present) are replaced by sketched equivalents or inlined; remove afterward if unreferenced.

### 5.2 SaaS — Auth (`web/src/pages/auth/`)

`Login.tsx`, `Register.tsx`, `RequestReset.tsx`, `ResetPassword.tsx` — **RESKIN+PRESERVE.** Centered `SketchCard` (radius `3px 10px 3px 10px / 10px 3px 10px 3px`), Caveat H1, mono labels, sketch inputs, `InkButton` submit, optional corner-doodle frame. Keep all form state, validation, CSRF, email-verify messaging, TOTP challenge branch, error rendering, and every existing `aria-*`/`role="alert"`/live-region attribute.

### 5.3 SaaS — Authenticated App Shell & Pages (`web/src/pages/app/`, `web/src/components/`)

**Shell:** Replace `<Nav/>` usage with `<AppShell>`. Sidebar nav model (extends original 5-item nav to cover shipped surfaces):

- Dashboard → `/dashboard`
- Legacy Packet → `/estate`
- Contacts → `/contacts`
- Trigger → `/switches`
- Relay → `/relay`
- Billing → `/app/billing`
- Settings → `/app/settings`
- (conditional) Admin section → `/admin` group, shown when `user.role` ∈ {admin, sa} (same predicate as current `Nav.tsx`)
- Red **Release Mode** button → `/release`
- Status block (Status/Mode/Dead drop) — populated from existing dashboard summary where available; static fallback otherwise.

Navigation uses `react-router` `NavLink`/`useNavigate` (the original `setPage` state model is adapted to router navigation; route paths unchanged).

| File | Original analogue | Action |
|------|-------------------|--------|
| `Dashboard.tsx` | `aegis-inner.jsx` `DashboardPage` (101–196) | **RESKIN+PRESERVE.** "Still Alive" heartbeat card + countdown + progress bar, `StatPill` row, "Recent Activity" log, ghost action buttons. Wire to existing `getDashboard()` `DashboardSummary`, the `/api/app/packets` + `/api/app/release-runs` `Promise.all`, onboarding banner (`shouldShowHostedOnboarding`), email-verify banner, subscription block, next-switch block, empty-state prompts — all preserved. |
| `Estate.tsx` | `LegacyPage` (224–317) | **RESKIN+PRESERVE.** Category sidebar + counts, tilted item `SketchCard`s, inline add form. Keep estate API calls + field-encryption handling + category model. |
| `Contacts.tsx` | `ContactsPage` (320–413) | **RESKIN+PRESERVE.** Numbered cascade, ▲▼ reorder, notify badges, add form. Keep contacts API + ordering semantics. |
| `Trigger.tsx` | `TriggerPage` (416–507) | **RESKIN+PRESERVE.** Heartbeat/Trip mode toggle cards + sliders + info block. Keep switches API + state-machine calls + validation. |
| `Release.tsx` | `ReleasePage` (510–595) | **RESKIN+PRESERVE.** Red warning banner, large countdown, notification timeline, Abort flow. Keep release-run API + abort/auth logic. |
| `Onboarding.tsx` + `components/onboarding/{OnboardingShell,HostedOnboarding,TrustModelCard}.tsx` | `OnboardingPage` (279–414) | **RESKIN+PRESERVE.** Step dots, `SketchCard`, sketch mode buttons (deploy/trigger), interval slider, success card with `AegisMascot`. Keep onboarding state, plan-aware routing, checklist logic, `TrustModelCard` semantics. |
| `Billing.tsx` + `components/billing/{PlanStatusCard,BillingActions}.tsx` | — | **RESKIN only.** Kit primitives; Stripe portal redirect + subscription status logic untouched. |
| `Settings.tsx` + `components/settings/*` | — (tabbed; analogous to OSS settings) | **RESKIN only.** Sketch tabbed layout; every settings endpoint, TOTP setup/disable, notification prefs, danger-zone logic untouched, all a11y intact. |
| `Relay.tsx` + `components/relay/*` | `DeploymentPage` (598–686) cards | **RESKIN only.** Sketch selectable mode/connection cards, escrow card, heartbeat status. Relay connect/disconnect/key-rotation API untouched. |

### 5.4 SaaS — Claim Portal (`web/src/pages/claim/`)

`ClaimLanding.tsx`, `ClaimVerify.tsx`, `ClaimAccept.tsx`, `ClaimDownload.tsx`, `ClaimAcknowledge.tsx` — **RESKIN+PRESERVE.** A **distinct minimal layout — NO sidebar** (claimants are unauthenticated external contacts): centered `SketchCard`, `AegisLockup` header, mono body, `InkButton` actions, dashed footer. The 5-step token flow, token validation, verification, download, acknowledgement logic and all a11y are preserved exactly.

### 5.5 SaaS — Admin (`web/src/pages/admin/`, `web/src/components/admin/`)

`AdminDashboard.tsx`, `AdminUsers.tsx`, `AdminRelay.tsx`, `AdminReleaseRuns.tsx`, `UserDetail.tsx`, `components/admin/{RelayMetrics,SubscriptionMetrics,SystemHealthPanel,UserTable}.tsx` — **RESKIN only**, rendered inside `AppShell` under an "Admin" sidebar section. `SectionTitle`/`StatPill`/`SketchCard` for metrics/tables. 403 enforcement, metrics queries, user-detail actions untouched.

### 5.6 OSS (`aegis/web/src/`)

OSS has no marketing/landing (self-hosted app). Full kit parity:

| File | Original analogue | Action |
|------|-------------------|--------|
| `pages/Setup.tsx` | `OnboardingPage` + `LandingPage` hero | **RESKIN+PRESERVE.** Wizard structure (`steps = ['Welcome','Profile','Security','Deployment','Acknowledge','Review']`, `step` state, `nextStep()`, validators) is **unchanged**. **Step 0 ("Welcome", currently lines ~242–266)** is reskinned into the branded hero: corner-doodle frame + `AegisLockup size="lg"` + H1 "What happens after you're gone?" + privacy tagline + the 3 trust badges (No passwords stored / Self-hostable / Open source core — all apply to OSS) + a single `InkButton` "Set Up Your Switch →" calling the existing `nextStep()`. Steps 1–5 reskinned with `SketchCard`/`InkButton`/sketch inputs; deployment-mode cards styled like `DeploymentPage`. All validation, acknowledgements, `role="progressbar"`, `FieldError`/`role="alert"` preserved. |
| `App.tsx` (inline `Nav` + `AuthedApp`) | `aegis-app.jsx` `AppShell` | **RESKIN+PRESERVE.** Replace inline top `Nav` with `AppShell` sidebar (Dashboard/Switches/Release/Audit/Settings + Release Mode + status; logout action preserved). `authStatus` state machine, claim-path special-casing, `Navigate` fallbacks unchanged. Remove local `T` token object in favor of theme context. |
| `pages/Login.tsx` | onboarding card style | **RESKIN+PRESERVE.** Already close (sketch radius, Caveat). Move to kit `SketchCard`/`InkButton`, add `AegisLockup` + optional corner frame. Keep `onAuth`, TOTP branch, all a11y/live regions. |
| `pages/Dashboard.tsx` + `components/dashboard/*` | `DashboardPage` | **RESKIN+PRESERVE.** Heartbeat/countdown look (`CountdownCard` already sketchy → kit), `StatPill` row, Phase-3 packet/release status cards, activity. Keep 30s poll, `getDashboard()`, summary types. |
| `pages/Switches.tsx` + `components/switches/*` | `TriggerPage` | **RESKIN+PRESERVE.** Trigger look; `SwitchCard`/`SwitchForm`/`ReadinessChecklist`/`SwitchActionButtons` logic intact. |
| `pages/Release.tsx` | `ReleasePage` | **RESKIN+PRESERVE.** Warning banner/countdown/timeline/abort; logic intact. |
| `pages/Settings.tsx` + `components/settings/*` | — | **RESKIN only.** Sketch tabs; all settings/SMTP/Telegram/storage/relay/security/danger-zone logic + a11y intact. |
| `pages/AuditLog.tsx` | — | **RESKIN only.** `SketchCard` table; query logic intact. |
| `pages/claim/ClaimPortal.tsx` | — | **RESKIN+PRESERVE.** Minimal no-sidebar sketch layout; token flow intact. |

OSS theme context reconciles with the existing `lib/theme.ts` (keep its exported values; the new provider wraps/extends, does not break imports). `MortalityRow` available but **off by default** in OSS.

---

## 6. Theme & Tweaks Mechanics

- `ThemeProvider` at app root in both repos. All ported components consume `useTheme()`/`useTweaks()` — **zero `window.__aegis*` globals** in committed code.
- Production: blueprint theme, no panel, no FAB, no persistence, defaults frozen.
- Dev gate (`import.meta.env.DEV` || `?tweaks=1` || `localStorage 'aegis:tweaks'='1'`): panel + FAB mount, tweaks persist to localStorage, full live restyle for design iteration during the Sonnet session.
- `AppShell`/`SketchCard`/`InkButton`/`SectionTitle`/`AegisLockup` honor the tweak fields (`sidebarWidth`, `logoSize`, `cardStyle`, `buttonShape`, `density`, `tiltAmount`, `headingScale`, `accentColor`, `showDoodles`) exactly as the originals did.

---

## 7. Verification & Safety Protocol

- **Branch:** dedicated branch per repo, e.g. `restore-sketch-aesthetic`. **No force-push. No history rewrite. No `--no-verify`.**
- **Commit granularity:** one commit per surface row in Section 5 (or finer). Conventional message, co-authored trailer.
- **Per-surface gate (all must pass before next surface):**
  1. `tsc -b` / typecheck clean.
  2. Full repo test suite green — regression baseline **SaaS ≥ 638**, **OSS ≥ 504** (numbers must not drop; new visual work adds no test debt).
  3. `vite build` succeeds.
  4. Playwright screenshot of the surface, reviewed against the original rendered reference (serve the backup `index.html` for the presentational pages; for wired pages, visual review against the original component intent). Visual is **reviewed**, not pixel-diff-gated (mock vs live data differs); functional gates (1–3) are **hard-blocking**.
  5. Manual smoke of the golden path for that surface in a browser/dev server.
- **Regression rule:** any drop in passing tests, any type error, any build failure → stop, root-cause, fix before proceeding. No skipping/deleting tests to "make it pass."
- **Cross-repo final pass (P10):** full suites + builds both repos, end-to-end visual QA, remove dead code (`Nav.tsx`, ad-hoc `T` objects, unreferenced marketing components), confirm dev gate truly excludes the panel from a production build.

---

## 8. Sequencing (gated, committed units)

| Phase | Repo | Content |
|------:|------|---------|
| **P0** | SaaS | Scaffold SaaS kit: `lib/theme.tsx`, `components/ui`, `components/icons`, `components/brand`, `components/animations`, `components/layout/AppShell`, `components/dev/TweaksPanel`, `index.css`/preset backstop, font verification, `ThemeProvider` mount. No page reskinned yet; build+tests stay green. (OSS gets the equivalent scaffold in P9.) |
| **P1** | SaaS | `marketing/Landing` (copy+IA+mortality+badges+pricing+legal) |
| **P2** | SaaS | `marketing/Pricing` + legal pages + `MarketingShell` |
| **P3** | SaaS | auth (Login/Register/RequestReset/ResetPassword) |
| **P4** | SaaS | `AppShell` swap + `Dashboard` |
| **P5** | SaaS | `Estate`, `Contacts`, `Trigger`, `Release` |
| **P6** | SaaS | `Onboarding`, `Billing`, `Settings`, `Relay` |
| **P7** | SaaS | claim portal (no-sidebar layout) |
| **P8** | SaaS | admin; delete dead `Nav.tsx`; SaaS final suite |
| **P9** | OSS | scaffold (P0 for OSS) + `App.tsx` `AppShell` swap + `Login` + `Setup` (incl. reskinned Step 0 intro) |
| **P10** | OSS | `Dashboard`, `Switches`, `Release`, `Settings`, `AuditLog`, `claim/ClaimPortal`; remove ad-hoc `T` objects |
| **P11** | both | Cross-repo visual QA, dead-code cleanup, production-build gate check, final full suites both repos |

(Exact task decomposition is produced by the writing-plans step; this is the sequencing contract.)

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Reskin silently drops an a11y attribute added in Phase 5 | Section 3 makes a11y carry-through non-negotiable; per-surface review checklist includes "every `aria-*`/`role`/live-region from the old file is present in the new file". |
| Marketing copy restoration reintroduces a banned claim | Banned-claims list enforced on P1/P2; legal scaffolding explicitly retained. |
| Sidebar shell breaks routing/guards | Route paths unchanged; `AppShell` is a pure layout wrapper around existing route elements; OSS `authStatus` machine untouched. |
| Tweaks panel leaks into production bundle | Dev gate via `import.meta.env.DEV` (build-time) → tree-shaken; P11 explicitly verifies a production build excludes panel/FAB. |
| Theme context regresses OSS `lib/theme.ts` consumers | Provider extends, does not replace; existing exports preserved; OSS suite is the gate. |
| Mortality animation perf on landing | Ported as-is (already shipped-quality in the original); landing-only; rAF cleanup preserved. |
| Pixel-diff flakiness blocks progress | Visual is reviewed, not auto-gated; only typecheck/test/build are hard gates. |
| Scope creep into backend/logic | Section 3 preservation boundary; commits that touch `lib/*.ts`/`server/**` beyond the provider addition are out of scope. |

---

## 10. Definition of Done

- Both repos build, typecheck, and pass full suites at ≥ baseline test counts.
- SaaS: every surface in 5.1–5.5 renders in the original sketch aesthetic; landing matches original copy/IA with legal scaffolding retained and live pricing; left-sidebar shell in use; `Nav.tsx` removed.
- OSS: every surface in 5.6 on the shared kit; `AppShell` sidebar in use; `Setup` Step 0 is the branded hero; no ad-hoc `T` token objects remain.
- Tweaks panel functional in dev, provably absent from a production build.
- No functional, routing, accessibility, or legal-copy regression versus pre-work `main`.
- Work isolated on `restore-sketch-aesthetic` branches; no force-push; commit-per-surface history.
