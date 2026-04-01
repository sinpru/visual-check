# AGENTS.md — visual-check/dashboard

> Read the root `AGENTS.md` first for monorepo-wide context.
> This file covers the `@visual-check/dashboard` package only.

---

## Package Purpose

The dashboard is a Next.js 16 app that reads `results.json` and local PNG snapshots
produced by `core` and `playwright`, and presents them in a Percy-style UI where reviewers
can inspect visual diffs across builds, approve baselines, or reject changes.

The core UX model mirrors Percy: **every Playwright test run creates a Build**. Reviewers
open a build, see all snapshots that changed, and approve or reject them. Approved snapshots
become the new baseline for the next build.

**Owner:** Đức Thái

---

## Tech Stack

| Tool                     | Version          | Notes                                  |
| ------------------------ | ---------------- | -------------------------------------- |
| Next.js                  | 16.2.1           | App Router, Server Components          |
| React                    | 19.2.4           | —                                      |
| TypeScript               | via root devDeps | strict mode                            |
| Tailwind CSS             | ^4.0.0           | via `@tailwindcss/postcss`             |
| shadcn/ui                | ^4.1.1           | component library                      |
| Base UI                  | ^1.3.0           | headless primitives (`@base-ui/react`) |
| lucide-react             | ^1.7.0           | icons                                  |
| clsx + tailwind-merge    | latest           | className utilities                    |
| class-variance-authority | ^0.7.1           | variant-based component styling        |

> Use `cn()` (clsx + tailwind-merge) for all className merging. Never use template literals
> for conditional classes.

---

## Folder Structure

```
visual-check/dashboard/
├── AGENTS.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── app/
│   ├── layout.tsx                      ← root layout, sidebar nav
│   ├── page.tsx                        ← redirects to /builds
│   ├── builds/
│   │   ├── page.tsx                    ← build list (/)
│   │   └── [buildId]/
│   │       ├── page.tsx                ← build overview — all snapshots in this build
│   │       └── [testName]/
│   │           └── page.tsx            ← single snapshot diff viewer
│   └── api/
│       ├── builds/
│       │   └── route.ts                ← GET /api/builds
│       ├── results/
│       │   └── route.ts                ← GET /api/results?buildId=...
│       ├── image/
│       │   └── route.ts                ← GET /api/image?path=...
│       ├── approve/
│       │   └── route.ts                ← POST /api/approve { testName, buildId }
│       ├── approve-all/
│       │   └── route.ts                ← POST /api/approve-all { buildId }
│       └── reject/
│           └── route.ts                ← POST /api/reject { testName, buildId }
├── components/
│   ├── BuildList.tsx                   ← list of all builds with summary stats
│   ├── BuildHeader.tsx                 ← build metadata + approve-all button
│   ├── SnapshotGrid.tsx                ← grid of all snapshots in a build
│   ├── SnapshotCard.tsx                ← thumbnail card with status badge
│   ├── DiffViewer.tsx                  ← side-by-side + overlay diff UI
│   ├── StatusBadge.tsx                 ← colored badge for pass/fail/pending etc.
│   └── ApproveRejectBar.tsx            ← approve/reject buttons with confirm dialog
└── lib/
    ├── cn.ts                           ← clsx + tailwind-merge utility
    └── format.ts                       ← date formatting, diff % formatting helpers
```

---

## Build Model (Percy-Style)

This is the central concept of the dashboard. A **Build** represents one full Playwright
test run. Every time `playwright` runs, it creates a new build entry in `builds.json`
(managed by `core`) and all snapshot results for that run are tagged with that `buildId`.

### Build lifecycle

```
playwright run starts
      ↓
core.createBuild()  →  writes new entry to builds.json  →  returns buildId
      ↓
each test runs  →  core.writeResult({ ...entry, buildId })
      ↓
playwright run ends
      ↓
core.finalizeBuild(buildId)  →  sets build status to 'failed' | 'passed' | 'unreviewed'
```

### Build statuses

| Status       | Meaning                                                          |
| ------------ | ---------------------------------------------------------------- |
| `unreviewed` | At least one snapshot is `fail` or `pending`, no review done yet |
| `approved`   | All changed snapshots have been approved by a reviewer           |
| `failed`     | At least one snapshot was rejected                               |
| `passed`     | All snapshots are `pass` — no visual changes detected            |

### `builds.json` schema (owned by `core`, read by dashboard)

```json
[
	{
		"buildId": "build_1712001120000",
		"createdAt": "2025-04-01T08:32:00.000Z",
		"finishedAt": "2025-04-01T08:34:12.000Z",
		"status": "unreviewed",
		"totalSnapshots": 12,
		"changedSnapshots": 3,
		"passedSnapshots": 9,
		"branch": "feat/homepage-redesign",
		"commitHash": "a3f9c12"
	}
]
```

> `buildId` format: `build_{Date.now()}` — generated by `core.createBuild()`.
> `branch` and `commitHash` are optional — populated from `GIT_BRANCH` and `GIT_COMMIT`
> env vars if available (set these in CI).

---

## `results.json` Schema (per build)

Each snapshot result is tagged with a `buildId`. The full schema is defined in the root
`AGENTS.md` — do not redefine it here. The dashboard always filters results by `buildId`.

```json
[
	{
		"testName": "homepage-hero",
		"buildId": "build_1712001120000",
		"status": "fail",
		"diffPercent": 3.42,
		"diffPixels": 8821,
		"baselinePath": "snapshots/baselines/homepage-hero.png",
		"currentPath": "snapshots/current/build_1712001120000/homepage-hero.png",
		"diffPath": "snapshots/diffs/build_1712001120000/homepage-hero.png",
		"viewport": { "width": 1440, "height": 900 },
		"timestamp": "2025-04-01T08:32:00.000Z"
	}
]
```

> `current` and `diff` PNGs live in per-build subdirectories so older builds remain
> viewable. Baselines are shared across builds — they are the approved ground truth.

---

## API Routes

### `GET /api/builds`

- Calls `core.readBuilds()`
- Returns `builds.json` array sorted by `createdAt` descending
- Response: `Build[]`

### `GET /api/results?buildId={buildId}`

- Calls `core.readResults()`, filters by `buildId`
- Returns all snapshot results for that build
- Response: `SnapshotResult[]`

### `GET /api/image?path=snapshots/diffs/build_xxx/homepage-hero.png`

- Resolves the path with `path.resolve` and validates it starts with
  `path.resolve(process.env.SNAPSHOTS_DIR)` — return 400 if not (path traversal prevention)
- Reads with `fs.readFileSync`
- Returns PNG with `Content-Type: image/png`
- Returns 404 with `{ error: 'not found' }` if file doesn't exist

### `POST /api/approve` — body: `{ testName: string, buildId: string }`

1. `core.approveBaseline(testName, buildId)` — copies `current/{buildId}/testName.png` → `baselines/testName.png`, deletes diff
2. `core.updateStatus(testName, buildId, 'approved')`
3. `core.recalculateBuildStatus(buildId)` — recomputes and writes updated build status
4. Returns `{ ok: true, buildStatus: string }`

### `POST /api/approve-all` — body: `{ buildId: string }`

- Fetches all `fail` | `pending` results for the build
- Runs `core.approveBaseline` + `core.updateStatus` for each sequentially
- Calls `core.recalculateBuildStatus(buildId)` once at the end
- Returns `{ ok: true, approved: number }`

### `POST /api/reject` — body: `{ testName: string, buildId: string }`

1. `core.updateStatus(testName, buildId, 'rejected')`
2. `core.recalculateBuildStatus(buildId)`
3. Returns `{ ok: true, buildStatus: string }`

---

## Pages

### `/builds` — Build List

Percy-style list of all Playwright runs.

| Column            | Notes                                             |
| ----------------- | ------------------------------------------------- |
| Build ID / branch | Links to `/builds/{buildId}`                      |
| Status badge      | `unreviewed` / `approved` / `failed` / `passed`   |
| Changed           | Count of `fail` + `pending` snapshots             |
| Total             | Total snapshot count                              |
| Created at        | Relative time ("2 hours ago") via `lib/format.ts` |
| Commit            | Short hash, if available                          |

- Sort: newest first
- Empty state: `"No builds yet. Run your Playwright tests to create the first build."`

### `/builds/[buildId]` — Build Overview

All snapshots for a single build. Percy-style grid.

**`BuildHeader` (top of page):**

- Build ID, branch, commit hash, created/finished timestamps
- Overall build status badge
- Summary line: `{changedSnapshots} changed · {passedSnapshots} passed · {totalSnapshots} total`
- "Approve all changes" button — shown only when status is `unreviewed`; triggers
  `POST /api/approve-all` then refreshes the page

**`SnapshotGrid` (main content):**

- Filter tabs: `All` | `Changed` | `Passed` — default to `Changed`
- Responsive grid: 3 columns ≥1280px, 2 columns ≥768px, 1 column below
- Each cell is a `SnapshotCard` linking to `/builds/{buildId}/{testName}`

### `/builds/[buildId]/[testName]` — Snapshot Diff Viewer

Full diff view for one snapshot in a build.

**Main panel:**

- Three-column CSS grid: **Baseline | Current | Diff**
- Each column: label (`text-sm text-muted-foreground`), image via `/api/image?path=...`,
  image dimensions shown below
- Diff column: pixel count + diff % shown below the image
- **Overlay toggle** below panels: switches to single-image view with the diff image
  absolutely positioned over current at user-controlled opacity (shadcn Slider or
  `@base-ui/react` Slider for the range)

**Keyboard shortcuts** (attach to `window` in a `useEffect`):

- `a` → approve current snapshot
- `r` → reject current snapshot
- `←` → previous snapshot in build
- `→` → next snapshot in build

**`ApproveRejectBar` (bottom bar):**

- Visible only when status is `fail` or `pending`
- Approve: `@base-ui/react` Dialog confirm → `POST /api/approve` → navigate to next
  unreviewed snapshot or back to `/builds/{buildId}` if none remain
- Reject: direct → `POST /api/reject` → same navigation logic

---

## Components

### `BuildList`

- Props: `{ builds: Build[] }`
- Uses shadcn `Table` component
- `StatusBadge` in the status column

### `BuildHeader`

- Props: `{ build: Build; onApproveAll: () => Promise<void> }`
- "Approve all" shows a shadcn `Button` with a loading spinner (`lucide-react` `Loader2`)
  during the in-flight request

### `SnapshotGrid`

- Props: `{ results: SnapshotResult[]; buildId: string }`
- Filter tabs: `@base-ui/react` Tabs primitive
- Passes filtered results to `SnapshotCard` grid

### `SnapshotCard`

- Props: `{ result: SnapshotResult; buildId: string }`
- Thumbnail image: `diffPath` for `fail`/`pending`, `currentPath` for `pass`/`approved`
- `StatusBadge` absolutely positioned top-right
- Diff % shown at card bottom for non-passing snapshots
- Links to `/builds/{buildId}/{testName}`

### `DiffViewer`

- Props: `{ baseline: string; current: string; diff?: string; diffPercent: number; diffPixels: number }`
- `diff` is optional — omit the diff panel gracefully when undefined (pass status)
- Overlay mode: `position: relative` on current image container, `position: absolute`
  diff image on top, `opacity` driven by slider state

### `StatusBadge`

- Props: `{ status: string }`
- Built with `cva()` — all variants defined in the component file

| Status       | Color |
| ------------ | ----- |
| `pass`       | green |
| `fail`       | red   |
| `pending`    | amber |
| `approved`   | blue  |
| `rejected`   | gray  |
| `unreviewed` | amber |

### `ApproveRejectBar`

- Props: `{ testName: string; buildId: string; status: string; nextSnapshot?: string }`
- Approve confirm dialog: `@base-ui/react` Dialog (not shadcn AlertDialog — Base UI is
  already in deps, prefer it for headless control)
- Optimistic UI: set status locally before fetch, revert on error
- Hidden when status is `approved`, `pass`, or `rejected`

---

## Data Fetching Pattern

Server Components for initial data load. Client Components only for mutations and
interactive state.

```tsx
// app/builds/page.tsx — server component
import { readBuilds } from '@visual-check/core';

export default async function BuildsPage() {
	const builds = await readBuilds();
	return <BuildList builds={builds} />;
}
```

```tsx
// app/builds/[buildId]/page.tsx — server component
import { readResults } from '@visual-check/core';

type Props = { params: Promise<{ buildId: string }> };

export default async function BuildPage({ params }: Props) {
	const { buildId } = await params;
	const results = await readResults(buildId);
	return <SnapshotGrid results={results} buildId={buildId} />;
}
```

```tsx
// ApproveRejectBar.tsx — client component
'use client';
import { useRouter } from 'next/navigation';

async function handleApprove() {
	setPrevStatus(status);
	setStatus('approved'); // optimistic
	const res = await fetch('/api/approve', {
		method: 'POST',
		body: JSON.stringify({ testName, buildId }),
		headers: { 'Content-Type': 'application/json' },
	});
	if (!res.ok) {
		setStatus(prevStatus); // revert
	} else {
		router.push(nextSnapshot ?? `/builds/${buildId}`);
	}
}
```

---

## Styling Conventions

- **Tailwind v4** — use `@import "tailwindcss"` in CSS, not `@tailwind base/components/utilities`
- **`cn()` for all className merging** — import from `@/lib/cn`
- **`cva()` for variant components** — variants defined in the component file, never a
  separate `variants.ts`
- **shadcn/ui** — prefer for tables, buttons, dialogs, sliders. Add with
  `pnpm dlx shadcn add {component}` — never copy-paste component source manually
- **`@base-ui/react`** — use for headless primitives not covered by shadcn (tabs, overlays)
- **No inline styles** — Tailwind classes only
- **Dark mode** — Tailwind `dark:` variants throughout; CSS variables via shadcn theme

---

## `lib/cn.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
```

---

## `lib/format.ts`

```ts
export function relativeTime(date: string): string {
	const diff = Date.now() - new Date(date).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

export function formatDiffPercent(n: number): string {
	return `${n.toFixed(2)}%`;
}
```

---

## Environment Variables

```env
SNAPSHOTS_DIR=../snapshots    # must match core and playwright
GIT_BRANCH=feat/homepage      # optional, set in CI
GIT_COMMIT=a3f9c12            # optional, set in CI
```

---

## What AI Agents Should Know

- **Build model is the core UX** — every page is scoped under a `buildId`. Never render
  results without build context.
- **`readBuilds()` and `readResults(buildId)` come from `@visual-check/core`** — do not
  re-implement file I/O in the dashboard
- **`/api/image` path validation is security-critical** — always use `path.resolve` and
  verify the resolved path starts with `path.resolve(SNAPSHOTS_DIR)` before reading
- **Approve is three operations in order**: `approveBaseline` → `updateStatus` →
  `recalculateBuildStatus` — abort on first failure, do not call the next step
- **Approve-all must be sequential, not parallel** — `Promise.all` on file operations risks
  corrupting `results.json`; use a `for...of` loop
- **Optimistic UI is required for approve/reject** — these feel slow without it; update
  state immediately and revert on error
- **After approving/rejecting, navigate to the next unreviewed snapshot** — this is the
  core reviewer workflow loop, same as Percy
- **`diff` image does not exist for `pass` status** — `DiffViewer` and `SnapshotCard` must
  handle `diff` being undefined
- **Do not import from `@visual-check/playwright`** — dashboard depends only on `core`
- **Tailwind v4 uses `@import "tailwindcss"` not the old directives**
- **shadcn components are added via CLI** — `pnpm dlx shadcn add button`, etc.
- **`lucide-react` v1.7.0** — verify icon names exist in this version; the API changed
  significantly between v0.x and v1.x
- **Next.js 16 App Router `params` are Promises** — always `await params` before
  destructuring in Server Components: `const { buildId } = await params`
