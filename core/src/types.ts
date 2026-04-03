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

export type ProjectStatus =
	| 'active'
	| 'archived';

export interface FrameDimensions {
	width: number;
	height: number;
}

/**
 * A single changed region found by connected-component labeling on the diff PNG.
 *
 * Coordinates (x, y, width, height) are in image pixel space — the same
 * coordinate system as the baseline/current PNGs. The DiffViewer renders these
 * using an SVG overlay with a matching viewBox so pins align without any JS
 * measurement code.
 *
 * domLabel   — set by Playwright: tag + id + classes + text snippet
 * figmaLabel — reserved for future Figma node tree lookup
 * deltaX/Y   — reserved for future geometric shift calculation
 */
export interface DiffRegion {
	/** 0-based, sorted by diffPixels descending so region 0 is always the biggest change */
	index: number;
	x: number;
	y: number;
	width: number;
	height: number;
	/** Actual changed pixels within this region (excluding the dilation padding used for merging) */
	diffPixels: number;
	/** diffPixels / total image pixels × 100 */
	diffPercent: number;
	/** e.g. "button.hero__cta — 'Get started'" — populated by visualTest.ts DOM lookup */
	domLabel?: string;
	/** e.g. "Button/Primary" — future: Figma node tree walker */
	figmaLabel?: string;
	/** Future: pixel shift on X axis relative to Figma baseline */
	deltaX?: number;
	/** Future: pixel shift on Y axis relative to Figma baseline */
	deltaY?: number;
}

export interface DiffResult {
	diffPixels: number;
	diffPercent: number;
	width: number;
	height: number;
	/** Connected-component regions from the diff PNG, sorted largest-first, capped at 15 */
	regions: DiffRegion[];
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
	/** Annotated diff regions — present when a real diff was run (not pending) */
	diffRegions?: DiffRegion[];
}

export interface BuildEntry {
	buildId: string;
	projectId?: string;
	createdAt: string;
	finishedAt?: string;
	status: BuildStatus;
	totalSnapshots: number;
	changedSnapshots: number;
	passedSnapshots: number;
	branch?: string;
	commitHash?: string;
}

export interface ProjectEntry {
	projectId: string;
	name: string;
	status: ProjectStatus;
	createdAt: string;
	updatedAt: string;
}