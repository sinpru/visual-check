import { NextRequest, NextResponse } from 'next/server';
import {
	fetchFigmaBaseline,
	getFrameDimensions,
	saveSnapshot,
	createBuild,
	writeResult,
	readProjects,
} from '@visual-check/core';

// ─── Figma frame discovery (same walker as /api/figma-frames) ─────────────────

interface FigmaNode {
	id: string;
	name: string;
	type: string;
	absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
	children?: FigmaNode[];
}

interface FigmaPage {
	id: string;
	name: string;
	type: string;
	children: FigmaNode[];
}

const ELIGIBLE = new Set(['FRAME', 'COMPONENT', 'INSTANCE']);
const EXCLUDED  = new Set([
	'CANVAS', 'SECTION', 'COMPONENT_SET', 'RECTANGLE',
	'VECTOR', 'GROUP', 'DOCUMENT', 'TEXT', 'LINE',
]);

function walk(node: FigmaNode, pageName: string, out: DiscoveredFrame[], depth: number) {
	if (ELIGIBLE.has(node.type)) {
		const bb = node.absoluteBoundingBox;
		if (bb && bb.width > 0 && bb.height > 0) {
			out.push({ id: node.id, name: node.name, pageName, width: Math.round(bb.width), height: Math.round(bb.height) });
		}
		return;
	}
	if (EXCLUDED.has(node.type) && depth < 3) {
		for (const child of node.children ?? []) walk(child, pageName, out, depth + 1);
	}
}

interface DiscoveredFrame {
	id: string; name: string; pageName: string; width: number; height: number;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> }
) {
	try {
		const { projectId } = await params;

		// Validate project exists
		const projects = readProjects();
		const project  = projects.find((p) => p.projectId === projectId);
		if (!project) {
			return NextResponse.json({ error: 'Project not found' }, { status: 404 });
		}

		const body = await req.json() as {
			figmaUrl: string;
			token?: string;
		};

		const token   = body.token   ?? process.env['FIGMA_TOKEN'];
		const figmaUrl = body.figmaUrl?.trim();

		if (!figmaUrl) {
			return NextResponse.json({ error: 'figmaUrl is required' }, { status: 400 });
		}
		if (!token) {
			return NextResponse.json(
				{ error: 'Figma token is required — pass it or set FIGMA_TOKEN in .env' },
				{ status: 400 }
			);
		}

		// Parse file key from URL or use as-is
		const fileKey = parseFileKey(figmaUrl);

		// Discover frames
		const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
			headers: { 'X-Figma-Token': token },
		});

		if (res.status === 403) return NextResponse.json({ error: 'Invalid Figma token or no access to this file' }, { status: 403 });
		if (res.status === 404) return NextResponse.json({ error: 'Figma file not found — check your URL' }, { status: 404 });
		if (!res.ok)            return NextResponse.json({ error: `Figma API error: ${res.status}` }, { status: 502 });

		const file = await res.json() as { name: string; document: { children: FigmaPage[] } };
		const frames: DiscoveredFrame[] = [];
		for (const page of file.document.children) {
			for (const node of page.children ?? []) walk(node, page.name, frames, 0);
		}

		if (frames.length === 0) {
			return NextResponse.json(
				{ error: 'No eligible frames found in this Figma file' },
				{ status: 422 }
			);
		}

		// Create one build tied to this project
		const build = createBuild({
			projectId,
			branch:           'figma',
			totalSnapshots:   frames.length,
			changedSnapshots: 0,
			passedSnapshots:  frames.length,
			status:           'passed',
		});

		// Fetch + save each frame as baseline
		const saved:  { testName: string; width: number; height: number }[] = [];
		const errors: { testName: string; error: string }[] = [];

		for (const frame of frames) {
			const testName = toTestName(frame.name);
			try {
				const buffer = await fetchFigmaBaseline(fileKey, frame.id, token, frame.width, frame.height);
				saveSnapshot(testName, buffer, 'baseline');
				writeResult({
					testName,
					buildId:      build.buildId,
					status:       'pass',
					diffPercent:  0,
					diffPixels:   0,
					baselinePath: `baselines/${testName}.png`,
					currentPath:  `baselines/${testName}.png`,
					viewport:     { width: frame.width, height: frame.height },
					timestamp:    new Date().toISOString(),
				});
				saved.push({ testName, width: frame.width, height: frame.height });
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push({ testName, error: message });
				console.error(`[api/projects/run] Failed for ${testName}:`, message);
			}
		}

		return NextResponse.json({ ok: true, build, saved, errors, fileName: file.name });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[api/projects/run]', message);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFileKey(input: string): string {
	try {
		const url   = new URL(input);
		const parts = url.pathname.split('/').filter(Boolean);
		const idx   = parts.findIndex((p) => p === 'file' || p === 'design');
		if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
	} catch { /* not a URL */ }
	return input.trim();
}

function toTestName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}