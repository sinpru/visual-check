import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

export function getSnapshotsDir(): string {
  const dir = process.env.SNAPSHOTS_DIR || './snapshots';
  return path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
}

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

export function saveSnapshot(testName: string, buffer: Buffer, type: 'baseline' | 'current', buildId?: string): void {
	const paths = getPaths(testName, buildId);
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
