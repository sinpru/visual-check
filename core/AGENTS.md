# AGENTS.md — visual-check/core

> Read the root `AGENTS.md` first for monorepo-wide context.
> This file covers the `@visual-check/core` package only.

---

## Package Purpose

`core` is the shared internal library used by both `playwright` and `dashboard`.
It has no server, no CLI, and no side effects on import — pure functions only.

**Owner:** Thanh Binh

---

## Folder Structure

```
visual-check/core/
├── AGENTS.md
├── package.json
├── index.ts               ← public API — re-exports everything
├── src/
│   ├── types.ts           ← shared interfaces & enums
│   ├── figma.ts           ← Figma API calls + tree traversal
│   ├── diff.ts            ← pixelmatch diffing + region extraction
│   ├── storage.ts         ← local file read/write + path resolution
│   ├── results.ts         ← results.json manifest management
│   ├── builds.ts          ← builds.json manifest management
│   ├── projects.ts        ← projects.json manifest management
│   ├── ai-reasoning.ts    ← AI Vision API logic (OpenAI/Gemini)
│   ├── cache.ts           ← file-based SHA256 caching
│   └── logger.ts          ← namespaced logger (console + file)
└── package.json
```

---

## Public API

Everything consumed by `playwright` and `dashboard` is exported from `index.ts`.

```ts
// Figma
export { fetchFigmaBaselineWithTree, findFigmaNodeForRegion } from './src/figma.ts';

// Diffing
export { runDiff } from './src/diff.ts';

// AI
export { generateRegionDescription, generateRegionLabel } from './src/ai-reasoning.ts';

// Storage
export { saveSnapshot, getPaths, getSnapshotsDir } from './src/storage.ts';

// Manifests
export { readResults, writeResult, updateStatus } from './src/results.ts';
export { getOrCreateBuild, recalculateBuildStatus } from './src/builds.ts';
```

---

## ai-reasoning.ts

Handles visual analysis using Large Language Models with vision capabilities.

### `generateRegionDescription(result, regionIndex, figmaPath, webPath)`
- Crops images to the specified region using `sharp`.
- Sends crops + metrics to GPT-4o or Gemini.
- Returns a human-readable explanation of why the region differs.

### `generateRegionLabel(region)`
- Uses AI to generate a short (3-8 word) punchy label for the discrepancy (e.g., "Font weight is too bold").

---

## logger.ts

Centralized logging utility.
- Supports `DEBUG`, `INFO`, `WARN`, `ERROR` levels.
- Automatically writes to `snapshots/logs/{BUILD_ID}.log` if `BUILD_ID` is present.
- Use `logger.child('namespace')` to create a scoped logger.

---

## cache.ts

Simple file-based cache to avoid redundant expensive operations.
- Key-value store where keys are hashed using SHA256.
- Stored in `snapshots/cache/`.

---

## figma.ts

Handles all communication with the Figma REST API.

### `fetchFigmaBaselineWithTree(fileKey, nodeId, token, targetWidth, targetHeight)`
- Hits `/nodes` for tree + dimensions.
- Hits `/images` for CDN URL.
- Fetches and normalizes PNG via `sharp`.
- Returns `{ buffer, tree }`.

---

## storage.ts

All filesystem operations.
- `getSnapshotsDir()`: Resolves to the absolute path of the `snapshots/` folder.
- `getPaths(testName, buildId)`: Returns canonical paths for baseline, current, and diff images.

---

## What AI Agents Should Know

- **This package is pure logic** — no side effects on import.
- **Path swap reminder:** `currentPath` = Figma (Baseline), `baselinePath` = Web (Current).
- **AI config:** `AI_API_KEY`, `AI_API_URL`, and `AI_MODEL` env vars must be set for reasoning features.
- **Atomic writes:** Manifest updates (`results.ts`, `builds.ts`) should be treated as sequential to avoid corruption.
