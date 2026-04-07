import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {
  readProjects,
  getOrCreateBuild,
  readResults,
  recalculateBuildStatus,
  getSnapshotsDir,
} from '@visual-check/core';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;

    const projects = readProjects();
    const project  = projects.find((p) => p.projectId === projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({})) as {
      baseUrl?:    string;
      authJwt?:    string;
      authJwtKey?: string;
    };

    const baseUrl    = body.baseUrl?.trim()    || process.env.BASE_URL || 'http://localhost:3000';
    const authJwt    = body.authJwt?.trim()    || undefined;
    const authJwtKey = body.authJwtKey?.trim() || 'token';

    const snapshotsDir    = getSnapshotsDir();
    const authStatePath   = path.join(snapshotsDir, 'auth.json');
    const authStateExists = fs.existsSync(authStatePath);

    // ── Discover testNames from project's Figma baselines ────────────────────
    // Reads baselines/{projectId}/*.png — every PNG filename is a testName.
    // This is the source of truth: whatever was pulled from Figma IS the test suite.
    // The test runner does NOT rely on hardcoded testNames in *.visual.ts files.
    const baselineDir = path.join(snapshotsDir, 'baselines', projectId);
    if (!fs.existsSync(baselineDir)) {
      return NextResponse.json(
        { error: `No Figma baselines found for this project. Pull Figma baselines first from the project page.` },
        { status: 422 },
      );
    }

    const testNames = fs
      .readdirSync(baselineDir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.replace(/\.png$/, ''));

    if (testNames.length === 0) {
      return NextResponse.json(
        { error: `No baseline PNGs found in baselines/${projectId}/. Pull Figma baselines first.` },
        { status: 422 },
      );
    }

    console.log(`[run] Project "${project.name}" — running ${testNames.length} test(s): ${testNames.join(', ')}`);

    const buildId = `build_${Date.now()}`;
    getOrCreateBuild(buildId, { projectId, branch: 'web', status: 'unreviewed' });

    const playwrightDir = path.resolve(process.cwd(), '..', 'playwright');

    let stdout = '';
    let playwrightExitedWithFailures = false;

    try {
      const output = execSync('pnpm exec playwright test', {
        cwd: playwrightDir,
        env: {
          ...process.env,
          BUILD_ID:   buildId,
          PROJECT_ID: projectId,
          BASE_URL:   baseUrl,
          // Comma-separated list of testNames derived from baseline PNGs.
          // The generic visual.ts test reads this and runs one test per entry.
          TEST_NAMES: testNames.join(','),
          ...(authStateExists ? { AUTH_STATE_PATH: authStatePath } : {}),
          ...(authJwt ? { AUTH_JWT: authJwt, AUTH_JWT_KEY: authJwtKey } : {}),
        },
        timeout:  120_000,
        encoding: 'utf-8',
      });
      stdout = output;
    } catch (err: any) {
      stdout = (err.stdout ?? '') + (err.stderr ?? '');
      playwrightExitedWithFailures = true;
    }

    recalculateBuildStatus(buildId, readResults());

    return NextResponse.json({
      ok: true,
      buildId,
      testNames,
      authMethod: authJwt ? 'jwt' : authStateExists ? 'storageState' : 'none',
      playwrightExitedWithFailures,
      log: stdout.slice(-3000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/projects/run]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}