# AGENTS.md — visual-check/dashboard

> Read the root `AGENTS.md` first for monorepo-wide context.
> This file covers the `@visual-check/dashboard` package only.

---

## Package Purpose

The dashboard is a Next.js app that reads `results.json` and local PNG snapshots
produced by `core` and `playwright`, and presents them in a UI where reviewers can
inspect visual diffs, approve baselines, or reject changes.

**Owner:** Person 3

---

## Folder Structure

```
visual-check/dashboard/
├── AGENTS.md
├── package.json
├── next.config.ts
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        ← test run list (/)
│   └── test/
│       └── [testName]/
│           └── page.tsx                ← diff viewer (/test/homepage-hero)
├── components/
│   ├── TestTable.tsx                   ← sortable list of all test results
│   ├── DiffViewer.tsx                  ← side-by-side + overlay diff UI
│   ├── StatusBadge.tsx                 ← colored badge for pass/fail/pending etc.
│   └── ApproveRejectBar.tsx            ← approve/reject buttons with confirm dialog
└── app/api/
    ├── results/
    │   └── route.ts                   ← GET /api/results
    ├── image/
    │   └── route.ts                   ← GET /api/image?path=...
    └── approve/
        └── route.ts                   ← POST /api/approve { testName }
    └── reject/
        └── route.ts                   ← POST /api/reject { testName }
```

---

## API Routes

### `GET /api/results`
- Calls `core.readResults()` 
- Returns the full `results.json` array as JSON
- No auth — this is a local-only tool

### `GET /api/image?path=snapshots/diffs/homepage-hero.png`
- Validates the path starts with `process.env.SNAPSHOTS_DIR` — reject anything else (path traversal prevention)
- Reads the file with `fs.readFileSync`
- Returns the PNG with `Content-Type: image/png`
- Returns 404 if file doesn't exist

### `POST /api/approve` — body: `{ testName: string }`
- Calls `core.approveBaseline(testName)` — copies current → baseline, deletes diff
- Calls `core.updateStatus(testName, 'approved')`
- Returns `{ ok: true }`

### `POST /api/reject` — body: `{ testName: string }`
- Calls `core.updateStatus(testName, 'rejected')`
- Does NOT delete any files — rejected state is informational only
- Returns `{ ok: true }`

---

## Pages

### `/` — Test Run List
Displays all entries from `results.json` in a table:

| Column | Notes |
|---|---|
| Test name | Clickable → goes to `/test/{testName}` |
| Status badge | Color-coded — see StatusBadge below |
| Diff % | Formatted to 2 decimal places |
| Viewport | e.g. `1440×900` |
| Timestamp | Relative time (e.g. "3 min ago") |

Sort by: status (failures first), then timestamp descending.

### `/test/[testName]` — Diff Viewer
Three-panel layout: **Baseline | Current | Diff**

- Each panel has a label and an `<img>` sourced from `/api/image?path=...`
- All three images render at the same CSS width (use CSS grid, `1fr 1fr 1fr`)
- Below the panels: an **overlay toggle** — switches to a single image view where the diff is overlaid on the current screenshot at adjustable opacity (range input 0–100%)
- Bottom bar: `ApproveRejectBar` (visible only when status is `fail` or `pending`)

---

## Components

### `StatusBadge`
Renders a pill badge based on status string.

| Status | Color |
|---|---|
| `pass` | Green |
| `fail` | Red |
| `pending` | Amber |
| `approved` | Teal/Blue |
| `rejected` | Gray |

### `DiffViewer`
- Props: `{ testName, baselinePath, currentPath, diffPath }`
- Fetches image URLs as `/api/image?path={path}`
- Manages overlay toggle state internally
- On overlay mode: uses CSS `mix-blend-mode: difference` or a canvas composite approach

### `ApproveRejectBar`
- Props: `{ testName, status, onApprove, onReject }`
- Approve button: shows a confirm dialog before calling `POST /api/approve`
- Reject button: calls `POST /api/reject` directly (no confirm needed)
- Optimistic UI: update local state immediately, revert on API error
- Hidden when `status` is `'approved'` or `'pass'`

---

## Data Fetching Pattern

Use Next.js Server Components for the list page (reads `results.json` directly on the server).
Use client-side fetch for approve/reject mutations.

```tsx
// app/page.tsx — server component
import { readResults } from '@visual-check/core'

export default async function HomePage() {
  const results = await readResults()
  return <TestTable results={results} />
}
```

```tsx
// Approve mutation — client component
async function handleApprove(testName: string) {
  setStatus('approved') // optimistic
  const res = await fetch('/api/approve', {
    method: 'POST',
    body: JSON.stringify({ testName }),
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) setStatus(previousStatus) // revert on error
}
```

---

## Environment Variables

```env
SNAPSHOTS_DIR=../../snapshots    # must match the path used by playwright and core
```

---

## Dependencies

```json
{
  "dependencies": {
    "@visual-check/core": "*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "dotenv": "^16.0.0"
  }
}
```

---

## What AI Agents Should Know

- **Always validate the `path` query param in `/api/image`** — must be within `SNAPSHOTS_DIR`, never allow arbitrary filesystem reads
- **`readResults()` from core can return `[]`** — always handle the empty state in the UI with a friendly message
- **Images are served via `/api/image`** — never expose the raw filesystem path to the client directly
- **Approve flow is two operations: `approveBaseline` + `updateStatus`** — both must succeed; if `approveBaseline` throws, do not call `updateStatus`
- **Do not import from `playwright`** — dashboard only depends on `core`
- **The diff viewer must handle missing images gracefully** — a diff PNG won't exist for `pass` status tests
- **Overlay mode is a nice-to-have** — implement side-by-side first, overlay second
- **No auth is required** — this dashboard is intended for local and internal CI use only
