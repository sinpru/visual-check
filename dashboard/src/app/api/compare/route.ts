import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSnapshotsDir, runDiff } from '@visual-check/core';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const { baseline, current } = await request.json();

    if (!baseline || !current) {
      return NextResponse.json({ error: 'baseline and current paths are required' }, { status: 400 });
    }

    const snapshotsRoot = getSnapshotsDir();
    const baselinePath = path.resolve(snapshotsRoot, baseline);
    const currentPath = path.resolve(snapshotsRoot, current);

    // Path traversal prevention
    if (!baselinePath.startsWith(snapshotsRoot) || !currentPath.startsWith(snapshotsRoot)) {
      return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
    }

    if (!fs.existsSync(baselinePath) || !fs.existsSync(currentPath)) {
      return NextResponse.json({ error: 'One or both images not found' }, { status: 404 });
    }

    // Read buffers
    const baselineBuffer = fs.readFileSync(baselinePath);
    const currentBuffer = fs.readFileSync(currentPath);

    // Use sharp to get dimensions and pad the smaller image to match the larger image
    const baselineMetadata = await sharp(baselineBuffer).metadata();
    const currentMetadata = await sharp(currentBuffer).metadata();

    const targetWidth = Math.max(baselineMetadata.width || 0, currentMetadata.width || 0);
    const targetHeight = Math.max(baselineMetadata.height || 0, currentMetadata.height || 0);

    let finalBaselineBuffer = baselineBuffer;
    let finalCurrentBuffer = currentBuffer;

    if (baselineMetadata.width !== targetWidth || baselineMetadata.height !== targetHeight) {
      finalBaselineBuffer = await sharp(baselineBuffer)
        .extend({
          top: 0,
          left: 0,
          bottom: Math.max(0, targetHeight - (baselineMetadata.height || 0)),
          right: Math.max(0, targetWidth - (baselineMetadata.width || 0)),
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
    }

    if (currentMetadata.width !== targetWidth || currentMetadata.height !== targetHeight) {
      finalCurrentBuffer = await sharp(currentBuffer)
        .extend({
          top: 0,
          left: 0,
          bottom: Math.max(0, targetHeight - (currentMetadata.height || 0)),
          right: Math.max(0, targetWidth - (currentMetadata.width || 0)),
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
    }

    const diffPathRel = `diffs/demo/demo-diff-${Date.now()}.png`;
    const diffPathAbs = path.resolve(snapshotsRoot, diffPathRel);

    const diffResult = runDiff(finalBaselineBuffer, finalCurrentBuffer, diffPathAbs);

    return NextResponse.json({
      baselinePath: baseline,
      currentPath: current,
      diffPath: diffPathRel,
      diffPixels: diffResult.diffPixels,
      diffPercent: diffResult.diffPercent
    });

  } catch (error) {
    console.error('Error in compare API:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to compare images' }, { status: 500 });
  }
}
