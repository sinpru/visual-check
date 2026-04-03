import type { Page } from '@playwright/test';
import {
  saveSnapshot,
  getPaths,
  runDiff,
  writeResult,
  fetchFigmaBaseline,
  getOrCreateBuild,
  recalculateBuildStatus,
  readResults,
} from '@visual-check/core';
import type { DiffRegion } from '@visual-check/core';
import { figmaNodes } from './figmaNodes';
import fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VisualTestOptions {
  /** CSS selector for element-level screenshot instead of full page */
  selector?: string;
  /** Crop region for the screenshot */
  clip?: { x: number; y: number; width: number; height: number };
  /** If true, saves current as baseline and writes pending result */
  updateBaseline?: boolean;
}

/**
 * How many regions to do DOM lookup for.
 * runDiff caps total regions at 15; DOM lookups are limited to the top 10 by
 * size to bound the number of page.evaluate round-trips per test.
 */
const MAX_DOM_LOOKUPS = 10;

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Steps:
 * 1.  getOrCreateBuild — register build (idempotent across tests in same Playwright run)
 * 2.  Suppress CSS animations/transitions
 * 3.  Normalize scroll
 * 4.  waitForLoadState('networkidle')
 * 5.  Capture screenshot (full page, selector, or clip)
 * 6.  Save to current/{buildId}/{testName}.png
 * 7.  [updateBaseline] save Figma or current as baseline → write pending, stop
 * 8.  [no baseline] save current as baseline → write pending, stop
 * 9.  runDiff(figmaBaseline, webScreenshot) → DiffResult with regions[]
 * 10. DOM lookup for each region center → attaches domLabel
 * 11. writeResult with diffRegions
 * 12. recalculateBuildStatus
 *
 * NOTE on path naming (see AGENTS.md — the swap is intentional):
 *   currentPath  → Figma frame (shown LEFT  as "Baseline / Expected")
 *   baselinePath → web screenshot (shown RIGHT as "Current / Actual" + diff overlay)
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

  // ── 1. Register build ──────────────────────────────────────────────────────
  getOrCreateBuild(buildId, { projectId, branch: 'web', status: 'unreviewed' });

  const paths     = getPaths(testName, buildId);
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
        saveSnapshot(testName, figmaBuffer, 'baseline');
      } catch (err) {
        console.warn(`[visual-check] Figma fetch failed for "${testName}": ${err} — using screenshot`);
        saveSnapshot(testName, screenshotBuffer, 'baseline');
      }
    } else {
      if (nodeId) console.warn(`[visual-check] FIGMA_TOKEN or FIGMA_FILE_KEY not set — using screenshot`);
      else console.warn(`[visual-check] No Figma node mapping for "${testName}" — using screenshot`);
      saveSnapshot(testName, screenshotBuffer, 'baseline');
    }
    writeResult({
      testName, buildId, status: 'pending',
      diffPercent: 0, diffPixels: 0,
      currentPath:  `baselines/${testName}.png`,
      baselinePath: `current/${buildId}/${testName}.png`,
      viewport, timestamp,
    });
    recalculateBuildStatus(buildId, readResults());
    return;
  }

  // ── 8. No baseline yet ─────────────────────────────────────────────────────
  if (!fs.existsSync(paths.baseline)) {
    console.log(`[visual-check] No baseline for "${testName}" — saving current as baseline`);
    saveSnapshot(testName, screenshotBuffer, 'baseline');
    writeResult({
      testName, buildId, status: 'pending',
      diffPercent: 0, diffPixels: 0,
      currentPath:  `baselines/${testName}.png`,
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

  // ── 10. Annotate regions with DOM labels ───────────────────────────────────
  // The page is still live after screenshot, so elementFromPoint works.
  // deviceScaleFactor = 1, so image px == CSS px == viewport coordinates.
  const diffRegions = await annotateDomLabels(page, diffResult.regions, viewport);

  // ── 11. Write result ───────────────────────────────────────────────────────
  writeResult({
    testName, buildId, status,
    diffPercent: diffResult.diffPercent,
    diffPixels:  diffResult.diffPixels,
    currentPath:  `baselines/${testName}.png`,
    baselinePath: `current/${buildId}/${testName}.png`,
    diffPath:     `diffs/${buildId}/${testName}.png`,
    viewport, timestamp,
    diffRegions: diffRegions.length > 0 ? diffRegions : undefined,
  });

  // ── 12. Update build counters ──────────────────────────────────────────────
  recalculateBuildStatus(buildId, readResults());

  if (status === 'fail') {
    console.log(
      `[visual-check] FAIL: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff ` +
      `(${diffResult.diffPixels.toLocaleString()} px · ${diffRegions.length} region${diffRegions.length !== 1 ? 's' : ''})`,
    );
    diffRegions.forEach((r) => {
      const loc = r.domLabel ? ` → ${r.domLabel}` : '';
      console.log(`  Region ${r.index + 1}: ${r.diffPixels}px at (${r.x},${r.y}) ${r.width}×${r.height}${loc}`);
    });
  } else {
    console.log(`[visual-check] PASS: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff`);
  }
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
    const cx = Math.round(region.x + region.width  / 2);
    const cy = Math.round(region.y + region.height / 2);

    // Guard against centers outside the captured viewport
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