import fs from 'node:fs';
import path from 'node:path';

// ─── Env ──────────────────────────────────────────────────────────────────────

function getSnapshotsDir(): string {
	const dir = process.env['SNAPSHOTS_DIR'];
	if (!dir) throw new Error('SNAPSHOTS_DIR is not set in environment');
	return dir;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the canonical file paths for a given test name.
 * All paths derive from process.env.SNAPSHOTS_DIR — never hardcoded.
 */
export function getPaths(testName: string): {
	baseline: string;
	current: string;
	diff: string;
} {
	const base = getSnapshotsDir();
	return {
		baseline: path.join(base, 'baselines', `${testName}.png`),
		current: path.join(base, 'current', `${testName}.png`),
		diff: path.join(base, 'diffs', `${testName}.png`),
	};
}

/**
 * Writes a PNG buffer to either the baseline or current snapshot folder.
 * Creates the directory if it does not exist.
 */
export function saveSnapshot(
	testName: string,
	buffer: Buffer,
	type: 'baseline' | 'current',
): void {
	const paths = getPaths(testName);
	const dest = type === 'baseline' ? paths.baseline : paths.current;
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.writeFileSync(dest, buffer);
}

/**
 * Promotes the current snapshot to baseline.
 * Copies current/{testName}.png → baselines/{testName}.png
 * Deletes diffs/{testName}.png if it exists.
 *
 * Does NOT update results.json — the caller must call updateStatus() after.
 */
export function approveBaseline(testName: string): void {
	const paths = getPaths(testName);

	if (!fs.existsSync(paths.current)) {
		throw new Error(
			`Cannot approve: no current snapshot found at ${paths.current}`,
		);
	}

	fs.mkdirSync(path.dirname(paths.baseline), { recursive: true });
	fs.copyFileSync(paths.current, paths.baseline);

	if (fs.existsSync(paths.diff)) {
		fs.rmSync(paths.diff);
	}
}
