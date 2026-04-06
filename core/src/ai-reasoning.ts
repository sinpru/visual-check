import sharp from 'sharp';
import type { ResultEntry } from './types.ts';

// ─── AI calling logic ────────────────────────────────────────────────────────

async function callAIPovider(
	prompt: string,
	systemPrompt: string,
	images: { base64: string; mimeType: string }[] = [],
	maxTokens = 5000,
): Promise<string> {
	const apiKey = process.env.AI_API_KEY;
	const apiUrl =
		process.env.AI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
	const model = process.env.AI_MODEL ?? 'gpt-4o';

	if (!apiKey) throw new Error('AI_API_KEY is not set in environment');

	const isGoogle = apiUrl.includes('googleapis.com');

	if (isGoogle) {
		// ── Google Gemini API ────────────────────────────────────────────────
		// If the user provided a full model URL, we use it. Otherwise we append :generateContent.
		const endpoint = apiUrl.includes(':generateContent')
			? apiUrl
			: apiUrl.replace(/\/$/, '') +
				(apiUrl.includes('/models/')
					? ':generateContent'
					: `/models/${model}:generateContent`);

		const res = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'x-goog-api-key': apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				contents: [
					{
						role: 'user',
						parts: [
							{ text: systemPrompt },
							...images.map((img) => ({
								inline_data: {
									mime_type: img.mimeType,
									data: img.base64,
								},
							})),
							{ text: prompt },
						],
					},
				],
				generationConfig: {
					maxOutputTokens: maxTokens,
				},
			}),
		});

		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(
				`Gemini API error ${res.status}: ${body.slice(0, 300)}`,
			);
		}

		const data = (await res.json()) as {
			candidates?: { content: { parts: { text: string }[] } }[];
		};
		return (
			data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
			'(no response)'
		);
	} else {
		// ── OpenAI-compatible API ────────────────────────────────────────────
		const res = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model,
				max_tokens: maxTokens,
				messages: [
					{
						role: 'system',
						content: systemPrompt,
					},
					{
						role: 'user',
						content: [
							...images.map((img) => ({
								type: 'image_url' as const,
								image_url: {
									url: `data:${img.mimeType};base64,${img.base64}`,
									detail: 'high' as const,
								},
							})),
							{ type: 'text' as const, text: prompt },
						],
					},
				],
			}),
		});

		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(
				`AI API error ${res.status}: ${body.slice(0, 300)}`,
			);
		}

		const data = (await res.json()) as {
			choices: { message: { content: string } }[];
		};
		return data.choices[0]?.message?.content?.trim() ?? '(no response)';
	}
}

export async function callAI(
	figmaBase64: string,
	webBase64: string,
	prompt: string,
): Promise<string> {
	const systemPrompt =
		'You are a visual QA assistant. You receive two cropped screenshots: ' +
		'the LEFT image is the Figma design (the expected state), and the RIGHT image ' +
		'is the web implementation (the actual state). You are also provided with the EXACT metric diffs. ' +
		'Describe the visual difference clearly. Heavily rely on the provided metrics (Expected vs Actual). ' +
		'Explicitly point out if text is missing, changed, or if there are differences in font size, font weight, color, or dimensions. ' +
		'If the metrics show a difference, state it as a fact even if the images look similar. ' +
		'Keep your explanation concise but thorough. Do not describe what is the same.';

	return callAIPovider(
		prompt,
		systemPrompt,
		[
			{ base64: figmaBase64, mimeType: 'image/png' },
			{ base64: webBase64, mimeType: 'image/png' },
		],
		5000,
	);
}

export async function callAIText(prompt: string): Promise<string> {
	const systemPrompt =
		'You are a visual QA assistant. You evaluate metric differences between Figma (Expected) and Web (Actual). ' +
		'Return a short, punchy 3-8 word summary of the main discrepancy. ' +
		'Examples: "Font weight is too bold", "Text content mismatch", "Width is 20px smaller", "Missing background color". ' +
		'Be specific. Do not say "Visual mismatch" or "UI difference". If multiple things changed, pick the most obvious one.';

	const result = await callAIPovider(prompt, systemPrompt, [], 200);

	if (!result || result.toLowerCase().includes('visual mismatch')) {
		return 'Visual discrepancy';
	}
	return result;
}

// ─── Region Analysis Logic ───────────────────────────────────────────────────

export async function generateRegionLabel(
	region: import('./types.ts').DiffRegion,
): Promise<string> {
	const figma = region.figmaMetrics || {};
	const dom = region.domMetrics || {};

	if (Object.keys(figma).length === 0 && Object.keys(dom).length === 0) {
		return 'Unexpected visual change';
	}

	const prompt = [
		'Compare these metrics and identify the PRIMARY visual discrepancy:',
		`Expected (Figma): ${JSON.stringify(figma)}`,
		`Actual (Web): ${JSON.stringify(dom)}`,
		'',
		'Focus on: Dimensions, Text Content, Font Size/Weight, or Colors.',
	].join('\n');

	return callAIText(prompt);
}

export async function generateRegionDescription(
	result: ResultEntry,
	regionIndex: number,
	figmaPath: string,
	webPath: string,
): Promise<string> {
	const region = result.diffRegions?.find((r) => r.index === regionIndex);
	if (!region) {
		throw new Error(
			`Region ${regionIndex} not found for test "${result.testName}"`,
		);
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
	if (region.domMetrics)
		parts.push(
			`Actual (Web) metrics: ${JSON.stringify(region.domMetrics)}`,
		);
	if (region.figmaMetrics)
		parts.push(
			`Expected (Figma) metrics: ${JSON.stringify(region.figmaMetrics)}`,
		);

	parts.push(
		`Use the provided Expected (Figma) and Actual (Web) metrics to explain exactly what changed in simple terms for a non-technical user. Highlight precise differences in size, color, or text.`,
	);

	// ── Call AI ───────────────────────────────────────────────────────────
	return callAI(
		figmaCrop.toString('base64'),
		webCrop.toString('base64'),
		parts.join('\n'),
	);
}
