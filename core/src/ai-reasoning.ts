import sharp from 'sharp';
import type { ResultEntry } from './types.ts';

// ─── AI vision call (OpenAI-compatible) ──────────────────────────────────────

export async function callAI(
	figmaBase64: string,
	webBase64: string,
	prompt: string,
): Promise<string> {
	// All three can be overridden via .env — no code change needed to switch providers.
	const apiKey = process.env.AI_API_KEY;
	const apiUrl =
		process.env.AI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
	const model = process.env.AI_MODEL ?? 'gpt-4o';

	if (!apiKey) throw new Error('AI_API_KEY is not set in environment');

	const res = await fetch(apiUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			max_tokens: 350,
			messages: [
				{
					role: 'system',
					content:
						'You are a visual QA assistant. You receive two cropped screenshots: ' +
						'the LEFT image is the Figma design (the expected state), and the RIGHT image ' +
						'is the web implementation (the actual state). Describe the visual difference ' +
						'concisely and specifically. Focus on: font size, font weight, color, spacing, ' +
						'alignment, missing/extra elements, or position shifts. ' +
						'Keep your answer under 3 sentences. Do not describe what is the same.',
				},
				{
					role: 'user',
					content: [
						{
							type: 'image_url',
							image_url: {
								url: `data:image/png;base64,${figmaBase64}`,
								detail: 'high',
							},
						},
						{
							type: 'image_url',
							image_url: {
								url: `data:image/png;base64,${webBase64}`,
								detail: 'high',
							},
						},
						{ type: 'text', text: prompt },
					],
				},
			],
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`AI API error ${res.status}: ${body.slice(0, 300)}`);
	}

	const data = (await res.json()) as {
		choices: { message: { content: string } }[];
	};

	return data.choices[0]?.message?.content?.trim() ?? '(no response)';
}

// ─── Region Analysis Logic ───────────────────────────────────────────────────

export async function generateRegionDescription(
	result: ResultEntry,
	regionIndex: number,
	figmaPath: string,
	webPath: string,
): Promise<string> {
	const region = result.diffRegions?.find((r) => r.index === regionIndex);
	if (!region) {
		throw new Error(`Region ${regionIndex} not found for test "${result.testName}"`);
	}

	// ── Crop to region bounding box + padding ─────────────────────────────
	const PAD = 16;

	async function cropImage(imagePath: string): Promise<Buffer> {
		const img = sharp(imagePath);
		const meta = await img.metadata();
		const imgW = meta.width ?? result.viewport.width;
		const imgH = meta.height ?? result.viewport.height;

		const left = Math.max(0, region!.x - PAD);
		const top = Math.max(0, region!.y - PAD);
		const width = Math.min(imgW - left, region!.width + PAD * 2);
		const height = Math.min(imgH - top, region!.height + PAD * 2);

		return img.extract({ left, top, width, height }).png().toBuffer();
	}

	const [figmaCrop, webCrop] = await Promise.all([
		cropImage(figmaPath),
		cropImage(webPath),
	]);

	// ── Build prompt ──────────────────────────────────────────────────────
	const parts: string[] = [
		`Region ${regionIndex + 1} of ${result.diffRegions?.length ?? 1}`,
		`Position: (${region.x}, ${region.y})  Size: ${region.width}×${region.height}px`,
		`Changed pixels: ${region.diffPixels.toLocaleString()} (${region.diffPercent.toFixed(2)}% of image)`,
	];
	if (region.domLabel) parts.push(`Web element: ${region.domLabel}`);
	if (region.figmaLabel) parts.push(`Figma node: ${region.figmaLabel}`);

	// ── Call AI ───────────────────────────────────────────────────────────
	return callAI(
		figmaCrop.toString('base64'),
		webCrop.toString('base64'),
		parts.join('\n'),
	);
}
