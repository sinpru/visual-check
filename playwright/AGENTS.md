# AGENTS.md — visual-check/playwright

> Read the root `AGENTS.md` first for monorepo-wide context.
> This file covers the `@visual-check/playwright` package only.

---

## Package Purpose

This package owns the Playwright test runner. It captures browser screenshots of the live
app, hands them to `@visual-check/core` for diffing against the Figma baseline, and writes
results to `results.json`. It is the entry point for running visual tests.

**Owner:** Person 2

---

## Folder Structure

```
visual-check/playwright/
├── AGENTS.md
├── package.json
├── playwright.config.ts       ← viewport lock, base URL, browser config
├── helpers/
│   └── visualTest.ts          ← core test helper (screenshot → diff → write result)
└── tests/
    └── *.visual.ts            ← individual visual test files
```

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
  // Never run visual tests in parallel — race conditions on results.json
  workers: 1,
}
```

---

## visualTest.ts — The Core Helper

Every visual test file calls this helper. It handles the full pipeline.

### `visualTest(page, testName, options?)`

**Parameters:**
- `page` — Playwright `Page` object
- `testName` — unique string key, must match the Figma node being tested (e.g. `'homepage-hero'`)
- `options` (optional):
  - `selector` — CSS selector for element-level screenshot instead of full page
  - `clip` — `{ x, y, width, height }` to crop the screenshot
  - `updateBaseline` — boolean, if true writes directly to baselines and skips diff

**What it does internally:**
1. Suppresses all CSS animations and transitions before capture
2. Scrolls to top (`window.scrollTo(0, 0)`) to normalize scroll state
3. Waits for `networkidle` to ensure all assets are loaded
4. Takes screenshot — full page, element, or clipped depending on options
5. Saves buffer to `current/{testName}.png` via `core.saveSnapshot`
6. If `updateBaseline` is true → saves to `baselines/` and writes `status: 'pending'`, stops here
7. Checks if a baseline exists — if not, saves as baseline and marks `status: 'pending'`
8. Calls `core.runDiff(baselineBuffer, currentBuffer, diffPath)`
9. Determines pass/fail: `diffPercent < 1.0` → `'pass'`, else `'fail'`
10. Calls `core.writeResult(entry)` to update `results.json`

### Animation suppression (always inject before screenshot)
```ts
await page.addStyleTag({
  content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
})
```

---

## Writing a Visual Test

```ts
// tests/homepage.visual.ts
import { test } from '@playwright/test'
import { visualTest } from '../helpers/visualTest.ts'

test('homepage hero', async ({ page }) => {
  await page.goto('/')
  await visualTest(page, 'homepage-hero')
})

test('homepage nav', async ({ page }) => {
  await page.goto('/')
  await visualTest(page, 'homepage-nav', {
    selector: 'nav',
  })
})
```

---

## Running Tests

```bash
# Normal run — diffs against existing baselines
npm test

# Update baselines — captures current state as new ground truth
UPDATE_BASELINE=true npm test

# Run a single test file
npx playwright test tests/homepage.visual.ts
```

---

## Environment Variables

Consumed from root `.env`:

```env
BASE_URL=http://localhost:3000   # or staging URL
SNAPSHOTS_DIR=../../snapshots    # relative to repo root
UPDATE_BASELINE=false
FIGMA_TOKEN=...                  # passed through to core for baseline fetching
FIGMA_FILE_KEY=...
```

---

## Baseline Fetching Flow

When `UPDATE_BASELINE=true` and no local baseline exists, `visualTest` can optionally
trigger a Figma fetch via `core.fetchFigmaBaseline`. The mapping of `testName` →
Figma `nodeId` lives in a config file:

```ts
// helpers/figmaNodes.ts
export const figmaNodes = {
  'homepage-hero': '123:456',
  'homepage-nav':  '123:789',
}
```

If a `testName` has no entry in `figmaNodes`, skip the Figma fetch and log a warning.

---

## Dependencies

```json
{
  "dependencies": {
    "@visual-check/core": "*",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0"
  }
}
```

---

## What AI Agents Should Know

- **`workers: 1` is mandatory** — concurrent writes to `results.json` will corrupt it
- **Always inject animation suppression before screenshotting** — animated elements cause false diffs
- **`networkidle` wait is required** — lazy-loaded images won't appear without it
- **`testName` must be unique across the entire test suite** — it's the primary key in `results.json`
- **`deviceScaleFactor: 1` must never change** — retina (2x) screenshots double the pixel dimensions and break the diff
- **Do not import from `dashboard`** — dependency only flows core → playwright and core → dashboard
- **`figmaNodes.ts` is the source of truth for Figma node ID mappings** — update it when adding new tests
