import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FigmaNodeDocument } from './types.ts';

// ─── Path resolution ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

export function getSnapshotsDir(): string {
	const dir = process.env.SNAPSHOTS_DIR;
	if (!dir) throw new Error('SNAPSHOTS_DIR is not set in environment');
	return path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPaths(testName: string, buildId?: string) {
	const snapshotsDir = getSnapshotsDir();
	return {
		baseline: path.join(snapshotsDir, 'baselines', `${testName}.png`),
		current: buildId
			? path.join(snapshotsDir, 'current', buildId, `${testName}.png`)
			: path.join(snapshotsDir, 'current', `${testName}.png`),
		diff: buildId
			? path.join(snapshotsDir, 'diffs', buildId, `${testName}.png`)
			: path.join(snapshotsDir, 'diffs', `${testName}.png`),
	};
}

export function saveSnapshot(
	testName: string,
	buffer: Buffer,
	type: 'baseline' | 'current',
	buildId?: string,
): void {
	const paths      = getPaths(testName, buildId);
	const targetPath = type === 'baseline' ? paths.baseline : paths.current;
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	fs.writeFileSync(targetPath, buffer);
}

export function approveBaseline(testName: string, buildId: string): void {
	const paths = getPaths(testName, buildId);

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
 * Path: snapshots/baselines/{testName}.figma.json
 *
 * Call this immediately after saving the baseline PNG so the diff step can
 * resolve Figma node names for changed regions without an extra API call.
 */
export function saveFigmaNodeTree(testName: string, tree: FigmaNodeDocument): void {
	const dir      = path.join(getSnapshotsDir(), 'baselines');
	const filePath = path.join(dir, `${testName}.figma.json`);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(tree, null, 2));
}

/**
 * Loads the Figma node document tree for a given testName.
 * Returns null if the file does not exist — the diff step should treat this as
 * graceful degradation (figmaLabel stays undefined for all regions).
 */
export function loadFigmaNodeTree(testName: string): FigmaNodeDocument | null {
	const filePath = path.join(getSnapshotsDir(), 'baselines', `${testName}.figma.json`);
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FigmaNodeDocument;
	} catch {
		return null;
	}
}