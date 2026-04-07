import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import {
	fetchNodesBatch,
	fetchImagesBatch,
	saveSnapshot,
	saveFigmaNodeTree,
	createBuild,
	writeResult,
	FigmaAssetFetchError,
	logger,
	baselineRelPath,
} from '@visual-check/core';

const log = logger.child('api:figma-snapshot');

interface FrameInput {
	nodeId: string;
	testName: string;
	width: number;
	height: number;
}

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as {
			fileKey: string;
			token?: string;
			projectId?: string;
			frames: FrameInput[];
		};

		const { fileKey, frames, projectId } = body;
		const token = body.token?.trim() || process.env.FIGMA_TOKEN;

		if (!fileKey?.trim()) {
			return NextResponse.json(
				{ error: 'fileKey is required' },
				{ status: 400 },
			);
		}
		if (!token) {
			return NextResponse.json(
				{
					error: 'Figma token required — pass it or set FIGMA_TOKEN in .env',
				},
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
			projectId: projectId || undefined,
			branch: 'figma',
			totalSnapshots: frames.length,
			changedSnapshots: 0,
			passedSnapshots: frames.length,
			status: 'passed',
		});

		// ─── 1. Batch fetch node dimensions and trees ─────────────────────────
		const nodeIds = frames.map((f) => f.nodeId);
		const nodesData = await fetchNodesBatch(fileKey, nodeIds, token);

		// ─── 2. Group frames by required scale to batch image renders ──────────
		// Most frames share a scale (e.g. all 1440px wide).
		const groupsByScale: Record<number, FrameInput[]> = {};
		for (const frame of frames) {
			const data = nodesData[frame.nodeId];
			if (!data) continue;

			const rawScale = frame.width / data.dimensions.width;
			const scale =
				Math.round(Math.min(4, Math.max(0.01, rawScale)) * 100) / 100; // Snap to 2 decimal places

			if (!groupsByScale[scale]) groupsByScale[scale] = [];
			groupsByScale[scale].push(frame);
		}

		const saved: { testName: string; width: number; height: number }[] = [];
		const errors: { testName: string; error: string }[] = [];

		// ─── 3. Process groups by scale ───────────────────────────────────────
		for (const [scaleStr, group] of Object.entries(groupsByScale)) {
			const scale = Number(scaleStr);
			const groupNodeIds = group.map((f) => f.nodeId);

			try {
				// Batch render all images for this scale (1 API call)
				const images = await fetchImagesBatch(
					fileKey,
					groupNodeIds,
					scale,
					token,
				);

				// Download and save each image in parallel (CDN calls, no rate limit)
				await Promise.all(
					group.map(async (frame) => {
						const { nodeId, testName, width, height } = frame;
						const cdnUrl = images[nodeId];
						const nodeData = nodesData[nodeId];

						if (!cdnUrl || !nodeData) {
							errors.push({
								testName,
								error: 'Failed to get image URL or node data',
							});
							return;
						}

						try {
							const cdnRes = await fetch(cdnUrl);
							if (!cdnRes.ok)
								throw new FigmaAssetFetchError(
									`CDN HTTP ${cdnRes.status}`,
								);

							const rawBuffer = Buffer.from(
								await cdnRes.arrayBuffer(),
							);
							const buffer = await sharp(rawBuffer)
								.resize(width, height, { fit: 'fill' })
								.png()
								.toBuffer();

							saveSnapshot(testName, buffer, 'baseline', undefined, projectId);
							saveFigmaNodeTree(testName, nodeData.tree, projectId);

							const bPath = baselineRelPath(testName, projectId);

							writeResult({
								testName,
								buildId: build.buildId,
								status: 'pass',
								diffPercent: 0,
								diffPixels: 0,
								currentPath: bPath,
								baselinePath: bPath,
								viewport: { width, height },
								timestamp: new Date().toISOString(),
							});

							saved.push({ testName, width, height });
						} catch (err) {
							const message =
								err instanceof Error
									? err.message
									: String(err);
							errors.push({ testName, error: message });
							log.error(`Failed for "${testName}": ${message}`);
						}
					}),
				);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				for (const frame of group) {
					errors.push({ testName: frame.testName, error: message });
				}
				log.error(`Failed batch for scale ${scale}: ${message}`);
			}
		}

		return NextResponse.json({ ok: true, build, saved, errors });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error(`API failure: ${message}`);

		if (
			message.includes('429') ||
			message.toLowerCase().includes('rate limit')
		) {
			return NextResponse.json({ error: message }, { status: 429 });
		}

		return NextResponse.json({ error: message }, { status: 500 });
	}
}
