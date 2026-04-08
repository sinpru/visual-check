import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { saveSnapshot } from '@visual-check/core';

export async function POST(request: NextRequest) {
	let browser;
	try {
		const { url, testName } = await request.json();

		if (!url || !testName) {
			return NextResponse.json(
				{ error: 'url and testName are required fields' },
				{ status: 400 },
			);
		}

		// Launch Chromium headlessly
		browser = await chromium.launch({ headless: true });

		// Create new context with fixed viewport mimicking baseline standards
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
		});

		const page = await context.newPage();

		// 1. Navigate to URL and wait for networkidle
		await page.goto(url, { waitUntil: 'networkidle' });

		// 2. Suppress all CSS animations and transitions, and hide the layout banner before capture
		await page.addStyleTag({
			content: `
				*, *::before, *::after { animation: none !important; transition: none !important; }
				.layout-banner { display: none !important; }
			`,
		});

		// 3. Normalize scroll state
		await page.evaluate(() => window.scrollTo(0, 0));

		// Wait an additional small tick just to ensure layout stability since animations were forcefully killed
		await page.waitForTimeout(500);

		// 4. Capture screenshot
		const screenshotBuffer = await page.screenshot({
			type: 'png',
			fullPage: false,
		});

		// 5. Save using standard core storage helper under 'current' (omitting buildId creates it directly in current/ directory)
		saveSnapshot(testName, screenshotBuffer, 'current');

		return NextResponse.json({
			success: true,
			currentPath: `current/${testName}.png`,
			url,
			testName,
			viewport: { width: 1440, height: 900 },
		});
	} catch (error) {
		console.error('Playwright API Error:', error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: 'Unknown error during capture',
			},
			{ status: 500 },
		);
	} finally {
		if (browser) {
			await browser.close().catch(console.error);
		}
	}
}
