# AGENTS.md — visual-check (Monorepo Root)

> Master context file for the entire `visual-check` monorepo.
> Read this before touching any code. Reflects state as of early May 2026.
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
    - **Session Capture:** Dashboard can launch a browser for the user to log in and save session state (`auth.json`) for Playwright to use.
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
│       ├── projects.ts          ← projects.json manifest
│       ├── ai-reasoning.ts      ← OpenAI/Gemini vision API wrappers + region cropping
│       ├── cache.ts             ← file-based SHA256 caching for snapshots
│       └── logger.ts            ← namespaced logger (console + file under snapshots/logs)
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
│       │       ├── auth/
│       │       │   └── save/
│       │       │       └── route.ts             ← POST — launches browser for session capture
│       │       ├── auth-status/
│       │       │   └── route.ts                 ← GET — checks if snapshots/auth.json exists
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
│       │   ├── ProjectList.tsx              ← List of projects with stats and status
│       │   ├── BuildList.tsx
│       │   ├── BuildHeader.tsx
│       │   ├── SnapshotGrid.tsx
│       │   ├── SnapshotCard.tsx
│       │   ├── DiffViewer.tsx               ← Side-by-side viewer with SVG region pins
│       │   ├── DiffViewerPage.tsx           ← 'use client' wrapper: two-column layout + inspection panel + AI button
│       │   ├── StatusBadge.tsx
│       │   ├── ApproveRejectBar.tsx
│       │   ├── CreateProjectModal.tsx
│       │   ├── FigmaSnapshotModal.tsx       ← Two-step Figma frame picker (used in project page)
│       │   ├── RunPlaywrightModal.tsx       ← Launch tests + session capture UI
│       │   ├── AppSidebar.tsx               ← Icon-only navigation
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
│   │   ├── saveAuth.ts          ← CLI helper for manual session capture
│   │   └── figmaNodes.ts        ← testName → Figma nodeId mapping (used for UPDATE_BASELINE only)
│   └── tests/
│       └── visual.ts            ← primary visual test suite
│
└── snapshots/                   ← runtime data (gitignored)
    ├── projects.json
    ├── builds.json
    ├── results.json
    ├── auth.json                ← Playwright session state
    ├── logs/                    ← per-build log files
    ├── cache/                   ← image/data cache
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

# AI analysis (OpenAI-compatible or Google Gemini)
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
AI_API_URL=https://api.openai.com/v1/chat/completions   # or https://generativelanguage.googleapis.com/v1beta
AI_MODEL=gpt-4o                                          # or gemini-1.5-pro

# Logging
LOG_LEVEL=INFO   # DEBUG | INFO | WARN | ERROR
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
				"aiDescription": "The heading font weight appears lighter in the web implementation...",
				"figmaMetrics": { "fontSize": 32, "fontWeight": 400, "color": "#2482FF" },
				"domMetrics": { "fontSize": 32, "fontWeight": 300, "color": "#2482FF" }
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

**`findFigmaNodeForRegion(tree, region)`** — walks the node tree, returns the deepest non-excluded node whose `absoluteBoundingBox` overlaps the region in frame-relative pixel space. Returns `{ name, type, id } | null`.

### `ai-reasoning.ts`

**`generateRegionDescription(result, regionIndex, figmaPath, webPath)`**
- Crops both images to the region's bounding box (+ padding).
- Calls the AI Vision API (GPT-4o or Gemini).
- Provides a natural language explanation of the visual mismatch based on metrics.

### `logger.ts`

Standardized logger used across the project.
- **Console:** Colored output.
- **File:** Appends to `snapshots/logs/{BUILD_ID}.log`.
- Usage: `import { logger } from './logger.ts'; const log = logger.child('namespace'); log.info('message');`

### `cache.ts`

Simple file-based SHA256 caching for expensive operations.

### `storage.ts`

**`saveFigmaNodeTree(testName, tree)`** → writes `snapshots/baselines/{testName}.figma.json`
**`loadFigmaNodeTree(testName)`** → reads it back, returns null if missing

### `results.ts`

**`writeResult(entry)`** — upserts by `testName + buildId` composite key.
**`updateRegionAnalysis(testName, buildId, regionIndex, description)`** — updates `diffRegions[i].aiDescription` atomically. Called by `/api/analyze-region` after AI returns.

### `diff.ts`

**`runDiff(baseline, current, diffOutputPath, threshold?)`** — returns `DiffResult` including `regions: DiffRegion[]`.

---

## Playwright — `visualTest.ts` Pipeline

```
1.  getOrCreateBuild(buildId, { projectId, branch: 'web' })
2.  load auth.json if exists
3.  addStyleTag: animation/transition none, hide layout banner
4.  window.scrollTo(0, 0)
5.  waitForLoadState('networkidle')
6.  captureScreenshot (full page / selector / clip)
7.  saveSnapshot(testName, buffer, 'current', buildId)
8.  [UPDATE_BASELINE=true] → save Figma or current as baseline → writeResult pending → STOP
9.  [no baseline] → save current as baseline → writeResult pending → STOP
10. runDiff(figmaBaseline, webScreenshot, paths.diff) → DiffResult with regions[]
11. annotateDomLabels() — page.evaluate elementFromPoint + getComputedStyle for each region center → domLabel + domMetrics
12. annotateFigmaLabels() — loadFigmaNodeTree + findFigmaNodeForRegion → figmaLabel + figmaMetrics
13. writeResult({ ...entry, diffRegions }) — NOTE the path swap (see above)
14. recalculateBuildStatus(buildId, readResults())
```

---

## Dashboard — DiffViewer Architecture

### `DiffViewerPage.tsx` (`'use client'` — owns state)

- Renders two-column layout: `DiffViewer` (left, fills space) + inspection panel (right, `w-72`, fixed)
- Inspection panel region list uses **Figma name as primary label**, DOM selector as secondary
- "Analyze with AI" button per region — calls `POST /api/analyze-region`, result persisted + shown immediately

### `/api/auth/save` route

- `action: 'start'` → Launches Playwright browser (non-headless) for user login.
- `action: 'confirm'` → Saves `context.storageState()` to `snapshots/auth.json`.
- `action: 'cancel'` → Closes browser without saving.

---

## Pending Work — Roadmap

### 1. Multiple viewport support ✅ IN PROGRESS
### 2. Annotated diff regions ✅ DONE
### 3. Component-level matching 🚧 TODO
### 4. Sub-pixel / resolution robustness 🚧 TODO
### 5. AI provider — Gemini support ✅ DONE
