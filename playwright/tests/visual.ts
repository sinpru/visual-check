/**
 * visual.ts — generic visual regression test runner.
 *
 * Does NOT hardcode any testName or URL path. Instead:
 *   - TEST_NAMES env var (set by the run route) lists every testName to run,
 *     derived directly from the project's Figma baseline PNGs.
 *   - BASE_URL is the root of the app under test.
 *
 * For each testName the test navigates to BASE_URL and takes a full-viewport
 * screenshot. This is the correct default for full-page Figma frames.
 *
 * If a specific testName needs a different URL path or a selector/clip,
 * create a separate *.visual.ts file alongside this one for that override.
 * The run route will still discover its testNames from baselines/ — the
 * override file just controls navigation and capture options for those names.
 */

import { test } from '@playwright/test';
import { visualTest } from '../helpers/visualTest';

// TEST_NAMES is set by /api/projects/[projectId]/run to the comma-separated
// list of baseline PNG filenames (without .png) for this project.
const raw       = process.env.TEST_NAMES ?? '';
const testNames = raw.split(',').map((s) => s.trim()).filter(Boolean);

if (testNames.length === 0) {
  // Guard: if somehow TEST_NAMES is empty, emit one failing test with a clear message
  test('no test names configured', async () => {
    throw new Error(
      'TEST_NAMES env var is empty. Pull Figma baselines for this project first, ' +
      'then re-run from the dashboard.',
    );
  });
} else {
  test.describe('Visual regression', () => {
    for (const testName of testNames) {
      test(testName, async ({ page }) => {
        // Navigate to the base URL — this matches a full-page Figma frame.
        // The storageState (auth) is already applied by playwright.config.ts.
        await page.goto('/');
        await visualTest(page, testName);
      });
    }
  });
}