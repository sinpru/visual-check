import { NextRequest, NextResponse } from 'next/server';
import { readResults } from '@visual-check/core';

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const buildId = searchParams.get('buildId');

	if (!buildId) {
		return NextResponse.json(
			{ error: 'buildId is required' },
			{ status: 400 },
		);
	}

	try {
		const results = await readResults(buildId);
		return NextResponse.json(results);
	} catch (error) {
		console.error('Failed to read results:', error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
