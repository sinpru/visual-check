import fs from 'node:fs';
import path from 'node:path';
import { ResultEntry, ResultStatus } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getResultsPath(): string {
	const dir = process.env.SNAPSHOTS_DIR;
	if (!dir) throw new Error('SNAPSHOTS_DIR is not set in environment');
	return path.join(dir, 'results.json');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reads results.json and returns the parsed array.
 * Returns [] if the file does not exist yet.
 */
export function readResults(): ResultEntry[] {
	const filePath = getResultsPath();
	if (!fs.existsSync(filePath)) return [];
	return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ResultEntry[];
}

/**
 * Upserts an entry by testName.
 * Writes atomically: tmp file → rename.
 */
export function writeResult(entry: ResultEntry): void {
	const filePath = getResultsPath();
	const results = readResults();

	const idx = results.findIndex((r) => r.testName === entry.testName);
	if (idx >= 0) {
		results[idx] = entry;
	} else {
		results.push(entry);
	}

	const tmp = `${filePath}.tmp`;
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(tmp, JSON.stringify(results, null, 2));
	fs.renameSync(tmp, filePath);
}

/**
 * Updates only the status field of an existing entry.
 * No-ops silently if testName is not found.
 */
export function updateStatus(testName: string, status: ResultStatus): void {
	const filePath = getResultsPath();
	const results = readResults();

	const entry = results.find((r) => r.testName === testName);
	if (!entry) return;

	entry.status = status;
	entry.updatedAt = new Date().toISOString();

	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(results, null, 2));
	fs.renameSync(tmp, filePath);
}
