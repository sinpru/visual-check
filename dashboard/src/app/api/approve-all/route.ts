import { NextRequest, NextResponse } from 'next/server';
import {
	approveBaseline,
	updateStatus,
	readResults,
	recalculateBuildStatus,
} from '@visual-check/core';

export async function POST(request: NextRequest) {
	try {
		const { buildId } = await request.json();

		if (!buildId) {
			return NextResponse.json(
				{ error: 'buildId is required' },
				{ status: 400 },
			);
		}

		const results = await readResults(buildId);
		const toApprove = results.filter(
			(r) => r.status === 'fail' || r.status === 'pending',
		);

		// Sequential approval to avoid race conditions on results.json
		for (const result of toApprove) {
			await approveBaseline(result.testName, buildId);
			await updateStatus(result.testName, buildId, 'approved');
		}

		// Recalculate build status once at the end
		const allResults = await readResults();
		await recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true, approvedCount: toApprove.length });
	} catch (error) {
		console.error('Approve all failed:', error);
		return NextResponse.json(
			{ error: 'Approve all failed' },
			{ status: 500 },
		);
	}
}
