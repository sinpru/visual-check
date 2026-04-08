import sharp from 'sharp';
import type { ResultEntry } from './types.ts';
import { logger } from './logger.ts';

const log = logger.child('ai');

// ─── AI calling logic ────────────────────────────────────────────────────────

const FALLBACK_MODELS_GEMINI = [
	'gemini-3.1-pro-preview',
	'gemini-3.1-flash-lite-preview',
	'gemini-3-flash-preview',
	'gemini-2.5-flash',
	'gemini-2.0-flash',
	'gemini-1.5-flash',
	'gemini-1.5-pro',
];

const FALLBACK_MODELS_OPENAI = [
	'gpt-4o',
	'gpt-4-turbo',
	'gpt-4',
	'gpt-3.5-turbo',
];

async function callAIPovider(
	prompt: string,
	systemPrompt: string,
	images: { base64: string; mimeType: string }[] = [],
	maxTokens = 5000,
): Promise<string> {
	const apiKey = process.env.AI_API_KEY;
	const apiUrl =
		process.env.AI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
	const baseModel = process.env.AI_MODEL;

	if (!apiKey) {
		log.error('AI_API_KEY is not set in environment');
		throw new Error('AI_API_KEY is not set in environment');
	}

	const isGoogle = apiUrl.includes('googleapis.com');

	const fallbackList = isGoogle
		? FALLBACK_MODELS_GEMINI
		: FALLBACK_MODELS_OPENAI;

	// Ensure we don't duplicate the base model if it's already in the fallback list
	const modelsToTry = baseModel
		? [baseModel, ...fallbackList.filter((m) => m !== baseModel)]
		: fallbackList;

	let lastError: Error | null = null;

	for (const model of modelsToTry) {
		log.debug(
			`Calling AI provider: ${isGoogle ? 'Gemini' : 'OpenAI-compatible'} (model: ${model})`,
		);

		try {
			if (isGoogle) {
				// ── Google Gemini API ────────────────────────────────────────────────
				let endpoint = apiUrl;
				if (!endpoint.includes(':generateContent')) {
					endpoint = endpoint.replace(/\/$/, '');
					if (endpoint.includes('/models/')) {
						// Replace existing model in the URL with the current one from fallback
						endpoint = endpoint.replace(
							/\/models\/[^:/]+/,
							`/models/${model}`,
						);
						if (!endpoint.includes(':generateContent')) {
							endpoint += ':generateContent';
						}
					} else {
						endpoint = `${endpoint}/models/${model}:generateContent`;
					}
				} else {
					// Replace the model part even if it has :generateContent
					endpoint = endpoint.replace(
						/\/models\/[^:/]+:generateContent/,
						`/models/${model}:generateContent`,
					);
				}

				const payload = {
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
				};

				const res = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'x-goog-api-key': apiKey,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(payload),
				});

				if (!res.ok) {
					const body = await res.text().catch(() => '');
					log.warn(
						`Gemini API error ${res.status} with model ${model}`,
						{
							status: res.status,
							body: body.slice(0, 200),
						},
					);

					// If 404 (Not Found), 429 (Rate Limit), or 503 (High Demand), try next model
					if (res.status === 404 || res.status === 429 || res.status === 503) {
						lastError = new Error(
							`Gemini API error ${res.status}: ${body.slice(0, 100)}`,
						);
						continue;
					}

					throw new Error(
						`Gemini API error ${res.status}: ${body.slice(0, 300)}`,
					);
				}

				const data = (await res.json()) as {
					candidates?: { content: { parts: { text: string }[] } }[];
				};
				const text =
					data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
				if (!text) {
					log.warn(
						`Gemini returned empty response for model ${model}`,
						{ data },
					);
					lastError = new Error(`Empty response from ${model}`);
					continue;
				}
				return text;
			} else {
				// ── OpenAI-compatible API ────────────────────────────────────────────
				const payload = {
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
				};

				const res = await fetch(apiUrl, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(payload),
				});

				if (!res.ok) {
					const body = await res.text().catch(() => '');
					log.warn(
						`OpenAI API error ${res.status} with model ${model}`,
						{
							status: res.status,
							body: body.slice(0, 200),
						},
					);

					// If 429 (Rate Limit) or 503 (High Demand), try next model
					if (res.status === 429 || res.status === 503) {
						lastError = new Error(
							`AI API error ${res.status}: ${body.slice(0, 100)}`,
						);
						continue;
					}

					throw new Error(
						`AI API error ${res.status}: ${body.slice(0, 300)}`,
					);
				}

				const data = (await res.json()) as {
					choices: { message: { content: string } }[];
				};
				const text = data.choices[0]?.message?.content?.trim();
				if (!text) {
					log.warn(
						`OpenAI returned empty response for model ${model}`,
						{ data },
					);
					lastError = new Error(`Empty response from ${model}`);
					continue;
				}
				return text;
			}
		} catch (err) {
			log.warn(`Failed to call AI provider with model ${model}`, {
				error: err,
			});
			lastError = err instanceof Error ? err : new Error(String(err));
			// Network error or parsing error, continue to next model
		}
	}

	// If all models failed, throw the last error
	log.error('All fallback models exhausted');
	throw lastError ?? new Error('All AI models failed');
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
		10000,
	);
}

export async function callAIText(prompt: string): Promise<string> {
	const systemPrompt =
		'You are a visual QA assistant. You evaluate metric differences between Figma (Expected) and Web (Actual). ' +
		`Return a short, punchy 3-8 word summary of the main discrepancy. If there's an extra element on the web, mention it. ` +
		'Examples: "Font weight is too bold", "Text content mismatch", "Width is 20px smaller", "Missing background color". ' +
		'Be specific. Do not say "Visual mismatch" or "UI difference". If multiple things changed, pick the most obvious one.';

	const result = await callAIPovider(prompt, systemPrompt, [], 200);

	if (!result || result.toLowerCase().includes('visual mismatch')) {
		return 'Visual discrepancy';
	}
	return result;
}

// ─── Region Analysis Logic ───────────────────────────────────────────────────

export async function generateBatchRegionLabels(
	regions: import('./types.ts').DiffRegion[],
): Promise<string[]> {
	if (regions.length === 0) return [];

	const regionsText = regions
		.map((region, i) => {
			const figma = region.figmaMetrics || {};
			const dom = region.domMetrics || {};
			return `Region ${i}:\nExpected (Figma): ${JSON.stringify(figma)}\nActual (Web): ${JSON.stringify(dom)}`;
		})
		.join('\n\n');

	const prompt = [
		'Analyze the following regions and identify the primary visual discrepancy for each.',
		'Focus on: Dimensions, Text Content, Font Size/Weight, or Colors.',
		'',
		regionsText,
	].join('\n');

	const systemPrompt =
		'You are a visual QA assistant. You evaluate metric differences between Figma (Expected) and Web (Actual). ' +
		'For each region, provide a short, punchy 3-8 word summary of the main discrepancy. ' +
		'Examples: "Font weight is too bold", "Text content mismatch", "Width is 20px smaller". ' +
		'Respond strictly with a valid JSON array of strings, in the exact same order as the regions. ' +
		'Do not include markdown code blocks or any other text.';

	try {
		const result = await callAIPovider(prompt, systemPrompt, [], 2000);

		// Robustly extract the JSON array from the response
		const match = result.match(/\[[\s\S]*\]/);
		const cleanedResult = match ? match[0] : result.trim();

		const labels = JSON.parse(cleanedResult);

		if (Array.isArray(labels)) {
			// If AI returned too few, pad with fallbacks. If too many, slice.
			const finalLabels = [];
			for (let i = 0; i < regions.length; i++) {
				if (labels[i] && typeof labels[i] === 'string') {
					finalLabels.push(labels[i]);
				} else {
					finalLabels.push('Visual discrepancy');
				}
			}
			return finalLabels;
		}

		log.warn('Batch AI returned non-array', { cleanedResult });
		return regions.map(() => 'Visual discrepancy');
	} catch (err) {
		log.error('Failed to parse batch AI labels', { error: err });
		return regions.map(() => 'Visual discrepancy');
	}
}

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
