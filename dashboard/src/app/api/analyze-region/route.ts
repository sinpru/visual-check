import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import {
	readResults,
	updateRegionAnalysis,
	getSnapshotsDir,
	generateRegionDescription,
	logger,
} from '@visual-check/core';

const log = logger.child('api:analyze-region');

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as {
			testName: string;
			buildId: string;
			regionIndex: number;
		};

		const { testName, buildId, regionIndex } = body;

		log.info(
			`Analyzing region ${regionIndex} for "${testName}" (build: ${buildId})`,
		);

		if (!testName || !buildId || regionIndex == null) {
			return NextResponse.json(
				{ error: 'testName, buildId, and regionIndex are required' },
				{ status: 400 },
			);
		}

		if (!process.env.AI_API_KEY) {
			return NextResponse.json(
				{
					error: 'AI_API_KEY is not set in environment. Add it to your root .env file.',
				},
				{ status: 400 },
			);
		}

		// ── Load result + region ──────────────────────────────────────────────
		const results = readResults(buildId);
		const result = results.find((r) => r.testName === testName);

		if (!result) {
			return NextResponse.json(
				{
					error: `Result not found for test "${testName}" in build "${buildId}"`,
				},
				{ status: 404 },
			);
		}

		const region = result.diffRegions?.find((r) => r.index === regionIndex);
		if (!region) {
			return NextResponse.json(
				{
					error: `Region ${regionIndex} not found for test "${testName}"`,
				},
				{ status: 404 },
			);
		}

		// ── Resolve image paths ───────────────────────────────────────────────
		// currentPath  = Figma frame (expected / LEFT panel)
		// baselinePath = web screenshot (actual / RIGHT panel)
		// See AGENTS.md — this path swap is intentional.
		const snapshotsDir = getSnapshotsDir();
		const figmaPath = path.resolve(snapshotsDir, result.currentPath);
		const webPath = path.resolve(snapshotsDir, result.baselinePath);

		// Path traversal guard
		if (
			!figmaPath.startsWith(snapshotsDir) ||
			!webPath.startsWith(snapshotsDir)
		) {
			return NextResponse.json(
				{ error: 'Invalid image path' },
				{ status: 403 },
			);
		}
		if (!fs.existsSync(figmaPath)) {
			return NextResponse.json(
				{ error: `Figma image not found: ${result.currentPath}` },
				{ status: 404 },
			);
		}
		if (!fs.existsSync(webPath)) {
			return NextResponse.json(
				{ error: `Web screenshot not found: ${result.baselinePath}` },
				{ status: 404 },
			);
		}

		// ── Generate AI Description ───────────────────────────────────────────
		const description = await generateRegionDescription(
			result,
			regionIndex,
			figmaPath,
			webPath,
		);

		// ── Persist + return ──────────────────────────────────────────────────
		updateRegionAnalysis(testName, buildId, regionIndex, description);

		return NextResponse.json({ ok: true, description });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error(`API Error`, { error: err });
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
