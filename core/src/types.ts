// ─── Error types ──────────────────────────────────────────────────────────────

export class FigmaNodeNotFoundError extends Error {
        constructor(nodeId: string) {
                super(`Figma node not found: ${nodeId}`);
                this.name = 'FigmaNodeNotFoundError';
        }
}

export class FigmaAssetFetchError extends Error {
        constructor(message: string) {
                super(message);
                this.name = 'FigmaAssetFetchError';
        }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResultStatus =
        | 'pass'
        | 'fail'
        | 'pending'
        | 'approved'
        | 'rejected';

export type BuildStatus =
        | 'unreviewed'
        | 'approved'
        | 'failed'
        | 'passed';

export interface FrameDimensions {
        width: number;
        height: number;
}

export interface DiffResult {
        diffPixels: number;
        diffPercent: number;
        width: number;
        height: number;
}

export interface ResultEntry {
        testName: string;
        buildId: string;
        status: ResultStatus;
        diffPercent: number;
        diffPixels: number;
        baselinePath: string;
        currentPath: string;
        diffPath?: string;
        viewport: {
                width: number;
                height: number;
        };
        timestamp: string;
        updatedAt?: string;
}

export interface BuildEntry {
        buildId: string;
        createdAt: string;
        finishedAt?: string;
        status: BuildStatus;
        totalSnapshots: number;
        changedSnapshots: number;
        passedSnapshots: number;
        branch?: string;
        commitHash?: string;
}
