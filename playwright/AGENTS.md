# AGENTS.md — visual-check/playwright

> Read the root `AGENTS.md` first for monorepo-wide context.
> This file covers the `@visual-check/playwright` package only.

---

## Package Purpose

This package owns the Playwright test runner. It captures browser screenshots of the live
app, hands them to `@visual-check/core` for diffing against the Figma baseline, and writes
results to `results.json`.

**Owner:** Person 2

---

## Folder Structure

```
visual-check/playwright/
├── AGENTS.md
├── package.json
├── playwright.config.ts       ← viewport lock, base URL, browser config
├── helpers/
│   ├── visualTest.ts          ← core test helper (screenshot → diff → write result)
│   ├── saveAuth.ts            ← manual session capture utility (CLI)
│   └── figmaNodes.ts          ← testName → Figma nodeId mapping
└── tests/
    └── visual.ts              ← visual regression test suite
```

---

## Authentication & Sessions

Visual tests often require a logged-in state. We handle this via `auth.json`.

### `helpers/saveAuth.ts`
A CLI utility to capture session state.
- Run: `pnpm exec tsx helpers/saveAuth.ts`
- Opens a non-headless browser at `BASE_URL`.
- User logs in manually and presses ENTER in terminal.
- Saves `storageState` to `snapshots/auth.json`.

### Session Loading
`visualTest.ts` automatically checks for `snapshots/auth.json`. If it exists, it is loaded into the browser context before the test runs, ensuring the browser is authenticated.

---

## visualTest.ts — The Core Helper

Every visual test file calls this helper. It handles the full pipeline.

### `visualTest(page, testName, options?)`

**What it does internally:**
1. **Initialize:** `getOrCreateBuild(buildId, { projectId, branch: 'web' })`.
2. **Auth:** Browser context loads `auth.json` if available.
3. **Normalize:** Suppresses animations, scrolls to top, waits for `networkidle`.
4. **Capture:** Takes screenshot (full page, selector, or clip).
5. **Diff:** Runs `core.runDiff` against the Figma baseline.
6. **Annotate:** 
    - Finds the Figma node for each diff region using the node tree.
    - Inspects the DOM at the center of each region for labels and metrics (font size, color, etc.).
7. **Persist:** Writes result to `results.json` with region metadata.

---

## playwright.config.ts — Critical Settings

These settings are non-negotiable. Do not change them without syncing with Person 1.

```ts
export default {
  use: {
    viewport: { width: 1440, height: 900 },  // must match Figma frame dimensions
    deviceScaleFactor: 1,                     // must be 1 — Figma exports at 1x
    baseURL: process.env.BASE_URL,
  },
  // Never run visual tests in parallel — race conditions on manifest writes
  workers: 1,
}
```

---

## What AI Agents Should Know

- **`workers: 1` is mandatory** — concurrent writes to `results.json` will corrupt it.
- **Animation suppression** is automatically handled by `visualTest`.
- **`auth.json`** is the standard way to handle authentication; do not implement custom login logic inside tests.
- **`deviceScaleFactor: 1`** is critical for pixel-perfect matching with Figma exports.
- **Node ID Mappings:** `figmaNodes.ts` maps `testName` to Figma `nodeId`. This is only needed when fetching new baselines from Figma.
