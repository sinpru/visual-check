import { NextRequest, NextResponse } from 'next/server';
import {
	approveBaseline,
	updateStatus,
	readResults,
	readBuilds,
	recalculateBuildStatus,
	logger,
} from '@visual-check/core';

const log = logger.child('api:approve-all');

export async function POST(request: NextRequest) {
	let buildId: string | undefined;

	try {
		const body = await request.json();
		buildId = body.buildId;

		if (!buildId) {
			return NextResponse.json(
				{ error: 'buildId is required' },
				{ status: 400 },
			);
		}

		log.info(`Approve-all request for build ${buildId}`);

		// Resolve projectId once for the whole batch
		const builds = readBuilds();
		const build = builds.find((b) => b.buildId === buildId);
		const projectId = build?.projectId;

		const results = await readResults(buildId);
		const toApprove = results.filter(
			(r) => r.status === 'fail' || r.status === 'pending',
		);

		log.info(
			`Approving ${toApprove.length} snapshots for build ${buildId}`,
		);

		// Sequential approval to avoid race conditions on results.json
		for (const result of toApprove) {
			log.debug(`Approving "${result.testName}" in build ${buildId}`);
			approveBaseline(result.testName, buildId, projectId);
			updateStatus(result.testName, buildId, 'approved');
		}

		// Recalculate build status once at the end
		const allResults = await readResults();
		recalculateBuildStatus(buildId, allResults);

		return NextResponse.json({ ok: true, approvedCount: toApprove.length });
	} catch (error) {
		log.error(`Approve-all failed for build ${buildId}`, { error });
		return NextResponse.json(
			{ error: 'Approve all failed' },
			{ status: 500 },
		);
	}
}
