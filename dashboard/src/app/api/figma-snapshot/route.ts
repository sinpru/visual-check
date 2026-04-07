import { NextRequest, NextResponse } from 'next/server';
import {
	fetchFigmaBaselineWithTree,
	saveSnapshot,
	saveFigmaNodeTree,
	createBuild,
	writeResult,
	baselineRelPath,
} from '@visual-check/core';

interface FrameInput {
	nodeId:   string;
	testName: string;
	width:    number;
	height:   number;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json() as {
			fileKey:    string;
			token?:     string;
			projectId?: string;
			frames:     FrameInput[];
		};

		const { fileKey, frames, projectId } = body;
		const token = body.token?.trim() || process.env.FIGMA_TOKEN;

		if (!fileKey?.trim()) {
			return NextResponse.json({ error: 'fileKey is required' }, { status: 400 });
		}
		if (!token) {
			return NextResponse.json(
				{ error: 'Figma token required — pass it or set FIGMA_TOKEN in .env' },
				{ status: 400 },
			);
		}
		if (!frames?.length) {
			return NextResponse.json(
				{ error: 'frames[] is required and must be non-empty' },
				{ status: 400 },
			);
		}

		const build = createBuild({
			projectId:        projectId || undefined,
			branch:           'figma',
			totalSnapshots:   frames.length,
			changedSnapshots: 0,
			passedSnapshots:  frames.length,
			status:           'passed',
		});

		const saved:  { testName: string; width: number; height: number }[] = [];
		const errors: { testName: string; error: string }[]                 = [];

		for (const frame of frames) {
			const { nodeId, testName, width, height } = frame;
			try {
				const { buffer, tree } = await fetchFigmaBaselineWithTree(
					fileKey, nodeId, token, width, height,
				);

				// ── Save baseline scoped to this project ──────────────────────
				// baselines/{projectId}/{testName}.png
				saveSnapshot(testName, buffer, 'baseline', undefined, projectId);
				saveFigmaNodeTree(testName, tree, projectId);

				// Relative path stored in results.json — used by /api/image and
				// /api/analyze-region. Must match the scoped layout.
				const bPath = baselineRelPath(testName, projectId);

				writeResult({
					testName,
					buildId:      build.buildId,
					status:       'pass',
					diffPercent:  0,
					diffPixels:   0,
					// Both sides point to the Figma PNG for a baseline-only build
					currentPath:  bPath,
					baselinePath: bPath,
					viewport:     { width, height },
					timestamp:    new Date().toISOString(),
				});

				saved.push({ testName, width, height });
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push({ testName, error: message });
				console.error(`[figma-snapshot] Failed for "${testName}":`, message);
			}
		}

		return NextResponse.json({ ok: true, build, saved, errors });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[figma-snapshot]', message);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}