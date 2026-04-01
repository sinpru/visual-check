import { NextRequest, NextResponse } from 'next/server';
import {
	fetchFigmaBaseline,
	getFrameDimensions,
	saveSnapshot,
	createBuild,
	writeResult,
} from '@visual-check/core';

interface FrameInput {
	nodeId: string;
	testName: string;
	width: number;
	height: number;
}

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as {
			frames: FrameInput[];
			fileKey?: string;
			token?: string;
		};

		const token = body.token ?? process.env['FIGMA_TOKEN'];
		const fileKey = body.fileKey ?? process.env['FIGMA_FILE_KEY'];

		// ── Validate ──────────────────────────────────────────────────────────────
		if (!body.frames || body.frames.length === 0) {
			return NextResponse.json(
				{ error: 'At least one frame is required' },
				{ status: 400 },
			);
		}
		if (!token) {
			return NextResponse.json(
				{
					error: 'Figma token is required — pass it in the request or set FIGMA_TOKEN in .env',
				},
				{ status: 400 },
			);
		}
		if (!fileKey) {
			return NextResponse.json(
				{
					error: 'Figma file key is required — pass it in the request or set FIGMA_FILE_KEY in .env',
				},
				{ status: 400 },
			);
		}

		// ── Create one build for this entire import ───────────────────────────────
		const build = createBuild({
			branch: 'figma',
			totalSnapshots: body.frames.length,
			changedSnapshots: 0,
			passedSnapshots: body.frames.length,
			status: 'passed',
		});

		// ── Fetch + save each frame sequentially ──────────────────────────────────
		const results: { testName: string; width: number; height: number }[] =
			[];
		const errors: { testName: string; error: string }[] = [];

		for (const frame of body.frames) {
			try {
				// Use the dimensions already discovered in Step 1 — no extra API call
				const { width, height } =
					frame.width && frame.height
						? { width: frame.width, height: frame.height }
						: await getFrameDimensions(
								fileKey,
								frame.nodeId,
								token,
							);

				const buffer = await fetchFigmaBaseline(
					fileKey,
					frame.nodeId,
					token,
					width,
					height,
				);

				saveSnapshot(frame.testName, buffer, 'baseline');

				writeResult({
					testName: frame.testName,
					buildId: build.buildId,
					status: 'pass',
					diffPercent: 0,
					diffPixels: 0,
					baselinePath: `baselines/${frame.testName}.png`,
					currentPath: `baselines/${frame.testName}.png`,
					viewport: { width, height },
					timestamp: new Date().toISOString(),
				});

				results.push({ testName: frame.testName, width, height });
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				errors.push({ testName: frame.testName, error: message });
				console.error(
					`[api/figma-snapshot] Failed for ${frame.testName}:`,
					message,
				);
			}
		}

		return NextResponse.json({
			ok: true,
			build,
			saved: results,
			errors,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[api/figma-snapshot]', message);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
