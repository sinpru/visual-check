import { NextRequest, NextResponse } from 'next/server';
import {
	approveBaseline,
	updateStatus,
	readResults,
	readBuilds,
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

		// Resolve projectId once for the whole batch
		const builds    = readBuilds();
		const build     = builds.find((b) => b.buildId === buildId);
		const projectId = build?.projectId;

		const results   = readResults(buildId);
		const toApprove = results.filter(
			(r) => r.status === 'fail' || r.status === 'pending',
		);

		// Sequential — concurrent writes corrupt results.json
		for (const result of toApprove) {
			approveBaseline(result.testName, buildId, projectId);
			updateStatus(result.testName, buildId, 'approved');
		}

		const allResults = readResults();
		recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true, approvedCount: toApprove.length });
	} catch (error) {
		console.error('Approve all failed:', error);
		return NextResponse.json({ error: 'Approve all failed' }, { status: 500 });
	}
}