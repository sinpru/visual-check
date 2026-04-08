import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.visual.ts',

  /* Never run visual tests in parallel — race conditions on results.json */
  workers: 1,
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* No retries for visual tests — flaky retries just mask real diffs */
  retries: 0,

  /* Reporter */
  reporter: [['list']],

  use: {
    /* Must match Figma frame dimensions — 1440×900 is the agreed default */
    viewport: { width: 1440, height: 900 },

    /* Must be 1 — Figma exports at 1x. Retina (2x) doubles pixel dimensions and breaks the diff */
    deviceScaleFactor: 1,

    /* Base URL from environment */
    baseURL: process.env.BASE_URL,

    /* Screenshot settings */
    screenshot: 'off', // We handle screenshots manually via visualTest helper

    /* Timeout settings */
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  /* Global timeout per test */
  timeout: 60_000,
});
