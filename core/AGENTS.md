# AGENTS.md — visual-check/core

> Read the root `AGENTS.md` first for monorepo-wide context.
> This file covers the `@visual-check/core` package only.

---

## Package Purpose

`core` is the shared internal library used by both `playwright` and `dashboard`.
It has no server, no CLI, and no side effects on import — pure functions only.

**Owner:** Person 1

---

## Folder Structure

```
visual-check/core/
├── AGENTS.md
├── package.json
├── index.ts               ← public API — re-exports everything
├── src/
│   ├── figma.ts           ← Figma API calls
│   ├── diff.ts            ← pixelmatch diffing
│   ├── storage.ts         ← local file read/write
│   └── results.ts         ← results.json manifest
└── package.json
```

---

## Public API

Everything consumed by `playwright` and `dashboard` is exported from `index.ts`.

```ts
// Figma
export { getFrameDimensions, fetchFigmaBaseline } from './src/figma.ts';

// Diffing
export { runDiff } from './src/diff.ts';

// Storage
export { saveSnapshot, approveBaseline, getPaths } from './src/storage.ts';

// Results manifest
export { readResults, writeResult, updateStatus } from './src/results.ts';
```

---

## figma.ts

Handles all communication with the Figma REST API.

### `getFrameDimensions(fileKey, nodeId, token)`

- Hits `GET /v1/files/{fileKey}/nodes?ids={nodeId}`
- Parses `data.nodes[nodeId].document.absoluteBoundingBox`
- Returns `{ width, height }`
- Throws a descriptive error if node is not found

### `fetchFigmaBaseline(fileKey, nodeId, token, targetWidth, targetHeight)`

- Calls `getFrameDimensions` to get native frame size
- Calculates `scale = targetWidth / nativeWidth` — clamped between 0.01 and 4
- Hits `GET /v1/images/{fileKey}?ids={nodeId}&format=png&scale={scale}`
- **The response is a CDN URL, not raw bytes** — performs a second `fetch(cdnUrl)` to get the PNG
- Pipes through `sharp().resize(targetWidth, targetHeight, { fit: 'fill' }).png()` as a safety net
- Returns a `Buffer`

### Error handling

- 429 from Figma → retry with exponential backoff (max 3 attempts, 1s/2s/4s delays)
- 404 → throw `FigmaNodeNotFoundError` with the nodeId in the message
- CDN fetch failure → throw `FigmaAssetFetchError`

---

## diff.ts

Wraps `pixelmatch` with `pngjs` for PNG parsing.

### `runDiff(baselineBuffer, currentBuffer, diffOutputPath, threshold?)`

- Decodes both buffers with `PNG.sync.read()`
- **Throws if dimensions don't match** — this should never happen if `sharp` normalization ran
- Runs `pixelmatch(baseline.data, current.data, diff.data, width, height, { threshold })`
- Writes diff PNG to `diffOutputPath` with `PNG.sync.write()`
- Returns `{ diffPixels, diffPercent, width, height }`

### Threshold

- Default `0.1` (10% per-channel color tolerance)
- Configurable via `process.env.DIFF_THRESHOLD`
- Pass `null` to use env default

---

## storage.ts

All filesystem operations. Reads `SNAPSHOTS_DIR` from `process.env`.

### `getPaths(testName)`

Returns the canonical paths for a test:

```ts
{
  baseline: `${SNAPSHOTS_DIR}/baselines/${testName}.png`,
  current:  `${SNAPSHOTS_DIR}/current/${testName}.png`,
  diff:     `${SNAPSHOTS_DIR}/diffs/${testName}.png`,
}
```

### `saveSnapshot(testName, buffer, type)`

- `type`: `'baseline'` | `'current'`
- Creates the directory if it doesn't exist (`fs.mkdirSync` with `recursive: true`)
- Writes buffer to the appropriate path

### `approveBaseline(testName)`

- Copies `current/{testName}.png` → `baselines/{testName}.png`
- Deletes `diffs/{testName}.png`
- Does NOT modify `results.json` — that's handled by `updateStatus` in `results.ts`

---

## results.ts

Manages the `results.json` manifest at `{SNAPSHOTS_DIR}/results.json`.

### `readResults()`

- Returns parsed array, or `[]` if file doesn't exist

### `writeResult(entry)`

- Reads existing results
- Upserts by `testName` (updates if exists, appends if new)
- Writes back atomically (write to `.tmp` then rename)

### `updateStatus(testName, status)`

- Reads, finds entry by `testName`, updates `status` field only
- Valid statuses: `'pass'`, `'fail'`, `'pending'`, `'approved'`, `'rejected'`

---

## Dependencies

```json
{
	"dependencies": {
		"sharp": "^0.33.0",
		"pngjs": "^7.0.0",
		"pixelmatch": "^5.3.0",
		"dotenv": "^16.0.0"
	}
}
```

---

## What AI Agents Should Know

- **This package has no Express server, no routes, no CLI** — pure functions only
- **All paths come from `process.env.SNAPSHOTS_DIR`** — never hardcode
- **`runDiff` expects pre-normalized buffers of identical size** — if dimensions mismatch, throw early with a clear message
- **Two fetches are always needed for Figma images** — the images endpoint returns a URL, not bytes
- **`writeResult` upserts, not appends blindly** — check by `testName` before pushing
- **`approveBaseline` does not update `results.json`** — the caller (`dashboard` API route) must call `updateStatus` after
