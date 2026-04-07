/**
 * saveAuth.mjs — run once to save a logged-in browser session.
 *
 * Usage (from the playwright/ folder):
 *   node helpers/saveAuth.mjs
 *
 * 1. Opens a real Chromium window at BASE_URL
 * 2. Log in — including any QR code / 2FA
 * 3. Press ENTER in this terminal when fully logged in
 * 4. Session saved to snapshots/auth.json
 * 5. All Playwright runs load it automatically from now on
 */

import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env (playwright/ → .. → repo root)
config({ path: path.resolve(__dirname, '..', '..', '.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_PATH = path.resolve(__dirname, '..', '..', 'snapshots', 'auth.json');

fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });

function waitForEnter() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise((resolve) => {
		rl.question('\n  → Press ENTER when login is complete: ', () => {
			rl.close();
			resolve();
		});
	});
}

console.log('\n[save-auth] Opening browser at:', BASE_URL);
console.log('[save-auth] Log in completely (including QR code / 2FA),');
console.log('[save-auth] then come back here and press ENTER.\n');

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

await page.goto(BASE_URL);
await waitForEnter();

await context.storageState({ path: AUTH_PATH });
await browser.close();

console.log(`\n[save-auth] ✓ Session saved to: ${AUTH_PATH}`);
console.log('[save-auth] All Playwright runs will now use this session.\n');
