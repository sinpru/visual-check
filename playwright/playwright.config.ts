import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Auth state — saved by `node helpers/saveAuth.mjs`
const AUTH_PATH  = path.resolve(__dirname, '..', 'snapshots', 'auth.json');
const authExists = fs.existsSync(AUTH_PATH);

if (authExists) {
  const ageH = Math.round((Date.now() - fs.statSync(AUTH_PATH).mtimeMs) / 3_600_000 * 10) / 10;
  console.log(`[playwright] Using saved auth session (${ageH}h old)`);
} else {
  console.log('[playwright] No auth.json — running without saved session. Run `node helpers/saveAuth.mjs` to save one.');
}

export default defineConfig({
  testDir: './tests',

  // Matches both the generic `visual.ts` and any legacy `*.visual.ts` files
  testMatch: ['**/visual.ts', '**/*.visual.ts'],

  workers: 1,          // NEVER parallelize — race conditions on results.json
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,

  reporter: [['list']],

  use: {
    viewport: { width: 1920, height: 960 },
    deviceScaleFactor: 1,
    baseURL: process.env.BASE_URL,
    screenshot: 'off',
    actionTimeout:     10_000,
    navigationTimeout: 60_000,
    storageState: authExists ? AUTH_PATH : undefined,
  },

  timeout: 60_000,
});