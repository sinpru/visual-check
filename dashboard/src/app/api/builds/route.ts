import { NextResponse } from 'next/server';
import { readBuilds } from '@visual-check/core';

export async function GET() {
	try {
		const builds = await readBuilds();
		return NextResponse.json(builds);
	} catch (error) {
		console.error('Failed to read builds:', error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
