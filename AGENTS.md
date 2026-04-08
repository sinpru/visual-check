# AGENTS.md — visual-check (root)

> This file provides AI agents (Claude Code, Cursor, Gemini) with a full overview
> of the monorepo. Always read this file first before touching any package.

---

## What This Project Is

`visual-check` is a self-hosted visual regression testing tool inspired by Percy (BrowserStack).
It captures screenshots of a live app via Playwright, fetches the design baseline from Figma,
diffs them pixel-by-pixel, and presents results in a Next.js dashboard where reviewers can
approve or reject visual changes.

---

## Monorepo Structure

```
visual-check/
├── AGENTS.md                  ← you are here
├── package.json               ← npm workspaces root
├── .env                       ← shared environment variables (never commit)
├── .env.example               ← committed example env file
├── core/                      ← Person 1: Figma API, pixelmatch diffing, local storage
│   └── AGENTS.md
├── playwright/                ← Person 2: Playwright test runner, screenshot capture
│   └── AGENTS.md
└── dashboard/                 ← Person 3: Next.js app, diff viewer, approve/reject UI
    └── AGENTS.md
```

---

## Package Responsibilities

| Package                    | Owner    | Responsibility                                                                                                               |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@visual-check/core`       | Person 1 | Figma API calls, scale math, sharp normalization, pixelmatch diff engine, local file storage, `results.json` manifest writer |
| `@visual-check/playwright` | Person 2 | Playwright config, screenshot capture, viewport locking, animation suppression, wires into core                              |
| `@visual-check/dashboard`  | Person 3 | Next.js app, API routes serving local PNGs, diff viewer UI, approve/reject actions                                           |

---

## Shared Environment Variables

Defined in `.env` at the root. Each package reads from this via `dotenv`.

```env
# Figma
FIGMA_TOKEN=your_figma_personal_access_token
FIGMA_FILE_KEY=your_figma_file_key

# Snapshot storage (absolute path or relative to repo root)
SNAPSHOTS_DIR=./snapshots

# Diff threshold (0.0 to 1.0, default 0.1)
DIFF_THRESHOLD=0.1

# Dashboard
NEXT_PUBLIC_SNAPSHOTS_BASE=/api/image
```

---

## Snapshot Directory Layout

All three packages read/write to a shared local directory defined by `SNAPSHOTS_DIR`.

```
snapshots/
├── baselines/       ← approved Figma exports, ground truth
│   └── {testName}.png
├── current/         ← latest Playwright screenshots
│   └── {testName}.png
├── diffs/           ← pixelmatch output images
│   └── {testName}.png
└── results.json     ← manifest read by the dashboard
```

---

## results.json Schema

This is the data contract between `core`, `playwright`, and `dashboard`.
**Do not change this schema without updating all three packages.**

```json
[
	{
		"testName": "homepage-hero",
		"status": "fail",
		"diffPercent": 3.42,
		"diffPixels": 8821,
		"baselinePath": "snapshots/baselines/homepage-hero.png",
		"currentPath": "snapshots/current/homepage-hero.png",
		"diffPath": "snapshots/diffs/homepage-hero.png",
		"viewport": { "width": 1440, "height": 900 },
		"timestamp": "2025-04-01T08:32:00.000Z"
	}
]
```

**Status values:** `pass` | `fail` | `pending` | `approved` | `rejected`

---

## Workspace Setup

```bash
# Install all packages from root
npm install

# Run a specific package script
npm run dev --workspace=dashboard
npm run test --workspace=playwright

# Add a dependency to a specific package
npm install sharp --workspace=core
```

---

## Global Conventions

- **Node version:** 20+ (LTS)
- **Package manager:** pnpm workspaces
- **Language:** TypeScript
- **Formatting:** Prettier, config at root `.prettierrc`
- **Strict typing** — all files must be TypeScript (`.ts`, `.tsx`)
- **No test framework in `core`** — pure functions only, tested via Playwright integration
- **Commits:** conventional commits — `feat:`, `fix:`, `chore:`, `test:`

---

## Inter-Package Imports

```ts
// In playwright package — importing from core
import { runDiff, writeResult } from '@visual-check/core';

// In dashboard API route — reading from core's storage helpers
import { readResults, approveBaseline } from '@visual-check/core';
```

---

## What AI Agents Should Know

- **Never hardcode the SNAPSHOTS_DIR path** — always read from `process.env.SNAPSHOTS_DIR`
- **Never commit `.env`** — only `.env.example`
- **The Figma images endpoint returns a CDN URL, not raw bytes** — a second fetch is always required
- **pixelmatch requires identical image dimensions** — always normalize with `sharp` before diffing
- **Playwright viewport and Figma frame dimensions must match exactly** — 1440×900 is the agreed default
- **`results.json` is append-on-run, not overwrite** — a new test run updates existing entries by `testName`
