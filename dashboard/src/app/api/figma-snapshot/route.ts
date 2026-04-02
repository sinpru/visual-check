import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFigmaBaseline,
  saveSnapshot,
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

    // ── Validation ──
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

    // ── Create one build for all selected frames ──
    // projectId is optional — if provided the build appears under that project.
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
        // Fetch the Figma frame at its native dimensions
        const buffer = await fetchFigmaBaseline(fileKey, nodeId, token, width, height);

        // Save to baselines/{testName}.png — this is the ground truth
        saveSnapshot(testName, buffer, 'baseline');

        // Write result.
        // NOTE on path naming:
        //   DiffViewer reads  currentPath  as "Baseline / Expected" (LEFT)
        //   DiffViewer reads  baselinePath as "Current  / Actual"   (RIGHT)
        //   For a Figma-only build both paths are the same file so both sides show the Figma frame.
        //   When Playwright runs later its result has a different buildId and correctly splits them.
        writeResult({
          testName,
          buildId:      build.buildId,
          status:       'pass',
          diffPercent:  0,
          diffPixels:   0,
          currentPath:  `baselines/${testName}.png`,  // Figma → shown as "Baseline" (LEFT)
          baselinePath: `baselines/${testName}.png`,  // same for Figma-only build
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