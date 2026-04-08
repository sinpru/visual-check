import { NextRequest, NextResponse } from 'next/server';
import {
	approveBaseline,
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

		// 1. Approve baseline (copy current to baseline)
		await approveBaseline(testName, buildId);

		// 2. Update snapshot status to 'approved'
		await updateStatus(testName, buildId, 'approved');

		// 3. Recalculate build status
		const allResults = await readResults();
		await recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('Approve failed:', error);
		return NextResponse.json({ error: 'Approve failed' }, { status: 500 });
	}
}
