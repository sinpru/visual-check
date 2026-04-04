import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ResultEntry, ResultStatus } from './types.ts';

// ─── Path resolution ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT  = path.resolve(path.dirname(__filename), '..', '..');

function getResultsPath(): string {
	const dir = process.env.SNAPSHOTS_DIR;
	if (!dir) throw new Error('SNAPSHOTS_DIR is not set in environment');
	const resolved = path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
	return path.join(resolved, 'results.json');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function atomicWrite(filePath: string, data: unknown): void {
	const tmp = `${filePath}.tmp`;
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
	fs.renameSync(tmp, filePath);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function readResults(buildId?: string): ResultEntry[] {
	const filePath = getResultsPath();
	if (!fs.existsSync(filePath)) return [];
	const all = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ResultEntry[];
	return buildId ? all.filter((r) => r.buildId === buildId) : all;
}

export function writeResult(entry: ResultEntry): void {
	const filePath = getResultsPath();
	const results  = readResults();
	const idx = results.findIndex(
		(r) => r.testName === entry.testName && r.buildId === entry.buildId,
	);
	if (idx >= 0) {
		results[idx] = entry;
	} else {
		results.push(entry);
	}
	atomicWrite(filePath, results);
}

export function updateStatus(testName: string, buildId: string, status: ResultStatus): void {
	const filePath = getResultsPath();
	const results  = readResults();
	const entry    = results.find(
		(r) => r.testName === testName && r.buildId === buildId,
	);
	if (!entry) return;
	entry.status    = status;
	entry.updatedAt = new Date().toISOString();
	atomicWrite(filePath, results);
}

/**
 * Persists an AI-generated description for a specific diff region.
 * Updates diffRegions[regionIndex].aiDescription in results.json atomically.
 *
 * No-ops silently if the result or region is not found — callers should check
 * the return value of /api/analyze-region instead of relying on this for errors.
 */
export function updateRegionAnalysis(
	testName: string,
	buildId: string,
	regionIndex: number,
	description: string,
): void {
	const filePath = getResultsPath();
	const results  = readResults();
	const entry    = results.find(
		(r) => r.testName === testName && r.buildId === buildId,
	);
	if (!entry) return;

	if (!entry.diffRegions) return;
	const region = entry.diffRegions.find((r) => r.index === regionIndex);
	if (!region) return;

	region.aiDescription = description;
	entry.updatedAt      = new Date().toISOString();
	atomicWrite(filePath, results);
}