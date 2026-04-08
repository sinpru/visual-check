import { test } from '@playwright/test';
import { visualTest } from '../helpers/visualTest';

test.describe('Homepage Visual Tests', () => {
  test('homepage hero', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await visualTest(page, 'homepage-hero');
  });
});
