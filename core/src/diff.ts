import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { DiffRegion, DiffResult } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Dilation radius applied to the changed-pixel mask before flood-fill.
 * Merges nearby small changes (a 1px border shift across a button) into one
 * meaningful region instead of dozens of tiny ones.
 */
const MERGE_RADIUS = 8;

/** Discard regions with fewer actual changed pixels — filters rendering noise. */
const MIN_REGION_PIXELS = 25;

/** Cap total regions — keeps results.json lean and the UI readable. */
const MAX_REGIONS = 15;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compares two PNG buffers pixel-by-pixel using pixelmatch.
 * Writes the diff PNG to diffOutputPath.
 * Returns diff metrics AND annotated changed regions.
 *
 * Throws if dimensions don't match — sharp normalisation must run before this.
 */
export function runDiff(
	baselineBuffer: Buffer,
	currentBuffer: Buffer,
	diffOutputPath: string,
	threshold: number | null = null,
): DiffResult {
	const resolvedThreshold =
		threshold ??
		(process.env.DIFF_THRESHOLD != null
			? Number(process.env.DIFF_THRESHOLD)
			: 0.1);

	const baseline = PNG.sync.read(baselineBuffer);
	const current  = PNG.sync.read(currentBuffer);

	if (baseline.width !== current.width || baseline.height !== current.height) {
		throw new Error(
			`Dimension mismatch: baseline is ${baseline.width}×${baseline.height} ` +
			`but current is ${current.width}×${current.height}. ` +
			`Run sharp normalisation before diffing.`,
		);
	}

	const { width, height } = baseline;
	const diff = new PNG({ width, height });

	const diffPixels = pixelmatch(
		baseline.data,
		current.data,
		diff.data,
		width,
		height,
		{ threshold: resolvedThreshold },
	);

	fs.mkdirSync(path.dirname(diffOutputPath), { recursive: true });
	fs.writeFileSync(diffOutputPath, PNG.sync.write(diff));

	const diffPercent = (diffPixels / (width * height)) * 100;

	// Only extract regions when there are actual differences — skip the
	// BFS entirely for passing snapshots.
	const regions = diffPixels > 0
		? extractDiffRegions(diff.data as Buffer, width, height)
		: [];

	return { diffPixels, diffPercent, width, height, regions };
}

// ─── Region extraction ────────────────────────────────────────────────────────

/**
 * Extracts up to MAX_REGIONS bounding boxes from the diff PNG RGBA data.
 *
 * Algorithm:
 *   1. Threshold — detect pixels matching pixelmatch's default diff colour (≈red)
 *   2. Dilation  — expand the mask by MERGE_RADIUS to merge nearby groups
 *   3. BFS       — flood-fill to find connected components
 *   4. Filter    — discard regions with < MIN_REGION_PIXELS actual changed px
 *   5. Sort & cap — largest first, re-index 0-based
 *
 * Performance: ~100–200 ms for a 1920×960 image with 5% diff (Uint8Array ops).
 */
function extractDiffRegions(
	diffData: Buffer,
	width: number,
	height: number,
): DiffRegion[] {
	const total = width * height;

	// ── 1. Mark changed pixels ───────────────────────────────────────────────
	// pixelmatch default diff colour: [255, 119, 119].
	// R > 200, G < 180, B < 180 reliably distinguishes it from normal UI colours.
	const changed = new Uint8Array(total);
	for (let i = 0; i < total; i++) {
		const r = diffData[i * 4];
		const g = diffData[i * 4 + 1];
		const b = diffData[i * 4 + 2];
		if (r > 200 && g < 180 && b < 180) changed[i] = 1;
	}

	// ── 2. Dilate ────────────────────────────────────────────────────────────
	// For each changed pixel mark a (2r+1)² block — Uint8Array row fills are fast.
	const dilated = new Uint8Array(total);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!changed[y * width + x]) continue;
			const y0 = Math.max(0, y - MERGE_RADIUS);
			const y1 = Math.min(height - 1, y + MERGE_RADIUS);
			const x0 = Math.max(0, x - MERGE_RADIUS);
			const x1 = Math.min(width - 1, x + MERGE_RADIUS);
			for (let dy = y0; dy <= y1; dy++) {
				dilated.fill(1, dy * width + x0, dy * width + x1 + 1);
			}
		}
	}

	// ── 3. BFS flood-fill on dilated mask ────────────────────────────────────
	const visited = new Uint8Array(total);
	const raw: Array<{
		minX: number; maxX: number; minY: number; maxY: number;
		actualPixels: number;
	}> = [];

	outer: for (let sy = 0; sy < height; sy++) {
		for (let sx = 0; sx < width; sx++) {
			const si = sy * width + sx;
			if (!dilated[si] || visited[si]) continue;

			// Index-based queue — avoids O(n) array.shift()
			const queue: number[] = [si];
			visited[si] = 1;
			let head = 0;
			let minX = sx, maxX = sx, minY = sy, maxY = sy;
			let actualPixels = 0;

			while (head < queue.length) {
				const curr = queue[head++];
				const cx = curr % width;
				const cy = Math.floor(curr / width);

				if (cx < minX) minX = cx;
				if (cx > maxX) maxX = cx;
				if (cy < minY) minY = cy;
				if (cy > maxY) maxY = cy;
				if (changed[curr]) actualPixels++;

				// 4-connectivity
				if (cx > 0)          { const n = curr - 1;     if (dilated[n] && !visited[n]) { visited[n] = 1; queue.push(n); } }
				if (cx < width - 1)  { const n = curr + 1;     if (dilated[n] && !visited[n]) { visited[n] = 1; queue.push(n); } }
				if (cy > 0)          { const n = curr - width;  if (dilated[n] && !visited[n]) { visited[n] = 1; queue.push(n); } }
				if (cy < height - 1) { const n = curr + width;  if (dilated[n] && !visited[n]) { visited[n] = 1; queue.push(n); } }
			}

			if (actualPixels < MIN_REGION_PIXELS) continue;

			raw.push({ minX, maxX, minY, maxY, actualPixels });
			if (raw.length >= MAX_REGIONS) break outer;
		}
	}

	// ── 4 & 5. Sort, cap, re-index ────────────────────────────────────────────
	return raw
		.sort((a, b) => b.actualPixels - a.actualPixels)
		.slice(0, MAX_REGIONS)
		.map((r, i): DiffRegion => ({
			index:       i,
			x:           r.minX,
			y:           r.minY,
			width:       r.maxX - r.minX + 1,
			height:      r.maxY - r.minY + 1,
			diffPixels:  r.actualPixels,
			diffPercent: (r.actualPixels / total) * 100,
		}));
}