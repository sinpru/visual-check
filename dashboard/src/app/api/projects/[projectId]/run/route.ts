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
	logger,
} from '@visual-check/core';

const log = logger.child('api:projects:run');

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	try {
		const { projectId } = await params;

		// ── Validate project ──
		const projects = readProjects();
		const project = projects.find((p) => p.projectId === projectId);
		if (!project) {
			return NextResponse.json(
				{ error: 'Project not found' },
				{ status: 404 },
			);
		}

		const body = (await req.json().catch(() => ({}))) as {
			baseUrl?: string;
			authJwt?: string;
			authJwtKey?: string;
		};

		const baseUrl =
			body.baseUrl?.trim() ||
			process.env.BASE_URL ||
			'http://localhost:3000';
		const authJwt = body.authJwt?.trim() || undefined;
		const authJwtKey = body.authJwtKey?.trim() || 'token';

		const snapshotsDir = getSnapshotsDir();
		const authStatePath = path.join(snapshotsDir, 'auth.json');
		const authStateExists = fs.existsSync(authStatePath);

		// ── Discover testNames from project's Figma baselines ────────────────────
		// Reads baselines/{projectId}/*.png — every PNG filename is a testName.
		// This is the source of truth: whatever was pulled from Figma IS the test suite.
		const baselineDir = path.join(snapshotsDir, 'baselines', projectId);
		if (!fs.existsSync(baselineDir)) {
			return NextResponse.json(
				{
					error: `No Figma baselines found for this project. Pull Figma baselines first from the project page.`,
				},
				{ status: 422 },
			);
		}

		const testNames = fs
			.readdirSync(baselineDir)
			.filter((f) => f.endsWith('.png'))
			.map((f) => f.replace(/\.png$/, ''));

		if (testNames.length === 0) {
			return NextResponse.json(
				{
					error: `No baseline PNGs found in baselines/${projectId}/. Pull Figma baselines first.`,
				},
				{ status: 422 },
			);
		}

		log.info(
			`[run] Project "${project.name}" — running ${testNames.length} test(s): ${testNames.join(', ')}`,
		);

		// ── Create build record up-front so the dashboard can navigate to it immediately ──
		const buildId = `build_${Date.now()}`;
		const build = getOrCreateBuild(buildId, {
			projectId,
			branch: 'web',
			status: 'unreviewed',
		});

		// ── Locate playwright package (dashboard/ → repo root → playwright/) ──
		const playwrightDir = path.resolve(process.cwd(), '..', 'playwright');

		let stdout = '';
		let playwrightExitedWithFailures = false;

		try {
			// Run synchronously — for a local demo the suite is small enough to wait for.
			const output = execSync('pnpm exec playwright test', {
				cwd: playwrightDir,
				env: {
					...process.env,
					BUILD_ID: buildId,
					PROJECT_ID: projectId,
					BASE_URL: baseUrl,
					// Comma-separated list of testNames derived from baseline PNGs.
					TEST_NAMES: testNames.join(','),
					...(authStateExists ? { AUTH_STATE_PATH: authStatePath } : {}),
					...(authJwt ? { AUTH_JWT: authJwt, AUTH_JWT_KEY: authJwtKey } : {}),
				},
				timeout: 120_000, // 2 min ceiling
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
			testNames,
			authMethod: authJwt ? 'jwt' : authStateExists ? 'storageState' : 'none',
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
