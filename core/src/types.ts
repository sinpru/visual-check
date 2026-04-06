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

export type BuildStatus = 'unreviewed' | 'approved' | 'failed' | 'passed';

export type ProjectStatus = 'active' | 'archived';

export interface FrameDimensions {
	width: number;
	height: number;
}

/**
 * A single changed region found by connected-component labeling on the diff PNG.
 *
 * Coordinates (x, y, width, height) are in image pixel space — same coordinate
 * system as the baseline/current PNGs. The DiffViewer renders these using an SVG
 * overlay with a matching viewBox so pins align without any JS measurement code.
 *
 * domLabel    — set by Playwright: tag + id + classes + text snippet
 * figmaLabel  — set by Playwright: name of the deepest overlapping Figma node
 * aiDescription — set on-demand: GPT-4o natural language description of the diff
 * deltaX/Y    — reserved for future geometric shift calculation
 */
export interface DiffRegion {
	/** 0-based, sorted by diffPixels descending so region 0 is always the biggest change */
	index: number;
	x: number;
	y: number;
	width: number;
	height: number;
	/** Actual changed pixels within this region */
	diffPixels: number;
	/** diffPixels / total image pixels × 100 */
	diffPercent: number;
	/** e.g. "button.hero__cta — 'Get started'" — populated by visualTest.ts DOM lookup */
	domLabel?: string;
	/** e.g. "Button/Primary" — populated by visualTest.ts Figma node tree lookup */
	figmaLabel?: string;
	/** Natural language AI description of the visual difference — populated on-demand */
	aiDescription?: string;
	/** Short 3-6 word summary generated automatically during test run */
	aiLabel?: string;
	/** Future: pixel shift on X axis relative to Figma baseline */
	deltaX?: number;
	/** Future: pixel shift on Y axis relative to Figma baseline */
	deltaY?: number;
	/** Extracted DOM metrics for the region */
	domMetrics?: Record<string, string | number>;
	/** Extracted Figma metrics for the region */
	figmaMetrics?: Record<string, string | number>;
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

// ─── Figma node tree (stored alongside baseline PNGs) ─────────────────────────

export interface FigmaNodeBoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface FigmaNodeDocument {
	id: string;
	name: string;
	type: string;
	absoluteBoundingBox?: FigmaNodeBoundingBox;
	children?: FigmaNodeDocument[];
	characters?: string;
	fills?: any[];
	style?: any;
}

// ─── Figma API Responses ──────────────────────────────────────────────────────

export interface FigmaFileResponse {
	name: string;
	document: { children: FigmaNodeDocument[] };
}

export interface FigmaNodesResponse {
	nodes: Record<string, { document: FigmaNodeDocument } | null>;
}

export interface FigmaImagesResponse {
	err: string | null;
	images: Record<string, string | null>;
}

export interface FigmaNodeData {
	dimensions: FrameDimensions;
	tree: FigmaNodeDocument;
}
