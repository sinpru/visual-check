import { NextRequest, NextResponse } from 'next/server';
import {
	approveBaseline,
	updateStatus,
	readResults,
	recalculateBuildStatus,
	logger,
} from '@visual-check/core';

const log = logger.child('api:approve');

export async function POST(request: NextRequest) {
	let testName: string | undefined;
	let buildId: string | undefined;

	try {
		const body = await request.json();
		testName = body.testName;
		buildId = body.buildId;

		if (!testName || !buildId) {
			return NextResponse.json(
				{ error: 'testName and buildId are required' },
				{ status: 400 },
			);
		}

		log.info(`Approve request for "${testName}" (build: ${buildId})`);

		// 1. Approve baseline (copy current to baseline)
		await approveBaseline(testName, buildId);

		// 2. Update snapshot status to 'approved'
		await updateStatus(testName, buildId, 'approved');

		// 3. Recalculate build status
		const allResults = await readResults();
		await recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true });
	} catch (error) {
		log.error(`Approve failed for "${testName}" (build: ${buildId})`, {
			error,
		});
		return NextResponse.json({ error: 'Approve failed' }, { status: 500 });
	}
}
