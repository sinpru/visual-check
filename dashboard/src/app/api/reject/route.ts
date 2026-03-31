import { NextRequest, NextResponse } from 'next/server';
import {
	updateStatus,
	readResults,
	recalculateBuildStatus,
} from '@visual-check/core';

export async function POST(request: NextRequest) {
	try {
		const { testName, buildId } = await request.json();

		if (!testName || !buildId) {
			return NextResponse.json(
				{ error: 'testName and buildId are required' },
				{ status: 400 },
			);
		}

		// 1. Update snapshot status to 'rejected'
		await updateStatus(testName, buildId, 'rejected');

		// 2. Recalculate build status
		const allResults = await readResults();
		await recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('Reject failed:', error);
		return NextResponse.json({ error: 'Reject failed' }, { status: 500 });
	}
}
