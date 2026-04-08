# AGENTS.md — visual-check/dashboard

> Read the root `AGENTS.md` first for monorepo-wide context.
> This file covers the `@visual-check/dashboard` package only.

---

## Package Purpose

The dashboard is a Next.js 16 app that manages **Projects** and **Builds**. It allows users to:
1. Create and manage projects linked to Figma files.
2. Pull Figma frames as visual baselines.
3. Launch Playwright test runs against local or remote environments.
4. Capture authenticated browser sessions (`auth.json`) for tests to use.
5. Review visual diffs with AI-powered analysis and region-level inspection.

**Owner:** Đức Thái

---

## Tech Stack

| Tool                     | Version          | Notes                                  |
| ------------------------ | ---------------- | -------------------------------------- |
| Next.js                  | 16.2.1           | App Router, Server Components          |
| React                    | 19.2.4           | —                                      |
| Tailwind CSS             | ^4.0.0           | via `@tailwindcss/postcss`             |
| shadcn/ui                | ^4.1.1           | component library                      |
| lucide-react             | ^1.7.0           | icons                                  |

---

## Folder Structure

```
visual-check/dashboard/
├── AGENTS.md
├── package.json
├── next.config.ts
├── app/
│   ├── layout.tsx                      ← root layout, sidebar nav
│   ├── page.tsx                        ← project list (homepage)
│   ├── projects/
│   │   └── [projectId]/
│   │       ├── page.tsx                ← project detail (build list)
│   │       └── [buildId]/
│   │           ├── page.tsx            ← build overview (snapshot grid)
│   │           └── [testName]/
│   │               └── page.tsx        ← diff viewer (PRIMARY ROUTE)
│   └── api/
│       ├── projects/                   ← project CRUD + run trigger
│       ├── auth/save/                  ← session capture launch
│       ├── auth-status/                ← check for auth.json
│       ├── figma-frames/               ← list frames in Figma file
│       ├── figma-snapshot/             ← pull Figma frames as baselines
│       ├── analyze-region/             ← trigger AI analysis
│       ├── builds/                     ← build manifest access
│       ├── results/                    ← result manifest access
│       └── image/                      ← secure image serving
├── components/
│   ├── ProjectList.tsx                 ← table of projects with summary stats
│   ├── CreateProjectModal.tsx          ← shadcn dialog for new projects
│   ├── FigmaSnapshotModal.tsx          ← two-step Figma frame picker
│   ├── RunPlaywrightModal.tsx          ← test runner UI + session capture toggle
│   ├── AppSidebar.tsx                  ← vertical navigation
│   ├── BuildList.tsx                   ← project-scoped build list
│   ├── SnapshotGrid.tsx                ← build-scoped snapshot grid
│   ├── DiffViewerPage.tsx              ← diff viewer with inspection panel
│   └── ui/                             ← shadcn/ui components
└── lib/
    ├── utils.ts                        ← cn() utility
    └── format.ts                       ← relativeTime(), etc.
```

---

## Key Features & Workflows

### 1. Project-Based Hierarchy
Users manage work via Projects. Each project has its own Figma file link and history of builds.

### 2. Session Capture (Browser Context)
The `RunPlaywrightModal` can launch a non-headless browser via `/api/auth/save`.
- The user logs in manually in the opened window.
- Clicks "Confirm" in the modal to save `storageState` to `snapshots/auth.json`.
- This file is automatically detected and used by Playwright tests.

### 3. AI Region Analysis
In the diff viewer, users can click "Analyze with AI" on any diff region.
- Calls `/api/analyze-region` which crops the images and invokes `core.generateRegionDescription`.
- Descriptions are persisted in `results.json`.

---

## API Routes (Specifics)

### `POST /api/auth/save`
- Body: `{ action: 'start' | 'confirm' | 'cancel', url?: string }`
- 'start': Launches Chromium with `headless: false`.
- 'confirm': Saves current context state to `auth.json`.

### `POST /api/projects/[projectId]/run`
- Body: `{ baseUrl: string, authJwt?: string }`
- Spawns `pnpm exec playwright test` as a child process.
- Sets `PROJECT_ID` and `BUILD_ID` environment variables for the runner.

---

## What AI Agents Should Know

- **Next.js 16 Params:** `params` and `searchParams` in server components and routes are now **Promises**. You MUST `await` them before destructuring: `const { projectId } = await params;`.
- **Lucide Icons:** We use `lucide-react` v1.7.0. Note that the `Figma` icon is often missing in older/specific versions; use `ImagePlus` or `Layers` instead.
- **Tailwind v4:** Uses `@import "tailwindcss"` in `globals.css`.
- **Atomic Manifests:** Manifest writes are handled by `core`. Dashboard should only call the manifest APIs.
- **Path Traversal:** `/api/image` MUST validate that paths are within `SNAPSHOTS_DIR`.
