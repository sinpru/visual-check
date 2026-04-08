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
	generateBatchRegionLabels,
	getBaselineDimensions,
	logger,
} from '@visual-check/core';
import type { DiffRegion } from '@visual-check/core';
import { figmaNodes } from './figmaNodes';
import fs from 'fs';

const log = logger.child('playwright');

// ─── Types ────────────────────────────────────────────────────────────────────

interface VisualTestOptions {
	selector?: string;
	clip?: { x: number; y: number; width: number; height: number };
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

	const buildId = process.env.BUILD_ID || `build_${Date.now()}`;
	const projectId = process.env.PROJECT_ID || undefined;

	// ── 0. JWT injection ───────────────────────────────────────────────────────
	const authJwt = process.env.AUTH_JWT;
	const authJwtKey = process.env.AUTH_JWT_KEY || 'token';

	if (authJwt) {
		await page.addInitScript(
			({ key, value }: { key: string; value: string }) => {
				localStorage.setItem(key, value);
			},
			{ key: authJwtKey, value: authJwt },
		);
		log.info(`JWT injected into localStorage["${authJwtKey}"]`);
	}

	// ── 1. Register build ──────────────────────────────────────────────────────
	getOrCreateBuild(buildId, {
		projectId,
		branch: 'web',
		status: 'unreviewed',
	});

	const paths = getPaths(testName, buildId, projectId);
	const bPath = baselineRelPath(testName, projectId);
	let viewport = page.viewportSize() || { width: 1440, height: 900 };
	const timestamp = new Date().toISOString();

	log.info(`Starting visual test: "${testName}" (build: ${buildId})`);

	// ── 2. Suppress animations ─────────────────────────────────────────────────
	log.debug(`Suppressing animations, transitions, and hiding layout banner for "${testName}"`);
	await page.addStyleTag({
		content: `
			*, *::before, *::after { animation: none !important; transition: none !important; }
			.layout-banner { display: none !important; }
		`,
	});

	// ── 3. Normalize scroll ────────────────────────────────────────────────────
	log.debug(`Normalizing scroll for "${testName}"`);
	await page.evaluate(() => window.scrollTo(0, 0));

	// ── 4. Wait for network ────────────────────────────────────────────────────
	log.debug(`Waiting for network idle for "${testName}"`);
	await page.waitForLoadState('networkidle');

	// ── 4b. Match Viewport to Baseline ─────────────────────────────────────────
	if (!updateBaseline) {
		const dimensions = await getBaselineDimensions(testName, projectId);
		if (dimensions) {
			log.debug(
				`Adjusting viewport for "${testName}" to match baseline: ${dimensions.width}×${dimensions.height}`,
			);
			await page.setViewportSize(dimensions);
			// Wait a bit to ensure layout is updated
			await page.waitForTimeout(500);
			viewport = page.viewportSize() || dimensions;
		}
	}

	// ── 5 & 6. Screenshot + save ───────────────────────────────────────────────
	log.debug(`Capturing screenshot for "${testName}"`);
	const screenshotBuffer = await captureScreenshot(page, options);
	saveSnapshot(testName, screenshotBuffer, 'current', buildId);

	// ── 7. updateBaseline mode ─────────────────────────────────────────────────
	if (updateBaseline) {
		log.info(`Updating baseline for "${testName}"...`);
		const nodeId = figmaNodes[testName];
		if (nodeId && process.env.FIGMA_TOKEN && process.env.FIGMA_FILE_KEY) {
			try {
				const figmaBuffer = await fetchFigmaBaseline(
					process.env.FIGMA_FILE_KEY,
					nodeId,
					process.env.FIGMA_TOKEN,
					viewport.width,
					viewport.height,
				);
				saveSnapshot(
					testName,
					figmaBuffer,
					'baseline',
					undefined,
					projectId,
				);
				log.info(`Saved Figma baseline for "${testName}"`);
			} catch (err) {
				log.warn(
					`Figma fetch failed for "${testName}": ${err} — using screenshot as baseline instead`,
				);
				saveSnapshot(
					testName,
					screenshotBuffer,
					'baseline',
					undefined,
					projectId,
				);
			}
		} else {
			if (nodeId)
				log.warn(
					`FIGMA_TOKEN or FIGMA_FILE_KEY not set — using screenshot as baseline`,
				);
			else
				log.warn(
					`No Figma node mapping for "${testName}" — using screenshot as baseline`,
				);
			saveSnapshot(
				testName,
				screenshotBuffer,
				'baseline',
				undefined,
				projectId,
			);
		}
		writeResult({
			testName,
			buildId,
			status: 'pending',
			diffPercent: 0,
			diffPixels: 0,
			currentPath: bPath,
			baselinePath: `current/${buildId}/${testName}.png`,
			viewport,
			timestamp,
		});
		recalculateBuildStatus(buildId, readResults());
		return;
	}

	// ── 8. No baseline yet ─────────────────────────────────────────────────────
	if (!fs.existsSync(paths.baseline)) {
		log.info(`No baseline for "${testName}" — saving current as baseline`);
		saveSnapshot(
			testName,
			screenshotBuffer,
			'baseline',
			undefined,
			projectId,
		);
		writeResult({
			testName,
			buildId,
			status: 'pending',
			diffPercent: 0,
			diffPixels: 0,
			currentPath: bPath,
			baselinePath: `current/${buildId}/${testName}.png`,
			viewport,
			timestamp,
		});
		recalculateBuildStatus(buildId, readResults());
		return;
	}

	// ── 9. Diff ────────────────────────────────────────────────────────────────
	const baselineBuffer = fs.readFileSync(paths.baseline);

	let diffResult;
	try {
		diffResult = runDiff(baselineBuffer, screenshotBuffer, paths.diff);
	} catch (err) {
		log.error(
			`Diff failed for "${testName}": ${err instanceof Error ? err.message : String(err)}`,
		);
		writeResult({
			testName,
			buildId,
			status: 'fail',
			diffPercent: 100,
			diffPixels: 999999, // Arbitrary high number to indicate critical failure
			currentPath: bPath,
			baselinePath: `current/${buildId}/${testName}.png`,
			viewport,
			timestamp,
		});
		recalculateBuildStatus(buildId, readResults());
		return;
	}

	const status = diffResult.diffPercent < 1.0 ? 'pass' : 'fail';

	// ── 10. DOM label lookup ───────────────────────────────────────────────────
	let diffRegions = await annotateDomLabels(
		page,
		diffResult.regions,
		viewport,
	);

	// ── 11. Figma node label lookup — load tree from project-scoped path ───────
	diffRegions = annotateFigmaLabels(testName, diffRegions, projectId);

	// ── 11b. AI Label Generation ───────────────────────────────────────────────
	if (diffRegions.length > 0) {
		log.info(
			`Generating AI labels for ${diffRegions.length} region${diffRegions.length !== 1 ? 's' : ''}...`,
		);
		try {
			const timeoutPromise = new Promise<string[]>((_, reject) =>
				setTimeout(
					() => reject(new Error('AI batch generation timed out')),
					30000,
				),
			);
			const labels = await Promise.race([
				generateBatchRegionLabels(diffRegions),
				timeoutPromise,
			]);

			for (let i = 0; i < diffRegions.length; i++) {
				diffRegions[i].aiLabel = labels[i] || 'Visual discrepancy';
				log.debug(
					`Generated AI label for region ${diffRegions[i].index}: ${diffRegions[i].aiLabel}`,
				);
			}
		} catch (err) {
			log.error(`Failed to generate batch AI labels`, { error: err });
			diffRegions.forEach((region) => {
				region.aiLabel = 'Label generation failed';
			});
		}
		log.info(`Finished AI label generation for "${testName}"`);
	}

	// ── 12. Write result ───────────────────────────────────────────────────────
	writeResult({
		testName,
		buildId,
		status,
		diffPercent: diffResult.diffPercent,
		diffPixels: diffResult.diffPixels,
		currentPath: bPath,
		baselinePath: `current/${buildId}/${testName}.png`,
		diffPath: `diffs/${buildId}/${testName}.png`,
		viewport,
		timestamp,
		diffRegions: diffRegions.length > 0 ? diffRegions : undefined,
	});

	// ── 13. Update build counters ──────────────────────────────────────────────
	recalculateBuildStatus(buildId, readResults());

	if (status === 'fail') {
		log.warn(
			`FAIL: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff ` +
				`(${diffResult.diffPixels.toLocaleString()} px · ${diffRegions.length} region${diffRegions.length !== 1 ? 's' : ''})`,
		);
		diffRegions.forEach((r) => {
			const dom = r.domLabel ? ` DOM: ${r.domLabel}` : '';
			const figma = r.figmaLabel ? ` Figma: ${r.figmaLabel}` : '';
			log.debug(
				`  Region ${r.index + 1}: ${r.diffPixels}px at (${r.x},${r.y}) ${r.width}×${r.height}${dom}${figma}`,
			);
		});
	} else {
		log.info(
			`PASS: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff`,
		);
	}
}

// ─── Figma label lookup ───────────────────────────────────────────────────────

/**
 * Loads the saved Figma node tree for this testName and, for each region,
 * finds the deepest overlapping Figma node.
 *
 * Synchronous — no API calls. Reads the .figma.json saved at baseline-pull time.
 * Gracefully skips if the file doesn't exist.
 */
function annotateFigmaLabels(
	testName: string,
	regions: DiffRegion[],
	projectId?: string,
): DiffRegion[] {
	if (regions.length === 0) return regions;

	const tree = loadFigmaNodeTree(testName, projectId);
	if (!tree) {
		log.warn(
			`No Figma node tree for "${testName}" — pull Figma baselines via the dashboard to enable Figma labels`,
		);
		return regions;
	}

	return regions.map((region) => {
		const node = findFigmaNodeForRegion(tree, region);
		if (!node) return region;
		// Format: "ComponentName (TYPE)" e.g. "CTA Button (COMPONENT)"
		const figmaLabel =
			node.type !== 'TEXT' && node.type !== 'INSTANCE'
				? `${node.name} (${node.type})`
				: node.name;

		const figmaMetrics: Record<string, string | number> = {};
		if (node.absoluteBoundingBox) {
			figmaMetrics.width = Math.round(node.absoluteBoundingBox.width);
			figmaMetrics.height = Math.round(node.absoluteBoundingBox.height);
		}
		if (node.characters) {
			figmaMetrics.text =
				node.characters.length > 50
					? `${node.characters.slice(0, 50)}…`
					: node.characters;
		}
		if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
			const fill = node.fills[0];
			if (fill.type === 'SOLID' && fill.color) {
				const r = Math.round(fill.color.r * 255);
				const g = Math.round(fill.color.g * 255);
				const b = Math.round(fill.color.b * 255);
				const a = fill.color.a ?? 1;
				const colorString =
					a < 1
						? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
						: `rgb(${r}, ${g}, ${b})`;
				if (node.type === 'TEXT') {
					figmaMetrics.color = colorString;
				} else {
					figmaMetrics.backgroundColor = colorString;
				}
			}
		}
		if (node.style) {
			if (node.style.fontSize)
				figmaMetrics.fontSize = `${node.style.fontSize}px`;
			if (node.style.fontWeight)
				figmaMetrics.fontWeight = node.style.fontWeight;
			if (node.style.fontFamily)
				figmaMetrics.fontFamily = node.style.fontFamily;
			if (node.style.letterSpacing)
				figmaMetrics.letterSpacing = `${node.style.letterSpacing}px`;
			if (node.style.lineHeightPx)
				figmaMetrics.lineHeight = `${node.style.lineHeightPx}px`;
			if (node.style.textAlignHorizontal)
				figmaMetrics.textAlign =
					node.style.textAlignHorizontal.toLowerCase();
		}

		return { ...region, figmaLabel, figmaMetrics };
	});
}

// ─── DOM label lookup ─────────────────────────────────────────────────────────

async function annotateDomLabels(
	page: Page,
	regions: DiffRegion[],
	viewport: { width: number; height: number },
): Promise<DiffRegion[]> {
	if (regions.length === 0) return regions;

	const annotated = [...regions];
	const limit = Math.min(annotated.length, MAX_DOM_LOOKUPS);

	for (let i = 0; i < limit; i++) {
		const region = annotated[i];
		const cx = Math.round(region.x + region.width / 2);
		const cy = Math.round(region.y + region.height / 2);

		if (cx < 0 || cy < 0 || cx >= viewport.width || cy >= viewport.height)
			continue;

		try {
			const result = await page.evaluate(
				({ x, y }: { x: number; y: number }) => {
					const el = document.elementFromPoint(x, y);
					if (
						!el ||
						el === document.documentElement ||
						el === document.body
					)
						return null;

					const tag = el.tagName.toLowerCase();
					const id = el.id ? `#${el.id}` : '';
					const classes = Array.from(el.classList)
						.slice(0, 2)
						.map((c) => `.${c}`)
						.join('');
					const role = el.getAttribute('role')
						? `[role="${el.getAttribute('role')}"]`
						: '';

					const textContent =
						tag === 'input' || tag === 'textarea'
							? (el as HTMLInputElement | HTMLTextAreaElement)
									.value
							: el.textContent;
					const raw = (textContent ?? '').replace(/\s+/g, ' ').trim();
					const text = raw
						? ` — "${raw.slice(0, 50)}${raw.length > 50 ? '…' : ''}"`
						: '';

					const rect = el.getBoundingClientRect();
					const style = window.getComputedStyle(el);

					const domMetrics: Record<string, string | number> = {
						width: Math.round(rect.width),
						height: Math.round(rect.height),
						color: style.color,
						backgroundColor: style.backgroundColor,
						fontSize: style.fontSize,
						fontWeight: style.fontWeight,
						fontFamily: style.fontFamily,
						lineHeight: style.lineHeight,
						letterSpacing: style.letterSpacing,
						textAlign: style.textAlign,
					};

					if (raw) {
						domMetrics.text =
							raw.length > 50 ? `${raw.slice(0, 50)}…` : raw;
					}

					return {
						label: `${tag}${id}${classes}${role}${text}`,
						metrics: domMetrics,
					};
				},
				{ x: cx, y: cy },
			);

			if (result) {
				annotated[i] = {
					...region,
					domLabel: result.label,
					domMetrics: result.metrics,
				};
			}
		} catch (err) {
			log.warn(`DOM lookup failed for region ${i}`, { error: err });
		}
	}

	return annotated;
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureScreenshot(
	page: Page,
	options: VisualTestOptions,
): Promise<Buffer> {
	if (options.selector) {
		const buf = await page
			.locator(options.selector)
			.screenshot({ type: 'png' });
		return Buffer.from(buf);
	}
	if (options.clip) {
		const buf = await page.screenshot({ type: 'png', clip: options.clip });
		return Buffer.from(buf);
	}
	const buf = await page.screenshot({ type: 'png', fullPage: false });
	return Buffer.from(buf);
}
