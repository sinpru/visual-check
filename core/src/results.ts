import fs from 'node:fs';
import path from 'node:path';
import { ResultEntry, ResultStatus } from './types';
import { getSnapshotsDir } from './storage';

function getResultsPath(): string {
  const dir = getSnapshotsDir();
  return path.join(dir, 'results.json');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reads results.json and returns the parsed array.
 * Returns [] if the file does not exist yet.
 */
export function readResults(buildId?: string): ResultEntry[] {
        const filePath = getResultsPath();
        if (!fs.existsSync(filePath)) return [];
        try {
                const results = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ResultEntry[];
                if (buildId) {
                        return results.filter(r => r.buildId === buildId);
                }
                return results;
        } catch (e) {
                console.error('Failed to parse results.json:', e);
                return [];
        }
}

/**
 * Upserts an entry by testName and buildId.
 */
export function writeResult(entry: ResultEntry): void {
        const filePath = getResultsPath();
        const results = readResults();

        const idx = results.findIndex((r) => r.testName === entry.testName && r.buildId === entry.buildId);
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
 */
export function updateStatus(testName: string, buildId: string, status: ResultStatus): void {
        const filePath = getResultsPath();
        const results = readResults();

        const entry = results.find((r) => r.testName === testName && r.buildId === buildId);
        if (!entry) return;

        entry.status = status;
        entry.updatedAt = new Date().toISOString();

        const tmp = `${filePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(results, null, 2));
        fs.renameSync(tmp, filePath);
}
