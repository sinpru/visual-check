import { NextRequest, NextResponse } from 'next/server';
import {
	updateStatus,
	readResults,
	recalculateBuildStatus,
	logger,
} from '@visual-check/core';

const log = logger.child('api:reject');

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

		log.info(`Reject request for "${testName}" (build: ${buildId})`);

		// 1. Update snapshot status to 'rejected'
		await updateStatus(testName, buildId, 'rejected');

		// 2. Recalculate build status
		const allResults = await readResults();
		await recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true });
	} catch (error) {
		log.error(`Reject failed for "${testName}" (build: ${buildId})`, {
			error,
		});
		return NextResponse.json({ error: 'Reject failed' }, { status: 500 });
	}
}
