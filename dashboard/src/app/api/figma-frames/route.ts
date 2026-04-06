import { NextRequest, NextResponse } from 'next/server';
import {
	fetchFigmaFile,
	type FigmaNodeDocument,
	type FigmaFileResponse,
} from '@visual-check/core';

export interface DiscoveredFrame {
	id: string;
	name: string;
	pageName: string;
	width: number;
	height: number;
}

// ─── Node type lists (mirrors Percy's exclusion logic) ────────────────────────

const ELIGIBLE = new Set(['FRAME', 'COMPONENT', 'INSTANCE']);
const EXCLUDED = new Set([
	'CANVAS',
	'SECTION',
	'COMPONENT_SET',
	'RECTANGLE',
	'VECTOR',
	'GROUP',
	'DOCUMENT',
	'TEXT',
	'LINE',
]);

// ─── Tree walker ──────────────────────────────────────────────────────────────

function collectFrames(file: FigmaFileResponse): DiscoveredFrame[] {
	const frames: DiscoveredFrame[] = [];

	for (const page of file.document.children) {
		for (const node of page.children ?? []) {
			walk(node, page.name, frames, 0);
		}
	}

	return frames;
}

function walk(
	node: FigmaNodeDocument,
	pageName: string,
	out: DiscoveredFrame[],
	excludedDepth: number,
): void {
	if (ELIGIBLE.has(node.type)) {
		const bb = node.absoluteBoundingBox;
		if (bb && bb.width > 0 && bb.height > 0) {
			out.push({
				id: node.id,
				name: node.name,
				pageName,
				width: Math.round(bb.width),
				height: Math.round(bb.height),
			});
		}
		return; // don't recurse into matched frames
	}

	if (EXCLUDED.has(node.type) && excludedDepth < 3) {
		for (const child of node.children ?? []) {
			walk(child, pageName, out, excludedDepth + 1);
		}
	}
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const fileKey =
		searchParams.get('fileKey') ?? process.env['FIGMA_FILE_KEY'];
	const token = searchParams.get('token') ?? process.env['FIGMA_TOKEN'];

	if (!fileKey) {
		return NextResponse.json(
			{
				error: 'fileKey is required — pass as ?fileKey=... or set FIGMA_FILE_KEY in .env',
			},
			{ status: 400 },
		);
	}
	if (!token) {
		return NextResponse.json(
			{
				error: 'token is required — pass as ?token=... or set FIGMA_TOKEN in .env',
			},
			{ status: 400 },
		);
	}

	try {
		// ─── Use centralized cached Figma fetch ─────────────────────────────────
		const file = await fetchFigmaFile(fileKey, token);
		const frames = collectFrames(file);

		return NextResponse.json({
			fileName: file.name,
			fileKey,
			frames,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[api/figma-frames]', message);

		// Handle common Figma API errors gracefully
		if (message.includes('403')) {
			return NextResponse.json(
				{ error: 'Invalid Figma token or no access to this file' },
				{ status: 403 },
			);
		}
		if (message.includes('404')) {
			return NextResponse.json(
				{ error: 'Figma file not found — check your file key' },
				{ status: 404 },
			);
		}

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
