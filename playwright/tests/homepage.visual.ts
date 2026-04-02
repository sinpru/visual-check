import { test } from '@playwright/test';
import { visualTest } from '../helpers/visualTest';

test.describe('Homepage Visual Tests', () => {
  test('homepage', async ({ page }) => {
    // Uses baseURL from playwright.config.ts (set via BASE_URL env var)
    await page.goto('/');
    await visualTest(page, 'homepage');
  });
});