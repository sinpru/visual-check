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
import { figmaNodes } from './figmaNodes';
import fs from 'fs';

/**
 * Options for the visualTest helper.
 */
interface VisualTestOptions {
  /** CSS selector for element-level screenshot instead of full page */
  selector?: string;
  /** Crop region for the screenshot */
  clip?: { x: number; y: number; width: number; height: number };
  /** If true, writes directly to baselines and skips diff */
  updateBaseline?: boolean;
}

/**
 * The core visual test helper. Every visual test file calls this function.
 *
 * Pipeline:
 * 1.  Register/retrieve the build record in builds.json (idempotent)
 * 2.  Suppress CSS animations/transitions
 * 3.  Normalize scroll state
 * 4.  Wait for networkidle
 * 5.  Capture screenshot (full page, element, or clipped)
 * 6.  Save to current/{buildId}/{testName}.png
 * 7.  If updateBaseline → save to baselines/ and write pending status, stop
 * 8.  If no baseline exists → save as baseline, mark pending, stop
 * 9.  Run pixel diff against baseline (baselines/{testName}.png vs web screenshot)
 * 10. Determine pass/fail (diffPercent < 1.0 → pass)
 * 11. Write result to results.json
 * 12. Recalculate build-level status
 *
 * NOTE on path naming in writeResult:
 *   DiffViewer shows  currentPath  as "Baseline / Expected" (LEFT  = Figma frame)
 *   DiffViewer shows  baselinePath as "Current  / Actual"   (RIGHT = web screenshot + diff overlay)
 *   So we intentionally swap the conventional names here to match that display logic.
 */
export async function visualTest(
  page: Page,
  testName: string,
  options: VisualTestOptions = {},
): Promise<void> {
  const updateBaseline =
    options.updateBaseline ?? process.env.UPDATE_BASELINE === 'true';

  // Build ID is set by the API route that triggered this run; fall back to timestamp
  const buildId   = process.env.BUILD_ID   || `build_${Date.now()}`;
  // Project ID is set by the same API route so the build appears under the right project
  const projectId = process.env.PROJECT_ID || undefined;

  // ── 1. Register build (idempotent — safe to call once per test in the same run) ──
  getOrCreateBuild(buildId, {
    projectId,
    branch: 'web',
    status: 'unreviewed',
  });

  const paths    = getPaths(testName, buildId);
  const viewport = page.viewportSize() || { width: 1440, height: 900 };
  const timestamp = new Date().toISOString();

  // ── 2. Suppress CSS animations / transitions ──
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });

  // ── 3. Normalize scroll state ──
  await page.evaluate(() => window.scrollTo(0, 0));

  // ── 4. Wait for networkidle ──
  await page.waitForLoadState('networkidle');

  // ── 5. Capture screenshot ──
  const screenshotBuffer = await captureScreenshot(page, options);

  // ── 6. Save to current/{buildId}/{testName}.png ──
  saveSnapshot(testName, screenshotBuffer, 'current', buildId);

  // ── 7. updateBaseline mode ──
  if (updateBaseline) {
    const nodeId = figmaNodes[testName];
    if (nodeId) {
      const figmaToken   = process.env.FIGMA_TOKEN;
      const figmaFileKey = process.env.FIGMA_FILE_KEY;

      if (figmaToken && figmaFileKey) {
        try {
          const figmaBuffer = await fetchFigmaBaseline(
            figmaFileKey, nodeId, figmaToken, viewport.width, viewport.height,
          );
          saveSnapshot(testName, figmaBuffer, 'baseline');
        } catch (error) {
          console.warn(`[visual-check] Failed to fetch Figma baseline for "${testName}": ${error}`);
          console.warn(`[visual-check] Falling back to current screenshot as baseline`);
          saveSnapshot(testName, screenshotBuffer, 'baseline');
        }
      } else {
        console.warn(`[visual-check] FIGMA_TOKEN or FIGMA_FILE_KEY not set — using current screenshot as baseline`);
        saveSnapshot(testName, screenshotBuffer, 'baseline');
      }
    } else {
      console.warn(`[visual-check] No Figma node mapping for "${testName}" — using current screenshot as baseline`);
      saveSnapshot(testName, screenshotBuffer, 'baseline');
    }

    writeResult({
      testName, buildId,
      status: 'pending',
      diffPercent: 0, diffPixels: 0,
      // Swap: currentPath = Figma/baselines (shown LEFT), baselinePath = web (shown RIGHT)
      currentPath:  `baselines/${testName}.png`,
      baselinePath: `current/${buildId}/${testName}.png`,
      viewport, timestamp,
    });

    recalculateBuildStatus(buildId, readResults());
    return;
  }

  // ── 8. No baseline yet → save current as baseline, mark pending ──
  if (!fs.existsSync(paths.baseline)) {
    console.log(`[visual-check] No baseline found for "${testName}" — saving current as baseline`);
    saveSnapshot(testName, screenshotBuffer, 'baseline');

    writeResult({
      testName, buildId,
      status: 'pending',
      diffPercent: 0, diffPixels: 0,
      currentPath:  `baselines/${testName}.png`,
      baselinePath: `current/${buildId}/${testName}.png`,
      viewport, timestamp,
    });

    recalculateBuildStatus(buildId, readResults());
    return;
  }

  // ── 9. Run pixel diff — Figma baseline vs web screenshot ──
  const baselineBuffer = fs.readFileSync(paths.baseline);
  const diffResult = runDiff(baselineBuffer, screenshotBuffer, paths.diff);

  // ── 10. pass if diffPercent < 1.0 ──
  const status = diffResult.diffPercent < 1.0 ? 'pass' : 'fail';

  // ── 11. Write result ──
  writeResult({
    testName, buildId,
    status,
    diffPercent: diffResult.diffPercent,
    diffPixels:  diffResult.diffPixels,
    // Swap: currentPath = baselines/{testName}.png (Figma) → DiffViewer shows LEFT as "Baseline Expected"
    //       baselinePath = current/{buildId}/{testName}.png (web) → DiffViewer shows RIGHT as "Current Actual"
    //       diffPath overlay goes on RIGHT panel (web), which is correct
    currentPath:  `baselines/${testName}.png`,
    baselinePath: `current/${buildId}/${testName}.png`,
    diffPath:     `diffs/${buildId}/${testName}.png`,
    viewport, timestamp,
  });

  // ── 12. Update build-level counters and status ──
  recalculateBuildStatus(buildId, readResults());

  if (status === 'fail') {
    console.log(`[visual-check] FAIL: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff (${diffResult.diffPixels} pixels)`);
  } else {
    console.log(`[visual-check] PASS: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff`);
  }
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureScreenshot(page: Page, options: VisualTestOptions): Promise<Buffer> {
  if (options.selector) {
    const element = page.locator(options.selector);
    const buffer = await element.screenshot({ type: 'png' });
    return Buffer.from(buffer);
  }

  if (options.clip) {
    const buffer = await page.screenshot({ type: 'png', clip: options.clip });
    return Buffer.from(buffer);
  }

  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  return Buffer.from(buffer);
}