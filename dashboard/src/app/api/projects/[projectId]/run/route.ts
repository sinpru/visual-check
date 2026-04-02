import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  readProjects,
  getOrCreateBuild,
  readResults,
  recalculateBuildStatus,
} from '@visual-check/core';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;

    // ── Validate project ──
    const projects = readProjects();
    const project  = projects.find((p) => p.projectId === projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body   = await req.json().catch(() => ({})) as { baseUrl?: string };
    const baseUrl = body.baseUrl?.trim() || process.env.BASE_URL || 'http://localhost:3000';

    // ── Create build record up-front so the dashboard can navigate to it immediately ──
    const buildId = `build_${Date.now()}`;
    const build = getOrCreateBuild(buildId, {
      projectId,
      branch: 'web',
      status: 'unreviewed',
    });

    // ── Locate playwright package (dashboard/ → repo root → playwright/) ──
    // process.cwd() in Next.js = the dashboard directory
    const playwrightDir = path.resolve(process.cwd(), '..', 'playwright');

    let stdout = '';
    let playwrightExitedWithFailures = false;

    try {
      // Run synchronously — for a local demo the suite is small enough to wait for.
      // Playwright exits non-zero when tests fail; that's expected and we still return results.
      const output = execSync('pnpm exec playwright test', {
        cwd: playwrightDir,
        env: {
          ...process.env,
          BUILD_ID:   buildId,
          PROJECT_ID: projectId,
          BASE_URL:   baseUrl,
        },
        timeout: 120_000,  // 2 min ceiling
        encoding: 'utf-8',
      });
      stdout = output;
    } catch (err: any) {
      // Non-zero exit = test failures — not a crash; results were still written
      stdout = (err.stdout ?? '') + (err.stderr ?? '');
      playwrightExitedWithFailures = true;
    }

    // ── Recalculate build status from results written by Playwright ──
    recalculateBuildStatus(buildId, readResults());

    return NextResponse.json({
      ok: true,
      buildId,
      build,
      playwrightExitedWithFailures,
      // Trim stdout to avoid huge responses; client only uses buildId
      log: stdout.slice(-3000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/projects/run]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}