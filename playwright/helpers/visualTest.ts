import type { Page } from '@playwright/test';
import {
	saveSnapshot,
	getPaths,
	baselineRelPath,
	runDiff,
	writeResult,
	fetchFigmaBaseline,
	getOrCreateBuild,
	recalculateBuildStatus,
	readResults,
	loadFigmaNodeTree,
	findFigmaNodeForRegion,
} from '@visual-check/core';
import type { DiffRegion } from '@visual-check/core';
import { figmaNodes } from './figmaNodes';
import fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VisualTestOptions {
	selector?:       string;
	clip?:           { x: number; y: number; width: number; height: number };
	updateBaseline?: boolean;
}

const MAX_DOM_LOOKUPS = 10;

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Steps:
 * 0.  JWT injection — if AUTH_JWT is set, inject into localStorage before navigation
 * 1.  getOrCreateBuild — register build (idempotent)
 * 2.  Suppress CSS animations/transitions
 * 3.  Normalize scroll
 * 4.  waitForLoadState('networkidle')
 * 5.  Capture screenshot
 * 6.  Save to current/{buildId}/{testName}.png
 * 7.  [updateBaseline] save Figma or current as baseline → write pending, stop
 * 8.  [no baseline] save current as baseline → write pending, stop
 * 9.  runDiff(figmaBaseline, webScreenshot) → DiffResult with regions[]
 * 10. DOM lookup — attaches domLabel to each region
 * 11. Figma node lookup — attaches figmaLabel to each region
 * 12. writeResult with diffRegions
 * 13. recalculateBuildStatus
 *
 * Baseline scoping:
 *   Baselines are stored under baselines/{projectId}/{testName}.png so that
 *   different projects with the same testName never overwrite each other.
 *   PROJECT_ID is set by the dashboard run route before spawning Playwright.
 *
 * Auth:
 *   storageState loaded automatically from snapshots/auth.json by playwright.config.ts.
 *   JWT fallback: AUTH_JWT injected into localStorage[AUTH_JWT_KEY] via addInitScript.
 *
 * Path naming swap (intentional — see AGENTS.md):
 *   currentPath  → Figma frame (LEFT  "Baseline / Expected")
 *   baselinePath → web screenshot (RIGHT "Current / Actual" + diff overlay)
 */
export async function visualTest(
	page: Page,
	testName: string,
	options: VisualTestOptions = {},
): Promise<void> {
	const updateBaseline =
		options.updateBaseline ?? process.env.UPDATE_BASELINE === 'true';

	const buildId   = process.env.BUILD_ID   || `build_${Date.now()}`;
	const projectId = process.env.PROJECT_ID || undefined;

	// ── 0. JWT injection ───────────────────────────────────────────────────────
	const authJwt    = process.env.AUTH_JWT;
	const authJwtKey = process.env.AUTH_JWT_KEY || 'token';

	if (authJwt) {
		await page.addInitScript(
			({ key, value }: { key: string; value: string }) => {
				localStorage.setItem(key, value);
			},
			{ key: authJwtKey, value: authJwt },
		);
		console.log(`[visual-check] JWT injected into localStorage["${authJwtKey}"]`);
	}

	// ── 1. Register build ──────────────────────────────────────────────────────
	getOrCreateBuild(buildId, { projectId, branch: 'web', status: 'unreviewed' });

	// All baseline paths scoped by projectId
	const paths     = getPaths(testName, buildId, projectId);
	const bPath     = baselineRelPath(testName, projectId);   // relative, stored in results.json
	const viewport  = page.viewportSize() || { width: 1440, height: 900 };
	const timestamp = new Date().toISOString();

	// ── 2. Suppress animations ─────────────────────────────────────────────────
	await page.addStyleTag({
		content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
	});

	// ── 3. Normalize scroll ────────────────────────────────────────────────────
	await page.evaluate(() => window.scrollTo(0, 0));

	// ── 4. Wait for network ────────────────────────────────────────────────────
	await page.waitForLoadState('networkidle');

	// ── 5 & 6. Screenshot + save ───────────────────────────────────────────────
	const screenshotBuffer = await captureScreenshot(page, options);
	saveSnapshot(testName, screenshotBuffer, 'current', buildId);

	// ── 7. updateBaseline mode ─────────────────────────────────────────────────
	if (updateBaseline) {
		const nodeId = figmaNodes[testName];
		if (nodeId && process.env.FIGMA_TOKEN && process.env.FIGMA_FILE_KEY) {
			try {
				const figmaBuffer = await fetchFigmaBaseline(
					process.env.FIGMA_FILE_KEY, nodeId, process.env.FIGMA_TOKEN,
					viewport.width, viewport.height,
				);
				saveSnapshot(testName, figmaBuffer, 'baseline', undefined, projectId);
			} catch (err) {
				console.warn(`[visual-check] Figma fetch failed for "${testName}": ${err} — using screenshot`);
				saveSnapshot(testName, screenshotBuffer, 'baseline', undefined, projectId);
			}
		} else {
			if (nodeId) console.warn(`[visual-check] FIGMA_TOKEN or FIGMA_FILE_KEY not set — using screenshot`);
			else        console.warn(`[visual-check] No Figma node mapping for "${testName}" — using screenshot`);
			saveSnapshot(testName, screenshotBuffer, 'baseline', undefined, projectId);
		}
		writeResult({
			testName, buildId, status: 'pending',
			diffPercent: 0, diffPixels: 0,
			currentPath:  bPath,
			baselinePath: `current/${buildId}/${testName}.png`,
			viewport, timestamp,
		});
		recalculateBuildStatus(buildId, readResults());
		return;
	}

	// ── 8. No baseline yet ─────────────────────────────────────────────────────
	if (!fs.existsSync(paths.baseline)) {
		console.log(`[visual-check] No baseline for "${testName}" (project: ${projectId ?? 'none'}) — saving current as baseline`);
		saveSnapshot(testName, screenshotBuffer, 'baseline', undefined, projectId);
		writeResult({
			testName, buildId, status: 'pending',
			diffPercent: 0, diffPixels: 0,
			currentPath:  bPath,
			baselinePath: `current/${buildId}/${testName}.png`,
			viewport, timestamp,
		});
		recalculateBuildStatus(buildId, readResults());
		return;
	}

	// ── 9. Diff ────────────────────────────────────────────────────────────────
	const baselineBuffer = fs.readFileSync(paths.baseline);
	const diffResult     = runDiff(baselineBuffer, screenshotBuffer, paths.diff);
	const status         = diffResult.diffPercent < 1.0 ? 'pass' : 'fail';

	// ── 10. DOM label lookup ───────────────────────────────────────────────────
	let diffRegions = await annotateDomLabels(page, diffResult.regions, viewport);

	// ── 11. Figma node label lookup — load tree from project-scoped path ───────
	diffRegions = annotateFigmaLabels(testName, diffRegions, projectId);

	// ── 12. Write result ───────────────────────────────────────────────────────
	writeResult({
		testName, buildId, status,
		diffPercent: diffResult.diffPercent,
		diffPixels:  diffResult.diffPixels,
		currentPath:  bPath,                               // Figma PNG → LEFT panel
		baselinePath: `current/${buildId}/${testName}.png`, // web PNG  → RIGHT panel
		diffPath:     `diffs/${buildId}/${testName}.png`,
		viewport, timestamp,
		diffRegions: diffRegions.length > 0 ? diffRegions : undefined,
	});

	// ── 13. Update build counters ──────────────────────────────────────────────
	recalculateBuildStatus(buildId, readResults());

	if (status === 'fail') {
		console.log(
			`[visual-check] FAIL: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff ` +
			`(${diffResult.diffPixels.toLocaleString()} px · ${diffRegions.length} region${diffRegions.length !== 1 ? 's' : ''})`,
		);
		diffRegions.forEach((r) => {
			const dom   = r.domLabel   ? ` DOM: ${r.domLabel}`     : '';
			const figma = r.figmaLabel ? ` Figma: ${r.figmaLabel}` : '';
			console.log(`  Region ${r.index + 1}: ${r.diffPixels}px at (${r.x},${r.y}) ${r.width}×${r.height}${dom}${figma}`);
		});
	} else {
		console.log(`[visual-check] PASS: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff`);
	}
}

// ─── Figma label lookup ───────────────────────────────────────────────────────

function annotateFigmaLabels(
	testName:  string,
	regions:   DiffRegion[],
	projectId?: string,
): DiffRegion[] {
	if (regions.length === 0) return regions;

	const tree = loadFigmaNodeTree(testName, projectId);
	if (!tree) {
		console.warn(`[visual-check] No Figma node tree for "${testName}" (project: ${projectId ?? 'none'}) — pull Figma baselines to enable Figma labels`);
		return regions;
	}

	return regions.map((region) => {
		const node = findFigmaNodeForRegion(tree, region);
		if (!node) return region;
		const figmaLabel = node.type !== 'TEXT' && node.type !== 'INSTANCE'
			? `${node.name} (${node.type})`
			: node.name;
		return { ...region, figmaLabel };
	});
}

// ─── DOM label lookup ─────────────────────────────────────────────────────────

async function annotateDomLabels(
	page:     Page,
	regions:  DiffRegion[],
	viewport: { width: number; height: number },
): Promise<DiffRegion[]> {
	if (regions.length === 0) return regions;

	const annotated = [...regions];
	const limit     = Math.min(annotated.length, MAX_DOM_LOOKUPS);

	for (let i = 0; i < limit; i++) {
		const region = annotated[i];
		const cx = Math.round(region.x + region.width  / 2);
		const cy = Math.round(region.y + region.height / 2);

		if (cx < 0 || cy < 0 || cx >= viewport.width || cy >= viewport.height) continue;

		try {
			const label = await page.evaluate(
				({ x, y }: { x: number; y: number }) => {
					const el = document.elementFromPoint(x, y);
					if (!el || el === document.documentElement || el === document.body) return null;

					const tag     = el.tagName.toLowerCase();
					const id      = el.id ? `#${el.id}` : '';
					const classes = Array.from(el.classList).slice(0, 2).map((c) => `.${c}`).join('');
					const role    = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';
					const raw     = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
					const text    = raw ? ` — "${raw.slice(0, 50)}${raw.length > 50 ? '…' : ''}"` : '';

					return `${tag}${id}${classes}${role}${text}`;
				},
				{ x: cx, y: cy },
			);
			if (label) annotated[i] = { ...region, domLabel: label };
		} catch (err) {
			console.warn(`[visual-check] DOM lookup failed for region ${i}: ${err}`);
		}
	}

	return annotated;
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureScreenshot(page: Page, options: VisualTestOptions): Promise<Buffer> {
	if (options.selector) {
		const buf = await page.locator(options.selector).screenshot({ type: 'png' });
		return Buffer.from(buf);
	}
	if (options.clip) {
		const buf = await page.screenshot({ type: 'png', clip: options.clip });
		return Buffer.from(buf);
	}
	const buf = await page.screenshot({ type: 'png', fullPage: false });
	return Buffer.from(buf);
}