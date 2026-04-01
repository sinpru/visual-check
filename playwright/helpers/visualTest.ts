import type { Page } from '@playwright/test';
import {
  saveSnapshot,
  getPaths,
  runDiff,
  writeResult,
  fetchFigmaBaseline,
} from '@visual-check/core';
import { figmaNodes } from './figmaNodes';
import fs from 'fs';
import path from 'path';

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
 * 1. Suppress CSS animations/transitions
 * 2. Normalize scroll state
 * 3. Wait for networkidle
 * 4. Capture screenshot (full page, element, or clipped)
 * 5. Save to current/{buildId}/{testName}.png
 * 6. If updateBaseline → save to baselines/ and write pending status, stop
 * 7. If no baseline exists → save as baseline, mark pending, stop
 * 8. Run pixel diff against baseline
 * 9. Determine pass/fail (diffPercent < 1.0 → pass)
 * 10. Write result to results.json
 */
export async function visualTest(
  page: Page,
  testName: string,
  options: VisualTestOptions = {},
): Promise<void> {
  const updateBaseline =
    options.updateBaseline ?? process.env.UPDATE_BASELINE === 'true';
  
  // Get buildId from env or generate one (though env is preferred for stable runs)
  const buildId = process.env.BUILD_ID || `build_${Date.now()}`;
  
  const paths = getPaths(testName, buildId);
  const viewport = page.viewportSize() || { width: 1440, height: 900 };
  const timestamp = new Date().toISOString();

  // 1. Suppress all CSS animations and transitions before capture
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });

  // 2. Normalize scroll state
  await page.evaluate(() => window.scrollTo(0, 0));

  // 3. Wait for networkidle to ensure all assets are loaded
  await page.waitForLoadState('networkidle');

  // 4. Capture screenshot
  const screenshotBuffer = await captureScreenshot(page, options);

  // 5. Save to current/{buildId}/{testName}.png
  saveSnapshot(testName, screenshotBuffer, 'current', buildId);

  // 6. If updateBaseline → save to baselines/ and write pending status, stop
  if (updateBaseline) {
    // Optionally fetch from Figma if there's a node mapping
    const nodeId = figmaNodes[testName];
    if (nodeId) {
      const figmaToken = process.env.FIGMA_TOKEN;
      const figmaFileKey = process.env.FIGMA_FILE_KEY;

      if (figmaToken && figmaFileKey) {
        try {
          const figmaBuffer = await fetchFigmaBaseline(
            figmaFileKey,
            nodeId,
            figmaToken,
            viewport.width,
            viewport.height,
          );
          saveSnapshot(testName, figmaBuffer, 'baseline');
        } catch (error) {
          console.warn(
            `[visual-check] Failed to fetch Figma baseline for "${testName}": ${error}`,
          );
          console.warn(
            `[visual-check] Falling back to current screenshot as baseline`,
          );
          saveSnapshot(testName, screenshotBuffer, 'baseline');
        }
      } else {
        console.warn(
          `[visual-check] FIGMA_TOKEN or FIGMA_FILE_KEY not set — using current screenshot as baseline`,
        );
        saveSnapshot(testName, screenshotBuffer, 'baseline');
      }
    } else {
      console.warn(
        `[visual-check] No Figma node mapping for "${testName}" — using current screenshot as baseline`,
      );
      saveSnapshot(testName, screenshotBuffer, 'baseline');
    }

    writeResult({
      testName,
      buildId,
      status: 'pending',
      diffPercent: 0,
      diffPixels: 0,
      baselinePath: `baselines/${testName}.png`,
      currentPath: `current/${buildId}/${testName}.png`,
      viewport,
      timestamp,
    });
    return;
  }

  // 7. Check if baseline exists — if not, save as baseline and mark pending
  if (!fs.existsSync(paths.baseline)) {
    console.log(
      `[visual-check] No baseline found for "${testName}" — saving current as baseline`,
    );
    saveSnapshot(testName, screenshotBuffer, 'baseline');

    writeResult({
      testName,
      buildId,
      status: 'pending',
      diffPercent: 0,
      diffPixels: 0,
      baselinePath: `baselines/${testName}.png`,
      currentPath: `current/${buildId}/${testName}.png`,
      viewport,
      timestamp,
    });
    return;
  }

  // 8. Run pixel diff against baseline
  const baselineBuffer = fs.readFileSync(paths.baseline);
  const diffResult = runDiff(baselineBuffer, screenshotBuffer, paths.diff);

  // 9. Determine pass/fail: diffPercent < 1.0 → pass, else fail
  const status = diffResult.diffPercent < 1.0 ? 'pass' : 'fail';

  // 10. Write result to results.json
  writeResult({
    testName,
    buildId,
    status,
    diffPercent: diffResult.diffPercent,
    diffPixels: diffResult.diffPixels,
    baselinePath: `baselines/${testName}.png`,
    currentPath: `current/${buildId}/${testName}.png`,
    diffPath: `diffs/${buildId}/${testName}.png`,
    viewport,
    timestamp,
  });

  if (status === 'fail') {
    console.log(
      `[visual-check] FAIL: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff (${diffResult.diffPixels} pixels)`,
    );
  } else {
    console.log(
      `[visual-check] PASS: "${testName}" — ${diffResult.diffPercent.toFixed(2)}% diff`,
    );
  }
}

/**
 * Captures a screenshot based on the provided options.
 * Returns the screenshot as a Buffer.
 */
async function captureScreenshot(
  page: Page,
  options: VisualTestOptions,
): Promise<Buffer> {
  if (options.selector) {
    // Element-level screenshot
    const element = page.locator(options.selector);
    const buffer = await element.screenshot({ type: 'png' });
    return Buffer.from(buffer);
  }

  if (options.clip) {
    // Clipped screenshot
    const buffer = await page.screenshot({
      type: 'png',
      clip: options.clip,
    });
    return Buffer.from(buffer);
  }

  // Full page screenshot (viewport-sized, not full scrollable page)
  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  return Buffer.from(buffer);
}
