import sharp from 'sharp';
import type { FigmaNodeDocument, FigmaNodeBoundingBox } from './types.ts';
import {
	FigmaAssetFetchError,
	FigmaNodeNotFoundError,
	FrameDimensions,
} from './types.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIGMA_BASE = 'https://api.figma.com/v1';

async function figmaGet<T>(
	path: string,
	token: string,
	attempt = 1,
): Promise<T> {
	const res = await fetch(`${FIGMA_BASE}${path}`, {
		headers: { 'X-Figma-Token': token },
	});

	if (res.status === 429 && attempt <= 3) {
		const retryAfter = Number(res.headers.get('Retry-After') ?? 10);
		// Cap backoff at 30s so we don't hang forever during a demo.
		// If the Retry-After is multi-day (Starter plan), we give up fast.
		if (retryAfter > 60) {
			throw new Error(
				`Figma rate limit exceeded. Retry-After: ${retryAfter}s (~${Math.round(retryAfter / 3600)}h). ` +
				`This is a Starter-plan / View-seat limit — the quota resets in a few days.`
			);
		}
		await sleep(Math.min(retryAfter * 1000, 30_000) * attempt);
		return figmaGet<T>(path, token, attempt + 1);
	}

	if (!res.ok) {
		throw new Error(`Figma API responded ${res.status} for ${path}`);
	}

	return res.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function normalizeNodeId(id: string): string {
	return id.replace(/-/g, ':');
}

// ─── Node types excluded from Figma label matching ───────────────────────────

const EXCLUDED_LABEL_TYPES = new Set([
	'DOCUMENT', 'CANVAS', 'FRAME', 'SECTION',
	'COMPONENT_SET', 'GROUP',
]);

// ─── Internal: single API call that returns BOTH dimensions and the node tree ─

interface NodeResponse {
	dimensions: FrameDimensions;
	tree:       FigmaNodeDocument;
}

/**
 * Single GET /v1/files/{fileKey}/nodes?ids={nodeId} call.
 * Returns both the bounding box dimensions AND the full node document tree.
 *
 * All public functions that need either piece call this once and destructure.
 * This is the key to staying within Figma's rate limits — one call, not two.
 */
async function fetchNodeData(
	fileKey: string,
	nodeId:  string,
	token:   string,
): Promise<NodeResponse> {
	type NodesResponse = {
		nodes: Record<string, { document: FigmaNodeDocument } | null>;
	};

	const normId = normalizeNodeId(nodeId);
	const data   = await figmaGet<NodesResponse>(
		`/files/${fileKey}/nodes?ids=${encodeURIComponent(normId)}`,
		token,
	);

	const entry = data.nodes[normId];
	const bb    = entry?.document?.absoluteBoundingBox;

	if (!entry || !bb) throw new FigmaNodeNotFoundError(nodeId);

	return {
		dimensions: { width: Math.round(bb.width), height: Math.round(bb.height) },
		tree:       entry.document,
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the native pixel dimensions of a Figma frame node.
 * Uses a single /nodes API call — no separate tree fetch.
 */
export async function getFrameDimensions(
	fileKey: string,
	nodeId:  string,
	token:   string,
): Promise<FrameDimensions> {
	const { dimensions } = await fetchNodeData(fileKey, nodeId, token);
	return dimensions;
}

/**
 * Fetches the full node document tree for a given frame node.
 * Uses the same single /nodes API call as getFrameDimensions.
 *
 * Returns null on error (graceful degradation) — callers should
 * treat a missing tree as Figma labels being unavailable, not a crash.
 */
export async function fetchNodeTree(
	fileKey: string,
	nodeId:  string,
	token:   string,
): Promise<FigmaNodeDocument | null> {
	try {
		const { tree } = await fetchNodeData(fileKey, nodeId, token);
		return tree;
	} catch (err) {
		console.warn(`[figma] fetchNodeTree failed for ${nodeId}:`, err);
		return null;
	}
}

/**
 * Fetches BOTH the node tree AND the PNG in two API calls total:
 *   1. GET /v1/files/{fileKey}/nodes  → dimensions + tree (one call)
 *   2. GET /v1/images/{fileKey}       → CDN URL           (one call)
 *   3. fetch(cdnUrl)                  → raw bytes         (CDN, not Figma API)
 *
 * Returns { buffer, tree } so the caller saves both without any extra calls.
 * This is the function figma-snapshot/route.ts should use — it replaces the
 * old pattern of calling fetchFigmaBaseline + fetchNodeTree separately.
 */
export async function fetchFigmaBaselineWithTree(
	fileKey:      string,
	nodeId:       string,
	token:        string,
	targetWidth:  number,
	targetHeight: number,
): Promise<{ buffer: Buffer; tree: FigmaNodeDocument }> {
	// ── 1 API call: dimensions + tree ──────────────────────────────────────
	const { dimensions, tree } = await fetchNodeData(fileKey, nodeId, token);

	const rawScale = targetWidth / dimensions.width;
	const scale    = Math.min(4, Math.max(0.01, rawScale));

	// ── 2nd API call: CDN URL from Figma render API ─────────────────────────
	type ImagesResponse = {
		err: string | null;
		images: Record<string, string | null>;
	};

	const normId  = normalizeNodeId(nodeId);
	const imgData = await figmaGet<ImagesResponse>(
		`/images/${fileKey}?ids=${encodeURIComponent(normId)}&format=png&scale=${scale}`,
		token,
	);

	if (imgData.err) {
		throw new FigmaAssetFetchError(`Figma image render error: ${imgData.err}`);
	}

	const cdnUrl = imgData.images[normId];
	if (!cdnUrl) {
		throw new FigmaAssetFetchError(
			`Figma returned no CDN URL for node ${nodeId} (invisible or zero-opacity?)`,
		);
	}

	// ── CDN fetch (not Figma API, doesn't count toward rate limit) ──────────
	const cdnRes = await fetch(cdnUrl);
	if (!cdnRes.ok) {
		throw new FigmaAssetFetchError(
			`CDN fetch failed for node ${nodeId}: HTTP ${cdnRes.status}`,
		);
	}

	const rawBuffer = Buffer.from(await cdnRes.arrayBuffer());

	const buffer = await sharp(rawBuffer)
		.resize(targetWidth, targetHeight, { fit: 'fill' })
		.png()
		.toBuffer();

	return { buffer, tree };
}

/**
 * Fetches a Figma frame as a PNG buffer only (no tree).
 * Kept for backward compatibility — uses 2 Figma API calls (nodes + images).
 * Prefer fetchFigmaBaselineWithTree when you also need Figma labels.
 */
export async function fetchFigmaBaseline(
	fileKey:      string,
	nodeId:       string,
	token:        string,
	targetWidth:  number,
	targetHeight: number,
): Promise<Buffer> {
	const { buffer } = await fetchFigmaBaselineWithTree(
		fileKey, nodeId, token, targetWidth, targetHeight,
	);
	return buffer;
}

/**
 * Given a Figma node tree and a diff region in image pixel space,
 * returns the deepest meaningful Figma node whose absoluteBoundingBox overlaps.
 */
export function findFigmaNodeForRegion(
	tree:   FigmaNodeDocument,
	region: { x: number; y: number; width: number; height: number },
): { name: string; type: string; id: string } | null {
	const frameBB = tree.absoluteBoundingBox;
	if (!frameBB) return null;

	const originX = frameBB.x;
	const originY = frameBB.y;

	const matches: { name: string; type: string; id: string; area: number }[] = [];

	function walk(node: FigmaNodeDocument): void {
		const bb = node.absoluteBoundingBox;
		if (!bb) return;

		const relX = bb.x - originX;
		const relY = bb.y - originY;

		const overlaps =
			relX < region.x + region.width  &&
			relX + bb.width  > region.x     &&
			relY < region.y + region.height &&
			relY + bb.height > region.y;

		if (overlaps && !EXCLUDED_LABEL_TYPES.has(node.type)) {
			matches.push({ name: node.name, type: node.type, id: node.id, area: bb.width * bb.height });
		}

		for (const child of node.children ?? []) walk(child);
	}

	for (const child of tree.children ?? []) walk(child);

	if (matches.length === 0) return null;

	matches.sort((a, b) => a.area - b.area);
	const best = matches[0];
	return { name: best.name, type: best.type, id: best.id };
}