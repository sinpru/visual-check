import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFigmaBaseline,
  getFrameDimensions,
  saveSnapshot,
  createBuild,
  writeResult,
} from '@visual-check/core';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      testName: string;
      nodeId: string;
      fileKey?: string;
      token?: string;
    };

    const { testName, nodeId } = body;

    // Credentials: prefer per-request values, fall back to env
    const token   = body.token   ?? process.env['FIGMA_TOKEN'];
    const fileKey = body.fileKey ?? process.env['FIGMA_FILE_KEY'];

    // ── Validate ────────────────────────────────────────────────────────────
    if (!testName || !nodeId) {
      return NextResponse.json(
        { error: 'testName and nodeId are required' },
        { status: 400 }
      );
    }
    if (!token) {
      return NextResponse.json(
        { error: 'Figma token is required — pass it in the request or set FIGMA_TOKEN in .env' },
        { status: 400 }
      );
    }
    if (!fileKey) {
      return NextResponse.json(
        { error: 'Figma file key is required — pass it in the request or set FIGMA_FILE_KEY in .env' },
        { status: 400 }
      );
    }

    // ── Step 1: get native frame dimensions ─────────────────────────────────
    const { width, height } = await getFrameDimensions(fileKey, nodeId, token);

    // ── Step 2: fetch PNG at native size ────────────────────────────────────
    const buffer = await fetchFigmaBaseline(fileKey, nodeId, token, width, height);

    // ── Step 3: save as baseline ─────────────────────────────────────────────
    saveSnapshot(testName, buffer, 'baseline');

    // ── Step 4: create a Figma build entry ───────────────────────────────────
    // Tag it with branch='figma' so the UI can render a special badge
    const build = createBuild({
      branch: 'figma',
      totalSnapshots: 1,
      changedSnapshots: 0,
      passedSnapshots: 1,
      status: 'passed',
    });

    // ── Step 5: write a result entry tied to this build ──────────────────────
    writeResult({
      testName,
      buildId: build.buildId,
      status: 'pass',
      diffPercent: 0,
      diffPixels: 0,
      baselinePath: `baselines/${testName}.png`,
      currentPath:  `baselines/${testName}.png`,
      viewport: { width, height },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      build,
      testName,
      width,
      height,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/figma-snapshot]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}