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
	status: ResultStatus;
	diffPercent?: number;
	diffPixels?: number;
	width?: number;
	height?: number;
	updatedAt: string;
}

