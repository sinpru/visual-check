import sharp from 'sharp';
import type {
	FigmaNodeDocument,
	FrameDimensions,
	FigmaFileResponse,
	FigmaNodesResponse,
	FigmaImagesResponse,
	FigmaNodeData,
} from './types.ts';
import { FigmaAssetFetchError, FigmaNodeNotFoundError } from './types.ts';
import { getCache, setCache } from './cache.ts';

// ─── Constants ───────────────────────────────────────────────────────────────

const FIGMA_BASE = 'https://api.figma.com/v1';

/**
 * Default TTLs for different types of Figma API calls.
 */
export const FIGMA_TTL = {
	FILE: 3600 * 1000, // 1 hour for the whole file tree (discovery)
	NODE: 3600 * 1000, // 1 hour for node dimensions/tree
	IMAGE: 600 * 1000, // 10 minutes for CDN image URLs
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Low-level GET with automatic retries, 429 handling, and file-based caching.
 */
export async function figmaGet<T>(
	path: string,
	token: string,
	ttlMs = 0,
	attempt = 1,
): Promise<T> {
	const cacheKey = `GET:${path}`;

	if (ttlMs > 0 && attempt === 1) {
		const cached = getCache<T>(cacheKey, ttlMs);
		if (cached) return cached;
	}

	const res = await fetch(`${FIGMA_BASE}${path}`, {
		headers: { 'X-Figma-Token': token },
	});

	if (res.status === 429 && attempt <= 3) {
		const retryAfter = Number(res.headers.get('Retry-After') ?? 10);
		if (retryAfter > 60) {
			throw new Error(
				`Figma rate limit exceeded. Retry-After: ${retryAfter}s (~${Math.round(retryAfter / 3600)}h). ` +
					`This is a Starter-plan / View-seat limit — the quota resets in a few days.`,
			);
		}
		await sleep(Math.min(retryAfter * 1000, 30_000) * attempt);
		return figmaGet<T>(path, token, ttlMs, attempt + 1);
	}

	if (!res.ok) {
		throw new Error(`Figma API responded ${res.status} for ${path}`);
	}

	const data = (await res.json()) as T;

	if (ttlMs > 0) {
		setCache(cacheKey, data);
	}

	return data;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function normalizeNodeId(id: string): string {
	return id.replace(/-/g, ':');
}

// ─── Node types excluded from Figma label matching ───────────────────────────

const EXCLUDED_LABEL_TYPES = new Set([
	'DOCUMENT',
	'CANVAS',
	'FRAME',
	'SECTION',
	'COMPONENT_SET',
	'GROUP',
]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the whole Figma file document tree. Used for frame discovery.
 */
export async function fetchFigmaFile(
	fileKey: string,
	token: string,
	ttlMs = FIGMA_TTL.FILE,
): Promise<FigmaFileResponse> {
	return figmaGet<FigmaFileResponse>(`/files/${fileKey}`, token, ttlMs);
}

/**
 * Fetches dimensions and node trees for a batch of Figma nodes.
 * Uses a single GET /v1/files/{fileKey}/nodes?ids=ID1,ID2... call.
 */
export async function fetchNodesBatch(
	fileKey: string,
	nodeIds: string[],
	token: string,
	ttlMs = FIGMA_TTL.NODE,
): Promise<Record<string, FigmaNodeData>> {
	if (nodeIds.length === 0) return {};

	const normIds = nodeIds.map(normalizeNodeId);
	const path = `/files/${fileKey}/nodes?ids=${encodeURIComponent(normIds.join(','))}`;

	const data = await figmaGet<FigmaNodesResponse>(path, token, ttlMs);
	const out: Record<string, FigmaNodeData> = {};

	for (const id of nodeIds) {
		const normId = normalizeNodeId(id);
		const entry = data.nodes[normId];
		const bb = entry?.document?.absoluteBoundingBox;

		if (!entry || !bb) {
			console.warn(
				`[figma] Node ${id} not found in batch for ${fileKey}`,
			);
			continue;
		}

		out[id] = {
			dimensions: {
				width: Math.round(bb.width),
				height: Math.round(bb.height),
			},
			tree: entry.document,
		};
	}

	return out;
}

/**
 * Internal: used by single-node functions.
 */
async function fetchNodeData(
	fileKey: string,
	nodeId: string,
	token: string,
): Promise<FigmaNodeData> {
	const batch = await fetchNodesBatch(fileKey, [nodeId], token);
	const data = batch[nodeId];
	if (!data) throw new FigmaNodeNotFoundError(nodeId);
	return data;
}

/**
 * Fetches CDN render URLs for a batch of Figma nodes at a specific scale.
 * Uses a single GET /v1/images/{fileKey}?ids=ID1,ID2... call.
 */
export async function fetchImagesBatch(
	fileKey: string,
	nodeIds: string[],
	scale: number,
	token: string,
	ttlMs = FIGMA_TTL.IMAGE,
): Promise<Record<string, string>> {
	if (nodeIds.length === 0) return {};

	const normIds = nodeIds.map(normalizeNodeId);
	const path = `/images/${fileKey}?ids=${encodeURIComponent(normIds.join(','))}&format=png&scale=${scale}`;

	const data = await figmaGet<FigmaImagesResponse>(path, token, ttlMs);

	if (data.err) {
		throw new FigmaAssetFetchError(`Figma image render error: ${data.err}`);
	}

	const out: Record<string, string> = {};
	for (const id of nodeIds) {
		const normId = normalizeNodeId(id);
		const url = data.images[normId];
		if (url) out[id] = url;
	}

	return out;
}

/**
 * Returns the native pixel dimensions of a Figma frame node.
 */
export async function getFrameDimensions(
	fileKey: string,
	nodeId: string,
	token: string,
): Promise<FrameDimensions> {
	const { dimensions } = await fetchNodeData(fileKey, nodeId, token);
	return dimensions;
}

/**
 * Fetches the full node document tree for a given frame node.
 */
export async function fetchNodeTree(
	fileKey: string,
	nodeId: string,
	token: string,
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
 * Fetches BOTH the node tree AND the PNG buffer.
 * Uses cached batch calls internally.
 */
export async function fetchFigmaBaselineWithTree(
	fileKey: string,
	nodeId: string,
	token: string,
	targetWidth: number,
	targetHeight: number,
): Promise<{ buffer: Buffer; tree: FigmaNodeDocument }> {
	const { dimensions, tree } = await fetchNodeData(fileKey, nodeId, token);

	const rawScale = targetWidth / dimensions.width;
	const scale = Math.min(4, Math.max(0.01, rawScale));

	const images = await fetchImagesBatch(fileKey, [nodeId], scale, token);
	const cdnUrl = images[nodeId];

	if (!cdnUrl) {
		throw new FigmaAssetFetchError(
			`Figma returned no CDN URL for node ${nodeId} (invisible or zero-opacity?)`,
		);
	}

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
 * Fetches a Figma frame as a PNG buffer only.
 */
export async function fetchFigmaBaseline(
	fileKey: string,
	nodeId: string,
	token: string,
	targetWidth: number,
	targetHeight: number,
): Promise<Buffer> {
	const { buffer } = await fetchFigmaBaselineWithTree(
		fileKey,
		nodeId,
		token,
		targetWidth,
		targetHeight,
	);
	return buffer;
}

/**
 * Given a Figma node tree and a diff region in image pixel space,
 * returns the deepest meaningful Figma node whose absoluteBoundingBox overlaps.
 */
export function findFigmaNodeForRegion(
	tree: FigmaNodeDocument,
	region: { x: number; y: number; width: number; height: number },
): FigmaNodeDocument | null {
	const frameBB = tree.absoluteBoundingBox;
	if (!frameBB) return null;

	const originX = frameBB.x;
	const originY = frameBB.y;

	const matches: { node: FigmaNodeDocument; area: number }[] = [];

	function walk(node: FigmaNodeDocument): void {
		const bb = node.absoluteBoundingBox;
		if (!bb) return;

		const relX = bb.x - originX;
		const relY = bb.y - originY;

		const overlaps =
			relX < region.x + region.width &&
			relX + bb.width > region.x &&
			relY < region.y + region.height &&
			relY + bb.height > region.y;

		if (overlaps && !EXCLUDED_LABEL_TYPES.has(node.type)) {
			matches.push({ node, area: bb.width * bb.height });
		}

		for (const child of node.children ?? []) walk(child);
	}

	for (const child of tree.children ?? []) walk(child);

	if (matches.length === 0) return null;

	matches.sort((a, b) => a.area - b.area);
	return matches[0].node;
}
