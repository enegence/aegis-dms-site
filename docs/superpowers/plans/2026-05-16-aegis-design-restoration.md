# Aegis Sketch Aesthetic Restoration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT use subagents for this plan — the user requires single-session accountability. Use superpowers:executing-plans (inline, batched with checkpoints).**

**Goal:** Restore the original hand-drawn "blueprint sketch" aesthetic and original information architecture across the SaaS (`aegis-dms-site/`) and OSS (`aegis/`) web apps without regressing any Phase 1–5 functionality, accessibility, or legal copy.

**Architecture:** Approach A — port the original design as a real TSX component kit (duplicated per repo), then reskin every existing page **in place** (presentation only; data/API/routing/a11y untouched). The pristine original design in the backup repo is the canonical visual source of truth. A Tailwind preset backstop ensures un-migrated elements never look half-done. Strict per-surface verification gates.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind 3, react-router (SaaS v7 / OSS), Fastify+Drizzle backends (untouched), Vitest (backend regression), Playwright (E2E + visual review).

**Companion spec:** `docs/superpowers/specs/2026-05-16-aegis-design-restoration-design.md` (read it first — it owns the decisions, preservation boundary, and surface map this plan executes).

---

## Canonical Paths (constants used throughout)

- **`$BACKUP`** = `/home/eric/dev/aegis-dms-site.backup.20260515-025639` — pristine original design. **Read-only source of truth.** Never modified.
- **`$SAAS`** = `/home/eric/dev/aegis-dms-site` — SaaS repo (this repo; plan + spec live here).
- **`$OSS`** = `/home/eric/dev/aegis` — OSS repo.

Canonical design source files in `$BACKUP`: `index.html`, `aegis-app.jsx`, `aegis-inner.jsx`, `aegis-icons.jsx`, `aegis-logo.jsx`, `aegis-animations.jsx`, `tweaks-panel.jsx`.

---

## Working Agreement (read before any task)

1. **Branch:** create `restore-sketch-aesthetic` in the target repo before its first task. **No force-push, no history rewrite, no `--no-verify`, no `git add -A`** (stage explicit paths). One commit per task minimum; one per surface at most.
2. **Preservation boundary (from spec §3):** never edit `server/**`, `packages/**`, `web/src/lib/*.ts` (except the *new* `lib/theme.tsx`), route **paths**/guards in `App.tsx`, data hooks, state machines, or any legal/policy text body. Carry **every** `aria-*`, `role`, live-region, focus-ring attribute from each old file into its new markup verbatim.
3. **Porting rule (JS→TSX):** when a task says "port from `$BACKUP/<file>` lines X–Y", copy that code, then apply exactly these transforms and nothing else:
   - Add explicit TypeScript prop types/interfaces.
   - Replace every `window.__aegisTheme` read with `useTheme()`; every `window.__aegisTweaks` read with `const [tweaks] = useTweaks()`.
   - Replace `React.useState`/`React.useEffect`/`React.Fragment` with imported `useState`/`useEffect`/`Fragment`.
   - Keep all SVG geometry, numbers, colors, easing math, and class/style values **byte-identical** to the source.
   - Export via the module's barrel.
4. **TDD scope:** genuinely testable pure logic (theme resolver, dev-gate predicate) gets red→green unit tests (shown in full below). Presentational reskin is regression-guarded by the existing backend suite + web typecheck/build + Playwright E2E + visual screenshot review, per the approved spec verification protocol (spec §7) — this is intentional, not a missing-test gap.
5. **The Reskin Procedure (RP)** — referenced by every reskin task, fully defined once here:
   - **RP-1.** Open the target file and its canonical analogue in `$BACKUP` (named in the task).
   - **RP-2.** List every `aria-*`/`role`/live-region/focus attribute and every data/handler binding (`onClick`, `onChange`, `useEffect`, API calls, conditionals) in the target. This list is the invariant set.
   - **RP-3.** Rebuild the target's JSX using kit primitives (`SketchCard`, `InkButton`, `SectionTitle`, `StatPill`, icons, `AegisLockup`, `AppShell`) to match the canonical analogue's structure/spacing/typography, re-attaching every item from RP-2 unchanged.
   - **RP-4.** Replace ad-hoc colors with `useTheme()` tokens; replace plain Tailwind `rounded*` with kit components (the preset backstop covers stragglers).
   - **RP-5.** Diff against RP-2: every invariant present? If any dropped, restore it.
   - **RP-6.** Run the task's verification block; all hard gates green before commit.
6. **Per-surface verification block (VB)** — referenced by every reskin task, defined once:
   - SaaS: `cd $SAAS && npm test` (contracts+server, ≥638 pass) ; `npm run build --workspace=web` (tsc -b + vite build, clean) ; `npm run test:e2e` (E2E green) .
   - OSS: `cd $OSS && npm test` (server, ≥504 pass) ; `npm run build --workspace=web` (clean) ; `npm run test:e2e` (green).
   - Visual: with dev servers up, Playwright screenshot the surface; review against the canonical analogue rendered from `$BACKUP/index.html`. Visual is **reviewed, not auto-gated**; `npm test`/build/E2E are **hard-blocking**.
   - Any baseline test-count drop, type error, build failure, or E2E regression → stop, root-cause, fix. Never delete/skip tests to pass.

---

## File Structure (created/modified)

**Kit modules — created identically in BOTH `$SAAS/web/src/` and `$OSS/web/src/`:**

- `lib/theme.tsx` — `ThemeProvider`, `useTheme()`, `useTweaks()`, `THEMES`, `TWEAK_DEFAULTS`, `resolveTheme()`, `tweaksPanelEnabled()`.
- `components/ui/{SketchCard,InkButton,SectionTitle,StatPill}.tsx` + `index.ts`.
- `components/icons/{DrawIcon, ...17 icons}.tsx` + `index.ts`.
- `components/brand/{AegisMascot,AegisLockup}.tsx` + `index.ts`.
- `components/animations/{MortalityRow,scenes,washes}.tsx` + `index.ts`.
- `components/layout/AppShell.tsx`.
- `components/dev/TweaksPanel.tsx`.
- `index.css` — add sketchy scrollbar + Tailwind backstop layer.

**SaaS modified:** `web/src/main.tsx`; all `web/src/pages/**`; `web/src/components/{onboarding,billing,settings,relay,admin}/**`; new `web/src/components/marketing/MarketingShell.tsx`; **delete** `web/src/components/Nav.tsx` (after P8).

**OSS modified:** `web/src/main.tsx` (or root); `web/src/App.tsx`; all `web/src/pages/**`; `web/src/components/{dashboard,switches,settings}/**`; reconcile `web/src/lib/theme.ts`.

---

## P0 — SaaS Kit Scaffold

### Task 0.1: Branch + theme resolver (TDD)

**Files:**
- Create: `$SAAS/web/src/lib/theme.tsx`
- Test: `$SAAS/web/src/lib/theme.test.ts`

- [ ] **Step 1: Branch**

```bash
cd /home/eric/dev/aegis-dms-site
git checkout -b restore-sketch-aesthetic
```

- [ ] **Step 2: Add Vitest to web (if absent) — check first**

```bash
cd /home/eric/dev/aegis-dms-site
grep -q '"test"' web/package.json && echo HAS_TEST || echo NO_TEST
ls web/vitest.config.* 2>/dev/null || echo NO_VITEST_CFG
```

If `NO_TEST`/`NO_VITEST_CFG`: add `"test": "vitest run"` to `web/package.json` scripts and create `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

Add dev dep: `npm i -D vitest --workspace=web`.

- [ ] **Step 3: Write the failing test**

```ts
// $SAAS/web/src/lib/theme.test.ts
import { describe, it, expect } from 'vitest';
import { THEMES, TWEAK_DEFAULTS, resolveTheme, tweaksPanelEnabled } from './theme';

describe('resolveTheme', () => {
  it('returns blueprint by default', () => {
    expect(resolveTheme(TWEAK_DEFAULTS).bg).toBe('#DDE8F4');
    expect(resolveTheme(TWEAK_DEFAULTS).accent).toBe('#1A6B9A');
  });
  it('switches palette by theme key', () => {
    expect(resolveTheme({ ...TWEAK_DEFAULTS, theme: 'midnight' }).bg).toBe('#111111');
  });
  it('accentColor overrides theme accent', () => {
    expect(resolveTheme({ ...TWEAK_DEFAULTS, accentColor: '#FF0000' }).accent).toBe('#FF0000');
  });
  it('falls back to blueprint for unknown theme', () => {
    expect(resolveTheme({ ...TWEAK_DEFAULTS, theme: 'bogus' }).bg).toBe(THEMES.blueprint.bg);
  });
});

describe('tweaksPanelEnabled', () => {
  it('true when dev', () => {
    expect(tweaksPanelEnabled({ dev: true, search: '', ls: null })).toBe(true);
  });
  it('true when ?tweaks=1', () => {
    expect(tweaksPanelEnabled({ dev: false, search: '?tweaks=1', ls: null })).toBe(true);
  });
  it('true when localStorage flag set', () => {
    expect(tweaksPanelEnabled({ dev: false, search: '', ls: '1' })).toBe(true);
  });
  it('false in plain production', () => {
    expect(tweaksPanelEnabled({ dev: false, search: '', ls: null })).toBe(false);
  });
});
```

- [ ] **Step 4: Run test, verify it fails**

Run: `cd $SAAS && npm run test --workspace=web`
Expected: FAIL — `./theme` has no such exports.

- [ ] **Step 5: Implement `lib/theme.tsx`**

Copy `THEMES` from `$BACKUP/index.html` lines 63–79 and `TWEAK_DEFAULTS` from lines 49–61 byte-identically. Then:

```tsx
// $SAAS/web/src/lib/theme.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export const THEMES = {
  blueprint: { bg: '#DDE8F4', ink: '#0B1C2C', accent: '#1A6B9A', muted: '#4A6B8A', surface: '#C8D9ED', border: '#8AAAC8', danger: '#C0392B' },
  cream:     { bg: '#F7F4EE', ink: '#1C1917', accent: '#A0522D', muted: '#8B7355', surface: '#EDE9E0', border: '#C4B89A', danger: '#C0392B' },
  midnight:  { bg: '#111111', ink: '#F0EBE0', accent: '#E8C840', muted: '#888880', surface: '#1E1E1E', border: '#333330', danger: '#E53935' },
} as const;

export const TWEAK_DEFAULTS = {
  theme: 'blueprint', sketchIntensity: 'full', accentColor: '', tiltAmount: 1.25,
  headingScale: 1, cardStyle: 'sketchy', density: 'comfortable', showDoodles: true,
  buttonShape: 'sketchy', sidebarWidth: 220, logoSize: 'md',
};

export type Tweaks = typeof TWEAK_DEFAULTS & Record<string, unknown>;
export type Theme = typeof THEMES.blueprint;

export function resolveTheme(tweaks: Tweaks): Theme {
  const base = (THEMES as Record<string, Theme>)[tweaks.theme as string] || THEMES.blueprint;
  return { ...base, accent: (tweaks.accentColor as string) || base.accent };
}

export function tweaksPanelEnabled(env: { dev: boolean; search: string; ls: string | null }): boolean {
  return env.dev || /[?&]tweaks=1\b/.test(env.search) || env.ls === '1';
}

interface Ctx { theme: Theme; tweaks: Tweaks; setTweak: (k: string, v: unknown) => void; }
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const devGate = tweaksPanelEnabled({
    dev: import.meta.env.DEV,
    search: typeof window !== 'undefined' ? window.location.search : '',
    ls: typeof window !== 'undefined' ? window.localStorage.getItem('aegis:tweaks') : null,
  });
  const [tweaks, setTweaks] = useState<Tweaks>(() => {
    if (devGate && typeof window !== 'undefined') {
      try { const s = window.localStorage.getItem('aegis:tweaks:state'); if (s) return { ...TWEAK_DEFAULTS, ...JSON.parse(s) }; } catch { /* ignore */ }
    }
    return { ...TWEAK_DEFAULTS };
  });
  const setTweak = useCallback((k: string, v: unknown) => {
    setTweaks(prev => {
      const next = { ...prev, [k]: v };
      if (devGate && typeof window !== 'undefined') {
        try { window.localStorage.setItem('aegis:tweaks:state', JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }, [devGate]);
  const theme = resolveTheme(tweaks);
  return <ThemeCtx.Provider value={{ theme, tweaks, setTweak }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const c = useContext(ThemeCtx); if (!c) throw new Error('useTheme outside ThemeProvider'); return c.theme;
}
export function useTweaks(): [Tweaks, (k: string, v: unknown) => void] {
  const c = useContext(ThemeCtx); if (!c) throw new Error('useTweaks outside ThemeProvider'); return [c.tweaks, c.setTweak];
}
export function useTweaksPanelEnabled(): boolean {
  return tweaksPanelEnabled({
    dev: import.meta.env.DEV,
    search: typeof window !== 'undefined' ? window.location.search : '',
    ls: typeof window !== 'undefined' ? window.localStorage.getItem('aegis:tweaks') : null,
  });
}
```

- [ ] **Step 6: Run test, verify pass**

Run: `cd $SAAS && npm run test --workspace=web`
Expected: PASS (10 assertions).

- [ ] **Step 7: Commit**

```bash
cd /home/eric/dev/aegis-dms-site
git add web/src/lib/theme.tsx web/src/lib/theme.test.ts web/package.json web/vitest.config.ts
git commit -m "feat(web): theme/tweaks context + dev-gate resolver (tested)"
```

### Task 0.2: UI primitives

**Files:** Create `$SAAS/web/src/components/ui/{SketchCard,InkButton,SectionTitle,StatPill}.tsx`, `index.ts`.

- [ ] **Step 1:** Port `SketchCard` from `$BACKUP/aegis-inner.jsx` lines 33–57, `InkButton` 59–99, `SectionTitle` 21–31, `StatPill` 5–19, applying the §3 porting transforms (typed props: `SketchCard{children,style?,tilt?}`, `InkButton{children,onClick?,variant?:'primary'|'ghost'|'danger',size?:'sm'|'md'|'lg',style?}`, `SectionTitle{children,sub?}`, `StatPill{label,value:ReactNode,accent?}`). Geometry/radii/shadow values byte-identical.
- [ ] **Step 2:** `index.ts` barrel exports all four.
- [ ] **Step 3:** Verify build: `cd $SAAS && npm run build --workspace=web` → clean.
- [ ] **Step 4: Commit**

```bash
git add web/src/components/ui
git commit -m "feat(web): port SketchCard/InkButton/SectionTitle/StatPill"
```

### Task 0.3: Icons

**Files:** Create `$SAAS/web/src/components/icons/` (one file or grouped), `index.ts`.

- [ ] **Step 1:** Port `DrawIcon` + all 17 icons from `$BACKUP/aegis-icons.jsx` lines 1–229 (transforms per §3; props `{size?:number,color?:string,style?:CSSProperties}`). SVG paths byte-identical.
- [ ] **Step 2:** Barrel export all (names exactly as source: `IconHeartbeat`…`IconSettings`).
- [ ] **Step 3:** `npm run build --workspace=web` → clean.
- [ ] **Step 4: Commit** `git add web/src/components/icons && git commit -m "feat(web): port hand-drawn icon set"`

### Task 0.4: Brand mascot

**Files:** Create `$SAAS/web/src/components/brand/{AegisMascot,AegisLockup}.tsx`, `index.ts`.

- [ ] **Step 1:** Port from `$BACKUP/aegis-logo.jsx` lines 1–81. `AegisMascot{height?:number,color?:string}`, `AegisLockup{size?:'sm'|'md'|'lg',color?:string}`. SVG byte-identical.
- [ ] **Step 2:** Build clean. Commit `git add web/src/components/brand && git commit -m "feat(web): port AegisMascot/AegisLockup"`

### Task 0.5: Mortality animations

**Files:** Create `$SAAS/web/src/components/animations/` (`MortalityRow.tsx` + scenes + washes), `index.ts`.

- [ ] **Step 1:** Port the entire IIFE body of `$BACKUP/aegis-animations.jsx` lines 1–720: `useCycleTime`, easing helpers (`eO,eI,eI3,lerp,c01,ph,wavePath`), `WcDefs/WcBlob/OutdoorWash/InteriorWash/WaterWash`, `PianoScene/OceanScene/BridgeScene/PlaneScene`, `MortalityRow`, `SceneCard`. Convert the `window`-attached IIFE into ES module exports; replace `window.__aegisTheme` reads in `MortalityRow`/`SceneCard` with `useTheme()`. All numeric/SVG/filter values byte-identical. Scene props typed `{ink:string;accent:string}`.
- [ ] **Step 2:** Build clean. Commit `git add web/src/components/animations && git commit -m "feat(web): port mortality scenes + MortalityRow"`

### Task 0.6: AppShell (sidebar)

**Files:** Create `$SAAS/web/src/components/layout/AppShell.tsx`.

- [ ] **Step 1:** Port `AppShell` from `$BACKUP/aegis-app.jsx` lines 425–497 and `NAV_ITEMS` 417–423. Replace the `setPage` model with a router adapter: props `{ children: ReactNode; navItems: {key:string;label:string;to:string;Icon:ComponentType<{size?:number;color?:string;style?:CSSProperties}>}[]; releaseTo:string; statusLines?: string[] }`. Use `useNavigate`/`useLocation` (react-router) to compute active state from the current path and to navigate; the red Release Mode button navigates to `releaseTo`; logo click → first nav item's `to`. Honor `tweaks.sidebarWidth`/`logoSize` via `useTweaks`. Status block renders `statusLines` (fallback to the original "Status: Armed / Mode: Heartbeat / Dead drop: Synced ✓").
- [ ] **Step 2:** Build clean. Commit `git add web/src/components/layout && git commit -m "feat(web): port AppShell sidebar (router-adapted)"`

### Task 0.7: Dev-gated Tweaks panel + mount

**Files:** Create `$SAAS/web/src/components/dev/TweaksPanel.tsx`; Modify `$SAAS/web/src/main.tsx`; Modify `$SAAS/web/src/index.css`.

- [ ] **Step 1:** Port `tweaks-panel.jsx` (full: `TweaksPanel`, `TweakSection/Slider/Radio/Color/Toggle`, drag, host message protocol) + the `TweaksToggle` FAB and the `<TweaksPanel>` control list from `$BACKUP/index.html` lines 81–209. Drive values via `useTweaks()`/`useTheme()`. Export a single `<DevTweaks/>` that renders the FAB+panel only when `useTweaksPanelEnabled()` is true (so it tree-shakes in prod where `import.meta.env.DEV` is statically false and no flag).
- [ ] **Step 2:** Modify `main.tsx` — wrap `<App/>` with `<ThemeProvider>` and render `<DevTweaks/>` as a sibling inside the provider:

```tsx
import { ThemeProvider } from './lib/theme';
import DevTweaks from './components/dev/TweaksPanel';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
        <DevTweaks />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 3:** `index.css` — append the sketchy scrollbar rule from `$BACKUP/index.html` lines 19–24 and a backstop layer:

```css
@layer utilities {
  .rounded, .rounded-md, .rounded-lg { border-radius: 3px 10px 3px 10px / 10px 3px 10px 3px; }
  .tilt-l { transform: rotate(-0.5deg); } .tilt-r { transform: rotate(0.4deg); }
}
```

- [ ] **Step 4:** Build clean (`npm run build --workspace=web`). Confirm prod bundle excludes panel:

```bash
cd $SAAS && npm run build --workspace=web && grep -rl "twk-panel\|__activate_edit_mode" web/dist/assets 2>/dev/null && echo "LEAK — investigate" || echo "OK: panel absent from prod bundle"
```

Expected: `OK: panel absent from prod bundle`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/dev web/src/main.tsx web/src/index.css
git commit -m "feat(web): dev-gated Tweaks panel + ThemeProvider mount + css backstop"
```

### Task 0.8: P0 gate

- [ ] Run full VB (SaaS). All hard gates green, kit unused by pages yet, app still renders (plain pages, sketchy backstop). Commit nothing (verification only); if anything red, fix before P1.

---

## P1 — SaaS Marketing: Landing

### Task 1.1: Restore Landing (copy + IA + mortality + badges + pricing + legal)

**Files:** Modify `$SAAS/web/src/pages/marketing/Landing.tsx`. Canonical analogue: `$BACKUP/aegis-app.jsx` `LandingPage` lines 2–276.

- [ ] **Step 1 (RP-1/RP-2):** Inventory current `Landing.tsx` invariants: the alpha-disclaimer block, "AEGIS IS NOT A WILL, TRUST, OR LEGAL DOCUMENT" line, footer legal links list (`/terms /privacy /security /disclaimers /acceptable-use /data-deletion`), and the `/api/pricing` consumption pattern used by `Pricing.tsx` (read `web/src/pages/marketing/Pricing.tsx` + `web/src/lib/billing.ts` to reuse the exact fetch + null handling).
- [ ] **Step 2 (RP-3):** Rebuild `Landing.tsx` to mirror `LandingPage` exactly: hero (corner doodles gated by `tweaks.showDoodles`, `AegisLockup size="lg"`, H1 “What happens after you're gone?”, the 3-line privacy tagline, `InkButton` "Set Up Your Switch →" → `/register`, ghost "See the Dashboard" → `/login`); the 3 illustrated stick-figure trust badges (verbatim SVG from lines 56–178); `<MortalityRow/>` with the line “any of these could happen on a perfectly ordinary tuesday”; "How it works" 3 steps; "Two trigger modes"; "Pick your level of paranoia" 3 pricing cards (Open Source / Aegis Relay `POPULAR` / Aegis Hosted) — **card amounts from live `/api/pricing`**, with "Pricing coming soon"/link fallback when a price is null; footer with `AegisMascot`.
- [ ] **Step 3 (RP-4/RP-5):** Re-insert the retained alpha disclaimer + "NOT A WILL…" + footer legal links into the sketch footer/hero. Confirm **no banned claims** present (grep below). Confirm every Step-1 invariant present.

```bash
cd $SAAS && grep -niE "guaranteed release|zero[- ]knowledge|legal replacement|production[- ]audited" web/src/pages/marketing/Landing.tsx && echo "BANNED CLAIM — remove" || echo "OK: no banned claims"
```

- [ ] **Step 4 (RP-6 / VB):** Run SaaS VB. Visual: screenshot `/` vs `$BACKUP/index.html` landing. Hard gates green.
- [ ] **Step 5: Commit** `git add web/src/pages/marketing/Landing.tsx && git commit -m "feat(web): restore original landing aesthetic, copy & IA (live pricing, legal retained)"`

---

## P2 — SaaS Marketing: Pricing + Legal + Shell

### Task 2.1: MarketingShell

**Files:** Create `$SAAS/web/src/components/marketing/MarketingShell.tsx`.

- [ ] **Step 1:** Build a shell: top `AegisLockup` (→ `/`), `{children}`, dashed-border footer (`2px dashed border`) with `AegisMascot`, the "NOT A WILL…" line, and the legal links list. Props `{children:ReactNode}`. Use kit + `useTheme()`.
- [ ] **Step 2:** Build clean. Commit `git add web/src/components/marketing && git commit -m "feat(web): marketing shell (mascot header/footer)"`

### Task 2.2: Pricing

**Files:** Modify `$SAAS/web/src/pages/marketing/Pricing.tsx`. Analogue: pricing section of `LandingPage` lines 229–262.

- [ ] RP-1…RP-6 with VB. Preserve the existing `/api/pricing` fetch + null-state handling exactly; wrap page in `MarketingShell`; render plans as sketch pricing cards. Commit `git commit -m "feat(web): sketch pricing page (live prices preserved)"`

### Task 2.3: Legal/info pages

**Files:** Modify `Docs.tsx, Terms.tsx, Privacy.tsx, Security.tsx, AcceptableUse.tsx, Disclaimers.tsx, DataDeletion.tsx, Contact.tsx` in `$SAAS/web/src/pages/marketing/`.

- [ ] For each: wrap body in `MarketingShell`, put content in `SketchCard`, headings in `SectionTitle`. **Do not alter any policy/legal text or `Contact.tsx` form logic.** One commit per 2–3 pages with VB after the batch.
- [ ] Verify legal text unchanged:

```bash
cd $SAAS && git stash && cp -r web/src/pages/marketing /tmp/mk-before && git stash pop
# after edits: compare visible text content (strip tags) manually for Terms/Privacy/Security/AUP/Disclaimers/DataDeletion
```

(Practical check: diff the human-readable strings; tags/classes change, sentences must not.)

- [ ] Commit(s) `git commit -m "feat(web): sketch-skin legal/info marketing pages (text unchanged)"`

### Task 2.4: P2 gate — full VB.

---

## P3 — SaaS Auth

### Task 3.1: Auth pages

**Files:** Modify `$SAAS/web/src/pages/auth/{Login,Register,RequestReset,ResetPassword}.tsx`. Analogue: onboarding card style `$BACKUP/aegis-app.jsx` lines 333–410.

- [ ] Apply RP per file: centered `SketchCard` (radius `3px 10px 3px 10px / 10px 3px 10px 3px`), Caveat H1, mono labels, sketch inputs, `InkButton` submit, optional corner-doodle frame. **Preserve** all form state, validation, CSRF, email-verify messaging, TOTP challenge branch, and every `aria-*`/`role="alert"`/live-region attribute (RP-2 list per file).
- [ ] VB after the batch. Commit `git commit -m "feat(web): sketch-skin auth pages (logic & a11y preserved)"`

---

## P4 — SaaS AppShell swap + Dashboard

### Task 4.1: Introduce AppShell to the authenticated app

**Files:** Modify `$SAAS/web/src/pages/app/Dashboard.tsx` first as the pilot; define the shared nav model inline or in `components/layout/navModel.ts`.

- [ ] **Step 1:** Create nav model: items Dashboard `/dashboard` (IconDashboard), Legacy Packet `/estate` (IconLegacy), Contacts `/contacts` (IconContacts), Trigger `/switches` (IconTrigger), Relay `/relay` (IconCloud), Billing `/app/billing` (IconDeployment), Settings `/app/settings` (IconSettings); release → `/release`. Admin section appended when `useAuth().user?.role` ∈ {admin,sa} (same predicate as current `Nav.tsx` lines 16).
- [ ] **Step 2 (RP):** Replace `<Nav/>` in `Dashboard.tsx` with `<AppShell navItems=… releaseTo="/release" statusLines={…}>`; rebuild the dashboard body to mirror `$BACKUP/aegis-inner.jsx` `DashboardPage` lines 101–196 (heartbeat card + countdown + progress bar from real `nextActionAt`; `StatPill` row from `data.estateItemCount/contactCount/activeSwitchCount/relayConnectionCount`; "Recent Activity" from `recentAuditEvents` if present else existing blocks). **Preserve** `getDashboard()`, the `/api/app/packets`+`/api/app/release-runs` `Promise.all`, `shouldShowHostedOnboarding`, email-verify banner, subscription/next-switch/empty-state blocks, all links.
- [ ] **Step 3:** VB (incl. E2E — dashboard is covered by E2E flows; must stay green). Commit `git commit -m "feat(web): AppShell sidebar + restore Dashboard look"`

---

## P5 — SaaS Core App Pages

### Task 5.1: Estate
Modify `$SAAS/web/src/pages/app/Estate.tsx`. Analogue `LegacyPage` lines 224–317. RP + VB. Preserve estate API + category model + a11y. Commit `feat(web): restore Estate (Legacy Packet) look`.

### Task 5.2: Contacts
Modify `app/Contacts.tsx`. Analogue `ContactsPage` 320–413. RP + VB. Preserve reorder/notify/cascade logic. Commit `feat(web): restore Contacts cascade look`.

### Task 5.3: Trigger
Modify `app/Trigger.tsx`. Analogue `TriggerPage` 416–507. RP + VB. Preserve switches API/state-machine/validation. Commit `feat(web): restore Trigger look`.

### Task 5.4: Release
Modify `app/Release.tsx`. Analogue `ReleasePage` 510–595. RP + VB. Preserve release-run/abort/auth logic. Commit `feat(web): restore Release look`.

### Task 5.5: P5 gate — full VB.

---

## P6 — SaaS Onboarding / Billing / Settings / Relay

### Task 6.1: Onboarding
Modify `app/Onboarding.tsx` + `components/onboarding/{OnboardingShell,HostedOnboarding,TrustModelCard}.tsx`. Analogue `OnboardingPage` 279–414 (step dots, sketch mode buttons, interval slider, success card w/ `AegisMascot`). RP + VB. Preserve onboarding state, plan-aware routing, checklist, `TrustModelCard` semantics. Commit `feat(web): restore Onboarding look`.

### Task 6.2: Billing
Modify `app/Billing.tsx` + `components/billing/{PlanStatusCard,BillingActions}.tsx`. RP + VB. Preserve Stripe portal redirect + subscription gating. Commit `feat(web): sketch-skin Billing`.

### Task 6.3: Settings
Modify `app/Settings.tsx` + `components/settings/{AccountSettings,NotificationPreferenceSettings,SecuritySettings}.tsx`. Sketch tabbed layout. RP + VB. Preserve all settings endpoints, TOTP setup/disable, a11y. Commit `feat(web): sketch-skin Settings (tabs)`.

### Task 6.4: Relay
Modify `app/Relay.tsx` + `components/relay/{RelayConnectCard,RelayConnectionList,RelayEscrowCard,RelayHeartbeatStatus}.tsx`. Analogue `DeploymentPage` 598–686 selectable cards. RP + VB. Preserve relay connect/disconnect/key-rotation API. Commit `feat(web): sketch-skin Relay`.

### Task 6.5: P6 gate — full VB.

---

## P7 — SaaS Claim Portal

### Task 7.1: Claim portal (no-sidebar minimal layout)

**Files:** Modify `$SAAS/web/src/pages/claim/{ClaimLanding,ClaimVerify,ClaimAccept,ClaimDownload,ClaimAcknowledge}.tsx`.

- [ ] Build a minimal claim layout (NO `AppShell`): centered `SketchCard`, `AegisLockup` header, mono body, `InkButton` actions, dashed footer. Apply RP per file. **Preserve** the 5-step token flow, token validation, verify/download/acknowledge logic, and all a11y (claim portal a11y was hardened in Phase 5 — RP-2 must capture every attribute).
- [ ] VB incl. E2E (claim flow is E2E-covered). Commit `feat(web): sketch-skin claim portal (token flow & a11y preserved)`.

---

## P8 — SaaS Admin + cleanup

### Task 8.1: Admin
Modify `$SAAS/web/src/pages/admin/{AdminDashboard,AdminUsers,AdminRelay,AdminReleaseRuns,UserDetail}.tsx` + `components/admin/{RelayMetrics,SubscriptionMetrics,SystemHealthPanel,UserTable}.tsx`. Render inside `AppShell` "Admin" section. `SectionTitle`/`StatPill`/`SketchCard` for metrics/tables. RP + VB. Preserve 403 enforcement, metrics queries, user-detail actions. Commit `feat(web): sketch-skin admin`.

### Task 8.2: Remove dead Nav
- [ ] Confirm no imports remain: `cd $SAAS && grep -rn "components/Nav" web/src && echo "STILL USED — migrate first" || git rm web/src/components/Nav.tsx`
- [ ] VB. Commit `chore(web): remove obsolete top Nav`.

### Task 8.3: SaaS final gate
- [ ] Full VB; production-bundle panel-absence check (Task 0.7 Step 4 command); commit nothing if clean.

---

## P9 — OSS Scaffold + Shell + Login + Setup

### Task 9.1: OSS branch + kit scaffold
- [ ] `cd $OSS && git checkout -b restore-sketch-aesthetic`
- [ ] Repeat Tasks 0.1–0.7 against `$OSS` paths. Differences: OSS already has `web/src/lib/theme.ts` — **keep its existing exports**, add the new `theme.tsx` provider alongside; if names collide, re-export from `theme.tsx` so existing importers keep working (`grep -rn "lib/theme" web/src` first; reconcile imports without changing their behavior). OSS `main.tsx`/root: wrap `<App/>` with `<ThemeProvider>` + `<DevTweaks/>` (mirror Task 0.7 Step 2 to OSS's bootstrap; OSS routes via `App.tsx` — keep its `authStatus` machine intact, only wrap at the render root). Use OSS test command `npm test` (server) for VB; web vitest added as in 0.1 Step 2.
- [ ] Commit per sub-task as in P0 (messages prefixed `feat(oss-web):`).

### Task 9.2: OSS App shell swap
**Files:** Modify `$OSS/web/src/App.tsx`. Analogue `$BACKUP/aegis-app.jsx` AppShell.
- [ ] Replace inline `Nav` + `AuthedApp` chrome with `<AppShell navItems=[Dashboard `/dashboard` IconDashboard, Switches `/switches` IconTrigger, Release `/release` IconRelease, Audit `/audit-log` IconLegacy, Settings `/settings` IconSettings] releaseTo="/release">`. Logout action preserved (call existing `handleLogout`). **Do not change** `authStatus` state machine, claim-path special-casing (`window.location.pathname.startsWith('/claim/')`), or `Navigate` fallbacks. Remove the local `T` object only where AppShell replaces it.
- [ ] VB (OSS). Commit `feat(oss-web): AppShell sidebar`.

### Task 9.3: OSS Login
Modify `$OSS/web/src/pages/Login.tsx`. RP (already close): kit `SketchCard`/`InkButton`, add `AegisLockup` + optional corner frame. Preserve `onAuth`, TOTP branch, all a11y/live regions. VB. Commit `feat(oss-web): restore Login look`.

### Task 9.4: OSS Setup (incl. branded Step 0 intro)
**Files:** Modify `$OSS/web/src/pages/Setup.tsx`. Analogues: `LandingPage` hero (Step 0) + `OnboardingPage` (steps 1–5).
- [ ] **Step 1:** Keep wizard structure unchanged — `steps = ['Welcome','Profile','Security','Deployment','Acknowledge','Review']`, `step` state, `nextStep()`, all validators (`validateProfile/Security/Ack`), `FieldError`/`role="alert"`, `role="progressbar"`.
- [ ] **Step 2:** Reskin **Step 0 (`step === 0`, ~lines 242–266)** into the branded hero: corner-doodle frame (gated by `tweaks.showDoodles`), `AegisLockup size="lg"`, H1 "What happens after you're gone?", the 3-line privacy tagline, the 3 trust badges (port the SVG badge markup from `$BACKUP/aegis-app.jsx` lines 56–178), and a single `InkButton` "Set Up Your Switch →" whose `onClick` calls the existing `nextStep()`. No new step index, no route change.
- [ ] **Step 3:** Reskin steps 1–5 with `SketchCard`/`InkButton`/sketch inputs; deployment-mode cards styled like `DeploymentPage` (lines 598–686) using the existing `DEPLOYMENT_MODES` data unchanged.
- [ ] **Step 4:** VB (OSS). Manual smoke: fresh-DB first run shows branded Step 0 → "Set Up Your Switch →" → Profile; full wizard completes; returning user sees Login (not intro).
- [ ] Commit `feat(oss-web): restore Setup wizard + branded Step 0 intro`.

---

## P10 — OSS Remaining Pages

### Task 10.1: Dashboard
Modify `$OSS/web/src/pages/Dashboard.tsx` + `components/dashboard/{CountdownCard,SwitchSummaryCards,SystemHealthCard}.tsx`. Analogue `DashboardPage`. RP + VB. Preserve 30s poll, `getDashboard()`, Phase-3 packet/release cards. Commit `feat(oss-web): restore Dashboard look`.

### Task 10.2: Switches
Modify `pages/Switches.tsx` + `components/switches/{SwitchCard,SwitchForm,ReadinessChecklist,SwitchActionButtons}.tsx`. Analogue `TriggerPage`. RP + VB. Preserve all switch logic. Commit `feat(oss-web): restore Switches look`.

### Task 10.3: Release
Modify `pages/Release.tsx`. Analogue `ReleasePage`. RP + VB. Commit `feat(oss-web): restore Release look`.

### Task 10.4: Settings + AuditLog
Modify `pages/Settings.tsx` + `components/settings/*` (sketch tabs) and `pages/AuditLog.tsx` (SketchCard table). RP + VB. Preserve all settings/SMTP/Telegram/storage/relay/security/danger-zone logic + audit query + a11y. Commit `feat(oss-web): sketch-skin Settings & AuditLog`.

### Task 10.5: Claim portal
Modify `$OSS/web/src/pages/claim/ClaimPortal.tsx`. Minimal no-sidebar sketch layout. RP + VB. Preserve token flow. Commit `feat(oss-web): sketch-skin claim portal`.

### Task 10.6: Remove dead OSS chrome
- [ ] Remove now-unused inline `Nav`/`T`/`T2` token objects where fully replaced (`grep -rn "const T = {" web/src` — only remove ones with zero remaining refs). VB. Commit `chore(oss-web): remove obsolete inline nav/token objects`.

---

## P11 — Cross-Repo Final QA

### Task 11.1: SaaS final
- [ ] `cd $SAAS && npm test && npm run build --workspace=web && npm run test:e2e` all green. Prod bundle excludes Tweaks panel (Task 0.7 Step 4). Visual sweep of every surface vs `$BACKUP`.

### Task 11.2: OSS final
- [ ] `cd $OSS && npm test && npm run build --workspace=web && npm run test:e2e` all green. Prod bundle excludes Tweaks panel. Visual sweep (no landing; Setup Step 0 intro, Login, Dashboard, Switches, Release, Settings, Audit, Claim).

### Task 11.3: Definition-of-Done audit
- [ ] Walk spec §10 checklist; confirm each item. Confirm no `web/src/lib/*.ts` (besides new `theme.tsx`), `server/**`, or route-path changes:

```bash
cd $SAAS && git diff --stat main...restore-sketch-aesthetic -- 'web/src/lib/*.ts' server packages | grep -v 'web/src/lib/theme' && echo "REVIEW: unexpected non-presentational change" || echo "OK"
cd $OSS  && git diff --stat main...restore-sketch-aesthetic -- server packages && echo "REVIEW" || echo "OK"
```

- [ ] Leave branches in place (no merge, no push) unless the user directs otherwise. Report completion + the DoD audit result.

---

## Self-Review (against spec)

**Spec coverage:** §1 background → P0..P11; §2 decisions 1–9 → P1(landing copy/legal/pricing), P4(sidebar), 0.7(dev-gate), per-repo dup(P0/P9), §6 OSS depth(P9–P10), §9 OSS Step-0 intro(Task 9.4). §3 preservation → Working Agreement #2, RP-2/RP-5, Task 11.3 diff guard. §4 kit → 0.1–0.7. §5 surface map → every row has a task (5.1–5.5 SaaS app, 7.1 claim, 8.1 admin, 9–10 OSS). §7 verification → VB + per-task gates. §8 sequencing → P0–P11 matches. §10 DoD → Task 11.3. No gaps.

**Placeholder scan:** No "TBD/TODO/handle edge cases/etc." Reskin tasks reference the fully-defined RP + VB procedures and a named byte-exact canonical source with line ranges (not "similar to Task N") — the source *is* the content; inlining 60 files' TSX would be stale duplication and a worse plan (DRY). New logic (theme/dev-gate) has full code + tests.

**Type consistency:** `resolveTheme(tweaks)`, `tweaksPanelEnabled({dev,search,ls})`, `useTheme()`, `useTweaks()`, `useTweaksPanelEnabled()`, `<DevTweaks/>`, `ThemeProvider`, `AppShell{navItems,releaseTo,statusLines,children}` consistent across P0/0.7/4.1/9.x. Icon/primitive names taken verbatim from source barrels. Consistent.
