import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BuildEntry, BuildStatus } from './types';
import { deleteResultsForBuild } from './results.ts';
import { deleteBuildFiles } from './storage.ts';

// ─── Path resolution ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

function getBuildsPath(): string {
	const dir = process.env.SNAPSHOTS_DIR;
	if (!dir) throw new Error('SNAPSHOTS_DIR is not set in environment');
	const resolved = path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
	return path.join(resolved, 'builds.json');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function readBuilds(): BuildEntry[] {
	const filePath = getBuildsPath();
	if (!fs.existsSync(filePath)) return [];
	try {
		const builds = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as BuildEntry[];
		return builds.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	} catch (e) {
		console.error('Failed to parse builds.json:', e);
		return [];
	}
}

export function createBuild(data: Partial<BuildEntry>): BuildEntry {
	const builds = readBuilds();
	const newBuild: BuildEntry = {
		buildId: `build_${Date.now()}`,
		createdAt: new Date().toISOString(),
		status: 'unreviewed',
		totalSnapshots: 0,
		changedSnapshots: 0,
		passedSnapshots: 0,
		...data,
	};
	builds.push(newBuild);
	writeBuilds(builds);
	return newBuild;
}

export function updateBuild(buildId: string, data: Partial<BuildEntry>): void {
	const builds = readBuilds();
	const idx = builds.findIndex((b) => b.buildId === buildId);
	if (idx === -1) return;
	builds[idx] = { ...builds[idx], ...data };
	writeBuilds(builds);
}

/**
 * Idempotent — returns the existing build if it already exists, otherwise
 * creates a new one. Safe to call at the start of every Playwright test in
 * a run without creating duplicate build entries.
 */
export function getOrCreateBuild(
	buildId: string,
	data: Partial<BuildEntry> = {},
): BuildEntry {
	const builds = readBuilds();
	const existing = builds.find((b) => b.buildId === buildId);
	if (existing) return existing;

	const newBuild: BuildEntry = {
		buildId,
		createdAt: new Date().toISOString(),
		status: 'unreviewed',
		totalSnapshots: 0,
		changedSnapshots: 0,
		passedSnapshots: 0,
		...data,
	};
	builds.push(newBuild);
	writeBuilds(builds);
	return newBuild;
}

export function recalculateBuildStatus(buildId: string, results: any[]): void {
	const buildResults = results.filter((r) => r.buildId === buildId);

	const total   = buildResults.length;
	const passed  = buildResults.filter((r) => r.status === 'pass' || r.status === 'approved').length;
	const failed  = buildResults.filter((r) => r.status === 'rejected').length;
	const changed = total - passed - failed;

	let status: BuildStatus = 'unreviewed';
	if (total > 0) {
		if (passed === total) {
			status = 'passed';
		} else if (failed > 0) {
			status = 'failed';
		} else if (passed + failed === total) {
			status = failed > 0 ? 'failed' : 'approved';
		} else {
			status = 'unreviewed';
		}
	}

	updateBuild(buildId, {
		totalSnapshots:   total,
		passedSnapshots:  passed,
		changedSnapshots: changed,
		status,
		finishedAt:       new Date().toISOString(),
	});
}

/**
 * Permanently removes a build, its result entries, and its snapshot files.
 */
export function deleteBuild(buildId: string): void {
	const builds = readBuilds();
	writeBuilds(builds.filter((b) => b.buildId !== buildId));

	// Cleanup associated data
	deleteResultsForBuild(buildId);
	deleteBuildFiles(buildId);
}

function writeBuilds(builds: BuildEntry[]): void {
	const filePath = getBuildsPath();
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(builds, null, 2));
	fs.renameSync(tmp, filePath);
}