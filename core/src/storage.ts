import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FigmaNodeDocument } from './types.ts';

// ─── Path resolution ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT  = path.resolve(path.dirname(__filename), '..', '..');

export function getSnapshotsDir(): string {
	const dir = process.env.SNAPSHOTS_DIR;
	if (!dir) throw new Error('SNAPSHOTS_DIR is not set in environment');
	return path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the resolved filesystem paths for baseline, current, and diff images.
 *
 * Baseline is scoped by projectId so different projects with the same testName
 * (e.g. both have a frame called "homepage") never overwrite each other.
 *
 * baselines/{projectId}/{testName}.png   — Figma-sourced ground truth
 * current/{buildId}/{testName}.png       — Playwright web screenshot
 * diffs/{buildId}/{testName}.png         — pixelmatch output
 *
 * projectId is optional for backward-compat — old calls without it fall back
 * to baselines/{testName}.png (the old flat layout).
 */
export function getPaths(testName: string, buildId?: string, projectId?: string) {
	const snapshotsDir = getSnapshotsDir();
	const baselineDir  = projectId
		? path.join(snapshotsDir, 'baselines', projectId)
		: path.join(snapshotsDir, 'baselines');

	return {
		baseline: path.join(baselineDir, `${testName}.png`),
		current: buildId
			? path.join(snapshotsDir, 'current', buildId, `${testName}.png`)
			: path.join(snapshotsDir, 'current', `${testName}.png`),
		diff: buildId
			? path.join(snapshotsDir, 'diffs', buildId, `${testName}.png`)
			: path.join(snapshotsDir, 'diffs', `${testName}.png`),
	};
}

/** Relative path string written into results.json — used by /api/image */
export function baselineRelPath(testName: string, projectId?: string): string {
	return projectId
		? `baselines/${projectId}/${testName}.png`
		: `baselines/${testName}.png`;
}

// ─── Snapshot I/O ─────────────────────────────────────────────────────────────

export function saveSnapshot(
	testName:  string,
	buffer:    Buffer,
	type:      'baseline' | 'current',
	buildId?:  string,
	projectId?: string,
): void {
	const paths      = getPaths(testName, buildId, projectId);
	const targetPath = type === 'baseline' ? paths.baseline : paths.current;
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	fs.writeFileSync(targetPath, buffer);
}

/**
 * Copies the web screenshot from current/ into baselines/{projectId}/ and
 * deletes the diff image. Called by the approve flow.
 *
 * projectId is resolved from the build record when not passed directly —
 * callers should prefer passing it explicitly.
 */
export function approveBaseline(
	testName:  string,
	buildId:   string,
	projectId?: string,
): void {
	const paths = getPaths(testName, buildId, projectId);

	if (!fs.existsSync(paths.current)) {
		throw new Error(`Current snapshot not found for ${testName} in build ${buildId}`);
	}

	fs.mkdirSync(path.dirname(paths.baseline), { recursive: true });
	fs.copyFileSync(paths.current, paths.baseline);

	if (fs.existsSync(paths.diff)) {
		fs.unlinkSync(paths.diff);
	}
}

// ─── Figma node tree persistence ──────────────────────────────────────────────

/**
 * Saves the Figma node document tree alongside the baseline PNG.
 * Path: snapshots/baselines/{projectId}/{testName}.figma.json
 *
 * Call immediately after saveSnapshot('baseline') so the diff step can resolve
 * Figma node names without an extra API call.
 */
export function saveFigmaNodeTree(
	testName:  string,
	tree:      FigmaNodeDocument,
	projectId?: string,
): void {
	const dir      = projectId
		? path.join(getSnapshotsDir(), 'baselines', projectId)
		: path.join(getSnapshotsDir(), 'baselines');
	const filePath = path.join(dir, `${testName}.figma.json`);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(tree, null, 2));
}

/**
 * Loads the Figma node tree for a given testName (+ projectId).
 * Returns null if not found — callers should treat this as graceful degradation.
 */
export function loadFigmaNodeTree(
	testName:  string,
	projectId?: string,
): FigmaNodeDocument | null {
	const dir      = projectId
		? path.join(getSnapshotsDir(), 'baselines', projectId)
		: path.join(getSnapshotsDir(), 'baselines');
	const filePath = path.join(dir, `${testName}.figma.json`);
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FigmaNodeDocument;
	} catch {
		return null;
	}
}