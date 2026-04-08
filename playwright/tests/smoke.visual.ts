/**
 * Smoke test — verifies Playwright screenshot capture works independently
 * of @visual-check/core. Tests viewport locking, animation suppression,
 * and all three screenshot modes (full page, element, clipped).
 *
 * Run with: npx playwright test tests/smoke.visual.ts
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SMOKE_OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'snapshots', 'smoke');

test.beforeAll(() => {
  fs.mkdirSync(SMOKE_OUTPUT_DIR, { recursive: true });
});

test.describe('Playwright Smoke Tests (no core dependency)', () => {
  test('viewport is locked to 1440x900', async ({ page }) => {
    await page.goto('https://example.com');
    const viewportSize = page.viewportSize();
    expect(viewportSize).toEqual({ width: 1440, height: 900 });
  });

  test('full page screenshot capture', async ({ page }) => {
    await page.goto('https://example.com');

    // Inject animation suppression (same as visualTest helper)
    await page.addStyleTag({
      content:
        '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForLoadState('networkidle');

    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    const outPath = path.join(SMOKE_OUTPUT_DIR, 'full-page.png');
    fs.writeFileSync(outPath, buffer);

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(fs.existsSync(outPath)).toBe(true);

    const sizeKB = (buffer.byteLength / 1024).toFixed(1);
    console.log(`✅ Full page screenshot saved: ${outPath} (${sizeKB} KB)`);
  });

  test('element screenshot capture', async ({ page }) => {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const element = page.locator('h1');
    await expect(element).toBeVisible();

    const buffer = await element.screenshot({ type: 'png' });
    const outPath = path.join(SMOKE_OUTPUT_DIR, 'element-h1.png');
    fs.writeFileSync(outPath, buffer);

    expect(buffer.byteLength).toBeGreaterThan(0);
    console.log(
      `✅ Element screenshot saved: ${outPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
    );
  });

  test('clipped screenshot capture', async ({ page }) => {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const buffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 800, height: 400 },
    });
    const outPath = path.join(SMOKE_OUTPUT_DIR, 'clipped-region.png');
    fs.writeFileSync(outPath, buffer);

    expect(buffer.byteLength).toBeGreaterThan(0);
    console.log(
      `✅ Clipped screenshot saved: ${outPath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
    );
  });

  test('deviceScaleFactor is 1x (correct pixel dimensions)', async ({ page }) => {
    await page.goto('https://example.com');
    const buffer = await page.screenshot({ type: 'png', fullPage: false });

    // Parse PNG header to verify dimensions match viewport (not 2x retina)
    // PNG width is at bytes 16-19, height at bytes 20-23 (big-endian)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    expect(width).toBe(1440);
    expect(height).toBe(900);
    console.log(`✅ Screenshot dimensions: ${width}×${height} (1x scale confirmed)`);
  });
});
