import { NextRequest, NextResponse } from 'next/server';
import {
	fetchFigmaBaselineWithTree,
	saveSnapshot,
	saveFigmaNodeTree,
	createBuild,
	writeResult,
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
				// ── Single combined call: gets PNG + node tree together ──────────
				// fetchFigmaBaselineWithTree uses exactly 2 Figma API calls total:
				//   1. GET /v1/files/{fileKey}/nodes  (dimensions + tree)
				//   2. GET /v1/images/{fileKey}       (CDN render URL)
				// The CDN download is NOT a Figma API call — no rate limit cost.
				// Previously we were making 3 calls (nodes × 2 + images × 1).
				const { buffer, tree } = await fetchFigmaBaselineWithTree(
					fileKey, nodeId, token, width, height,
				);

				saveSnapshot(testName, buffer, 'baseline');
				saveFigmaNodeTree(testName, tree);

				writeResult({
					testName,
					buildId:      build.buildId,
					status:       'pass',
					diffPercent:  0,
					diffPixels:   0,
					currentPath:  `baselines/${testName}.png`,
					baselinePath: `baselines/${testName}.png`,
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