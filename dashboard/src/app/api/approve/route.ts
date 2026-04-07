import { NextRequest, NextResponse } from 'next/server';
import {
	approveBaseline,
	updateStatus,
	readResults,
	readBuilds,
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

		// Look up projectId from the build so approveBaseline writes to the
		// correct scoped baseline path: baselines/{projectId}/{testName}.png
		const builds    = readBuilds();
		const build     = builds.find((b) => b.buildId === buildId);
		const projectId = build?.projectId;

		// Sequential — never parallelize file ops on results.json
		// 1. Copy current → baseline (scoped), delete diff
		approveBaseline(testName, buildId, projectId);
		// 2. Mark status approved
		updateStatus(testName, buildId, 'approved');
		// 3. Recompute build-level status
		const allResults = await readResults();
		recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true });
	} catch (error) {
		log.error(`Approve failed for "${testName}" (build: ${buildId})`, {
			error,
		});
		return NextResponse.json({ error: 'Approve failed' }, { status: 500 });
	}
}
