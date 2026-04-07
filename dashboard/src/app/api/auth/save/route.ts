import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser, BrowserContext } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { getSnapshotsDir } from '@visual-check/core';

// Singleton to hold the active browser and context
let activeBrowser: Browser | null = null;
let activeContext: BrowserContext | null = null;

export async function POST(req: NextRequest) {
	try {
		const { action, url } = await req.json();

		if (action === 'start') {
			// Close any existing browser first
			if (activeBrowser) {
				await activeBrowser.close().catch(() => {});
			}

			activeBrowser = await chromium.launch({ headless: false });
			activeContext = await activeBrowser.newContext({
				viewport: { width: 1440, height: 900 },
			});
			const page = await activeContext.newPage();
			await page.goto(url || 'http://localhost:3000');

			return NextResponse.json({ ok: true });
		}

		if (action === 'confirm') {
			if (!activeContext) {
				return NextResponse.json(
					{ error: 'No active session' },
					{ status: 400 },
				);
			}

			const authPath = path.join(getSnapshotsDir(), 'auth.json');
			fs.mkdirSync(path.dirname(authPath), { recursive: true });

			await activeContext.storageState({ path: authPath });
			await activeBrowser?.close();

			activeBrowser = null;
			activeContext = null;

			return NextResponse.json({ ok: true });
		}

		if (action === 'cancel') {
			await activeBrowser?.close().catch(() => {});
			activeBrowser = null;
			activeContext = null;
			return NextResponse.json({ ok: true });
		}

		return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
	} catch (err) {
		console.error('[api/auth/save] Error:', err);
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : String(err) },
			{ status: 500 },
		);
	}
}
