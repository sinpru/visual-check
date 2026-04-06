# AGENTS.md — visual-check (Monorepo Root)

> Master context file for the entire `visual-check` monorepo.
> Read this before touching any code. Reflects state as of late April 2026.
> Supersedes all previous AGENTS.md versions.

---

## Project Overview

`visual-check` is a Percy-style visual regression testing tool built in-house.
It captures Figma design frames as baselines, takes Playwright screenshots of the live web app,
compares them pixel-by-pixel using `pixelmatch`, and presents diffs in a Next.js dashboard for review.

**The core UX loop:**

1. User creates a **Project**
2. Inside the project → **"Pull Figma baselines"** → two-step modal discovers all frames in the Figma file, user selects which ones → PNGs + node trees saved as baselines, Figma build created
3. **"Run tests"** → dashboard spawns `pnpm exec playwright test`, Playwright diffs each web screenshot against the saved Figma baseline, results written to `results.json`
4. User opens the build → clicks a changed snapshot → reviews side-by-side diff with numbered region pins → clicks a pin → sees Figma node name + DOM element in the inspection panel → optionally clicks **"Analyze with AI"** for a natural language description

**Hierarchy:** Project → Build → Snapshot/Result (three levels, always linked by ID)

---

## Monorepo Structure

```
visual-check/
├── AGENTS.md                    ← this file
├── .env                         ← single global env file (root level)
├── .env.example
├── .gitignore
├── package.json                 ← root workspace (pnpm)
├── pnpm-workspace.yaml
├── tsconfig.json                ← root tsconfig (extended by all packages)
│
├── core/                        ← @visual-check/core — shared pure functions
│   ├── AGENTS.md
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts             ← ALL shared types and error classes
│       ├── figma.ts             ← Figma REST API + node tree + region matching
│       ├── diff.ts              ← pixelmatch diffing + connected-component region extraction
│       ├── storage.ts           ← file I/O, path resolution, Figma node tree persistence
│       ├── results.ts           ← results.json manifest + updateRegionAnalysis
│       ├── builds.ts            ← builds.json manifest + getOrCreateBuild
│       └── projects.ts          ← projects.json manifest
│
├── dashboard/                   ← @visual-check/dashboard — Next.js 16 app
│   ├── AGENTS.md
│   ├── package.json
│   ├── next.config.ts           ← loads root .env via dotenv
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── page.tsx                         ← Homepage: project list + CreateProjectModal
│       │   ├── layout.tsx                       ← Root layout, icon-only sidebar
│       │   ├── globals.css
│       │   ├── projects/
│       │   │   └── [projectId]/
│       │   │       ├── page.tsx                 ← Project detail: builds list + action buttons
│       │   │       └── [buildId]/
│       │   │           ├── page.tsx             ← Build overview: snapshot grid
│       │   │           └── [testName]/
│       │   │               └── page.tsx         ← Diff viewer page ← PRIMARY ROUTE
│       │   ├── builds/                          ← Legacy route (all builds, no project scope)
│       │   │   ├── page.tsx
│       │   │   └── [buildId]/
│       │   │       ├── page.tsx
│       │   │       └── [testName]/
│       │   │           └── page.tsx
│       │   └── api/
│       │       ├── projects/
│       │       │   ├── route.ts                 ← GET + POST /api/projects
│       │       │   └── [projectId]/
│       │       │       └── run/
│       │       │           └── route.ts         ← POST — spawns Playwright, returns buildId
│       │       ├── figma-frames/
│       │       │   └── route.ts                 ← GET /api/figma-frames?fileKey=...
│       │       ├── figma-snapshot/
│       │       │   └── route.ts                 ← POST — pulls Figma frames + node trees, creates baseline build
│       │       ├── analyze-region/
│       │       │   └── route.ts                 ← POST — crops images, calls AI, persists description
│       │       ├── builds/
│       │       │   └── route.ts
│       │       ├── results/
│       │       │   └── route.ts
│       │       ├── image/
│       │       │   └── route.ts                 ← GET /api/image?path=... (path-traversal guarded)
│       │       ├── approve/
│       │       │   └── route.ts
│       │       ├── approve-all/
│       │       │   └── route.ts
│       │       └── reject/
│       │           └── route.ts
│       ├── components/
│       │   ├── BuildList.tsx
│       │   ├── BuildHeader.tsx
│       │   ├── SnapshotGrid.tsx
│       │   ├── SnapshotCard.tsx
│       │   ├── DiffViewer.tsx               ← Side-by-side viewer with SVG region pins
│       │   ├── DiffViewerPage.tsx           ← 'use client' wrapper: two-column layout + inspection panel + AI button
│       │   ├── StatusBadge.tsx
│       │   ├── ApproveRejectBar.tsx
│       │   ├── ProjectCard.tsx
│       │   ├── CreateProjectModal.tsx
│       │   ├── FigmaSnapshotModal.tsx       ← Two-step Figma frame picker (used in project page)
│       │   ├── RunPlaywrightButton.tsx      ← URL input modal + triggers /api/projects/[projectId]/run
│       │   ├── CompareDemoButton.tsx        ← Demo helper, /builds page only
│       │   └── ui/                          ← shadcn/ui components
│       └── lib/
│           ├── utils.ts                     ← cn() (clsx + tailwind-merge)
│           └── format.ts                    ← relativeTime(), formatDiffPercent()
│
├── playwright/                  ← @visual-check/playwright — test runner
│   ├── AGENTS.md
│   ├── package.json
│   ├── playwright.config.ts     ← viewport 1440×900, deviceScaleFactor 1, workers 1
│   ├── helpers/
│   │   ├── visualTest.ts        ← full pipeline: screenshot → diff → DOM labels → Figma labels → writeResult
│   │   └── figmaNodes.ts        ← testName → Figma nodeId mapping (used for UPDATE_BASELINE only)
│   └── tests/
│       └── *.visual.ts          ← individual visual test files
│
└── snapshots/                   ← runtime data (gitignored)
    ├── projects.json
    ├── builds.json
    ├── results.json
    ├── baselines/
    │   ├── {testName}.png       ← Figma-sourced ground truth PNG
    │   └── {testName}.figma.json ← Figma node document tree (for region label matching)
    ├── current/
    │   └── {buildId}/
    │       └── {testName}.png   ← Playwright web screenshot
    └── diffs/
        └── {buildId}/
            └── {testName}.png   ← pixelmatch diff output
```

---

## Environment Variables (single root `.env`)

```env
# Figma
FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxx
FIGMA_FILE_KEY=ABCDEF1234567890

# Snapshot storage — resolves to repo root's snapshots/ folder
SNAPSHOTS_DIR=./snapshots

# Diff threshold (0.0–1.0). Default: 0.1
DIFF_THRESHOLD=0.1

# Dashboard (Next.js)
NEXT_PUBLIC_SNAPSHOTS_BASE=/api/image

# Playwright
BASE_URL=http://localhost:3000
UPDATE_BASELINE=false

# Set by /api/projects/[projectId]/run before spawning Playwright — do not set manually
BUILD_ID=build_1234567890
PROJECT_ID=project_1234567890

# AI analysis (OpenAI-compatible — works with OpenAI, corporate proxies, Groq, etc.)
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
AI_API_URL=https://api.openai.com/v1/chat/completions   # override for corporate proxy
AI_MODEL=gpt-4o                                          # override for corporate model name
# e.g. for STU corporate proxy:
#   AI_API_URL=https://aiportalapi.stu-platform.live/use
#   AI_MODEL=gpt-5-nano
#   AI_API_KEY=sk-...corporate-key...
# Anthropic/Claude requires a different API format — not currently supported without code changes
```

**`SNAPSHOTS_DIR` path resolution — always use `import.meta.url`:**

```ts
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
// core/src/file.ts → .. = core/ → .. = repo root ✓
// Never use process.cwd() — it changes depending on which package runs
```

`next.config.ts` loads the root `.env` explicitly:

```ts
dotenv.config({ path: path.resolve(__dirname, '../.env') });
```

---

## Data Model

### `projects.json`

```json
[
	{
		"projectId": "project_1712001120000",
		"name": "Homepage",
		"status": "active",
		"createdAt": "2026-04-01T08:00:00.000Z",
		"updatedAt": "2026-04-01T08:00:00.000Z"
	}
]
```

### `builds.json`

```json
[
	{
		"buildId": "build_1712001120000",
		"projectId": "project_1712001120000",
		"createdAt": "2026-04-01T08:32:00.000Z",
		"finishedAt": "2026-04-01T08:34:12.000Z",
		"status": "unreviewed",
		"totalSnapshots": 3,
		"changedSnapshots": 1,
		"passedSnapshots": 2,
		"branch": "web",
		"commitHash": "a3f9c12"
	}
]
```

`branch: 'figma'` = Figma baseline build (no diff, changedSnapshots: 0).
`branch: 'web'` = Playwright run.
`projectId` is required on all new builds. Old builds without it appear only in `/builds` (legacy).

### `results.json`

```json
[
	{
		"testName": "homepage-hero",
		"buildId": "build_1712001120000",
		"status": "fail",
		"diffPercent": 3.42,
		"diffPixels": 8821,
		"baselinePath": "current/build_xxx/homepage-hero.png",
		"currentPath": "baselines/homepage-hero.png",
		"diffPath": "diffs/build_xxx/homepage-hero.png",
		"viewport": { "width": 1440, "height": 900 },
		"timestamp": "2026-04-01T08:32:00.000Z",
		"diffRegions": [
			{
				"index": 0,
				"x": 158,
				"y": 308,
				"width": 1566,
				"height": 138,
				"diffPixels": 52330,
				"diffPercent": 2.84,
				"domLabel": "div.absolute.text-[#2482FF] — \"MedAdvisor for Pharmacy design system\"",
				"figmaLabel": "MedAdvisor for Pharmacy design system",
				"aiDescription": "The heading font weight appears lighter in the web implementation..."
			}
		]
	}
]
```

**PATH SWAP — THIS IS INTENTIONAL AND MUST NOT BE REVERTED:**

- `currentPath` in `ResultEntry` = **Figma PNG** → shown LEFT as "Baseline / Expected"
- `baselinePath` in `ResultEntry` = **web screenshot** → shown RIGHT as "Current / Actual" + diff overlay

This swap exists because the field names in the original schema were assigned before the Figma-first baseline model was agreed upon. The swap is documented here, in the code comments, and in `DiffViewer.tsx`.

### Hierarchy

```
Project (projects.json)
  └── Build (builds.json — projectId links back)
        └── Result/Snapshot (results.json — buildId links back)
              └── DiffRegion[] (embedded in ResultEntry.diffRegions)
```

---

## Core Package — Key Functions

### `figma.ts`

**`fetchFigmaBaselineWithTree(fileKey, nodeId, token, targetWidth, targetHeight)`**
The primary function to use when pulling Figma baselines. Makes exactly **2 Figma API calls**:

1. `GET /v1/files/{fileKey}/nodes?ids={nodeId}` → gets dimensions + full node tree (one call)
2. `GET /v1/images/{fileKey}?ids={nodeId}&format=png&scale={scale}` → CDN render URL
3. `fetch(cdnUrl)` → raw PNG bytes (**not a Figma API call**, hits CDN directly)

Returns `{ buffer: Buffer, tree: FigmaNodeDocument }`. Use this in `figma-snapshot/route.ts` — it replaces the old pattern of calling `fetchFigmaBaseline` + `fetchNodeTree` separately (which used 3 calls).

**`fetchFigmaBaseline()`** — kept for backward compat, returns Buffer only. Uses `fetchFigmaBaselineWithTree` internally.

**`fetchNodeTree()`** — returns `FigmaNodeDocument | null`. Returns null on error (graceful degradation).

**`findFigmaNodeForRegion(tree, region)`** — walks the node tree, returns the deepest non-excluded node whose `absoluteBoundingBox` overlaps the region in frame-relative pixel space. Returns `{ name, type, id } | null`.

**Figma rate limits — critical context:**

- Tier 1 endpoints (`/nodes`, `/images`) are heavily rate-limited on Starter/View-seat accounts
- Starter plan: as low as 2–6 requests/month on low-traffic endpoints
- 429 response with `Retry-After: ~400,000s` (~4.5 days) = Starter plan quota exhausted
- The code caps backoff at 30s — if `Retry-After > 60s`, it throws immediately rather than hanging
- **Always use `fetchFigmaBaselineWithTree` to minimize calls** — never call nodes endpoint twice for the same frame

### `storage.ts`

**`saveFigmaNodeTree(testName, tree)`** → writes `snapshots/baselines/{testName}.figma.json`
**`loadFigmaNodeTree(testName)`** → reads it back, returns null if missing

These are called at Figma baseline pull time (dashboard) and Playwright test time (core) respectively.

**`getPaths(testName, buildId?)`** returns:

```ts
{
  baseline: `${SNAPSHOTS_DIR}/baselines/${testName}.png`,
  current:  `${SNAPSHOTS_DIR}/current/${buildId}/${testName}.png`,
  diff:     `${SNAPSHOTS_DIR}/diffs/${buildId}/${testName}.png`,
}
```

### `results.ts`

**`writeResult(entry)`** — upserts by `testName + buildId` composite key.
**`updateRegionAnalysis(testName, buildId, regionIndex, description)`** — updates `diffRegions[i].aiDescription` atomically. Called by `/api/analyze-region` after AI returns.
**`readResults(buildId?)`** — if `buildId` passed, filters by it.

### `diff.ts`

**`runDiff(baseline, current, diffOutputPath, threshold?)`** — returns `DiffResult` including `regions: DiffRegion[]`.

Region extraction algorithm:

1. Detect red-ish pixels (R>200, G<180, B<180 — pixelmatch's default diff color)
2. Dilate mask by `MERGE_RADIUS=8px` — merges nearby scattered changes into one region
3. BFS flood-fill with index-based queue (not `array.shift()` — that's O(n))
4. Discard regions with <25 actual changed pixels (noise filter)
5. Sort largest-first, cap at 15 regions

### `builds.ts`

**`getOrCreateBuild(buildId, data)`** — idempotent. Call at start of every Playwright test. Safe to call N times in same run.
**`recalculateBuildStatus(buildId, results)`** — recomputes status from results array after every writeResult.

---

## Playwright — `visualTest.ts` Pipeline

```
1.  getOrCreateBuild(buildId, { projectId, branch: 'web' })
2.  addStyleTag: animation/transition none
3.  window.scrollTo(0, 0)
4.  waitForLoadState('networkidle')
5.  captureScreenshot (full page / selector / clip)
6.  saveSnapshot(testName, buffer, 'current', buildId)
7.  [UPDATE_BASELINE=true] → save Figma or current as baseline → writeResult pending → STOP
8.  [no baseline] → save current as baseline → writeResult pending → STOP
9.  runDiff(figmaBaseline, webScreenshot, paths.diff) → DiffResult with regions[]
10. annotateDomLabels() — page.evaluate elementFromPoint for each region center → domLabel
11. annotateFigmaLabels() — loadFigmaNodeTree + findFigmaNodeForRegion → figmaLabel (sync, no API call)
12. writeResult({ ...entry, diffRegions }) — NOTE the path swap (see above)
13. recalculateBuildStatus(buildId, readResults())
```

`BUILD_ID` and `PROJECT_ID` are set by `/api/projects/[projectId]/run` before spawning Playwright.

---

## Dashboard — DiffViewer Architecture

### `DiffViewer.tsx` (presentational)

- Three view modes: **Both** (side-by-side) | **Baseline** (left full-width) | **Current** (right full-width)
- `RegionOverlay` SVG uses `viewBox="0 0 {imageWidth} {imageHeight}"` + `preserveAspectRatio="xMidYMid meet"` — aligns pins with `object-contain` images with zero JS measurement
- Props: `onRegionSelect?: (region: DiffRegion | null) => void`, `activeRegionIndex?: number | null`
- When `onRegionSelect` is provided, the component is controlled by the parent

### `DiffViewerPage.tsx` (`'use client'` — owns state)

- Renders two-column layout: `DiffViewer` (left, fills space) + inspection panel (right, `w-72`, fixed)
- Inspection panel region list uses **Figma name as primary label**, DOM selector as secondary
- "Analyze with AI" button per region — calls `POST /api/analyze-region`, result persisted + shown immediately
- `localDescriptions` state merges with `region.aiDescription` from props — so descriptions survive without a page reload, and also come back from server on refresh

### `/api/analyze-region` route

- Receives `{ testName, buildId, regionIndex }`
- Loads result from `results.json`, finds the region
- Crops both images (Figma + web) to region bounding box + 16px padding using `sharp`
- Calls AI vision API (OpenAI-compatible format)
- Persists via `updateRegionAnalysis()`
- Returns `{ ok, description }`

**AI provider configuration** — all via env vars, no code changes needed to switch providers:

```env
AI_API_KEY=...
AI_API_URL=https://api.openai.com/v1/chat/completions  # any OpenAI-compatible URL
AI_MODEL=gpt-4o                                         # any model name the provider accepts
```

---

## Figma Integration — Frame Discovery

1. User pastes Figma file URL or file key in `FigmaSnapshotModal`
2. `GET /api/figma-frames?fileKey=xxx` — calls `GET /v1/files/{fileKey}`, walks document tree
3. Tree walker (mirrors Percy's exclusion logic):
    - **Eligible:** `FRAME`, `COMPONENT`, `INSTANCE`
    - **Excluded but recursed (max 3 levels):** `CANVAS`, `SECTION`, `COMPONENT_SET`, `RECTANGLE`, `VECTOR`, `GROUP`, `DOCUMENT`, `TEXT`, `LINE`
4. User sees checkbox list grouped by page, all pre-selected, with editable testNames
5. `POST /api/figma-snapshot` → for each frame: `fetchFigmaBaselineWithTree()` (2 API calls) → `saveSnapshot` + `saveFigmaNodeTree` → `writeResult`

---

## Pending Work — Roadmap

### 1. Multiple viewport support

Run same test at multiple preset viewports: 1920×1080, 1280×720, 1440×900, 768×1024, 390×844.

- `testName + viewport` composite key → `homepage@1920x1080`
- User configures active viewports per project

### 2. Annotated diff regions ✅ DONE

- Region extraction, DOM labels, Figma labels, AI descriptions — all implemented.
- **Remaining:** geometric delta (deltaX/Y shift calculation)

### 3. Component-level matching

When Figma frame = one component, web screenshot = full page — locate the component on the page.

- Priority 1: `figmaNodes.ts` maps nodeId → CSS selector for clip-based diff
- Priority 2: template matching (slide Figma image across web screenshot)
- Priority 3: AI embedding (deferred)

### 4. Sub-pixel / resolution robustness

- `includeAA: true` in pixelmatch to eliminate anti-aliasing false positives
- Runtime assertion: screenshot dimensions ≠ declared viewport → throw clearly

### 5. Click to enlarge (lightbox)

Full-screen image view when clicking either panel in DiffViewer. Not yet implemented.

### 6. AI provider — Claude/Anthropic support

Currently only OpenAI-compatible APIs are supported. Anthropic uses a different message format (`/v1/messages`, different role schema). Would require a provider abstraction layer in `analyze-region/route.ts`.

---

## Owner Map

| Package / Area                               | Owner      |
| -------------------------------------------- | ---------- |
| `core`                                       | Thanh Binh |
| `playwright`                                 | Person 2   |
| `dashboard`                                  | Đức Thái   |
| Figma integration, diff regions, AI analysis | Thanh Binh |
| DiffViewer UI, inspection panel              | Đức Thái   |

---

## What AI Agents Must Know — Non-Negotiables

**The path swap:**

- `currentPath` in `ResultEntry` = Figma PNG → LEFT panel "Baseline / Expected"
- `baselinePath` in `ResultEntry` = web screenshot → RIGHT panel "Current / Actual"
- **This is intentional. Do not revert it.**

**Data:**

- `writeResult` upserts by `testName + buildId` composite key — not just `testName`
- `approveBaseline` does NOT update `results.json` — caller must call `updateStatus` after
- Approve/reject ops are always sequential — `Promise.all` on file ops corrupts JSON
- All paths from `getSnapshotsDir()` or `getPaths()` — never hardcode

**Playwright:**

- `workers: 1` mandatory — concurrent writes corrupt `results.json`
- `deviceScaleFactor: 1` mandatory — retina doubles pixel dimensions and breaks diff
- `getOrCreateBuild` is idempotent — call at the start of every test
- `recalculateBuildStatus` after every `writeResult`

**Figma API:**

- Always use `fetchFigmaBaselineWithTree` — 2 API calls per frame, not 3
- Never call `/nodes` endpoint twice for the same node in one operation
- 429 with `Retry-After > 60s` = Starter plan quota exhausted (~4.5 day cooldown) — not a transient error
- Node tree saved as `{testName}.figma.json` alongside baseline PNG — load at diff time, no extra API call

**Dashboard:**

- `cn()` from `@/lib/utils` — NOT `@/lib/cn` (deleted)
- `lucide-react` v1.7.0 — `Figma` icon does not exist, use `ImagePlus`
- Next.js 16 `params` are Promises — always `await params`
- Tailwind v4 — `@import "tailwindcss"`, NOT `@tailwind` directives
- Primary route for diff viewer: `/projects/[projectId]/[buildId]/[testName]`
- `DiffViewerPage` requires `buildId` prop — `page.tsx` must pass it explicitly

**Architecture:**

- Dependency flows: `core` ← `playwright`, `core` ← `dashboard`. Never cross.
- `core` has no side effects on import — pure functions only
- `REPO_ROOT` from `import.meta.url` — never `process.cwd()`
