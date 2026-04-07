import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getSnapshotsDir } from '@visual-check/core';

export async function GET() {
	const authPath = path.join(getSnapshotsDir(), 'auth.json');
	const exists = fs.existsSync(authPath);

	if (!exists) {
		return NextResponse.json({
			exists: false,
			savedAt: null,
			ageHours: null,
		});
	}

	const stat = fs.statSync(authPath);
	const savedAt = stat.mtime.toISOString();
	const ageHours = (Date.now() - stat.mtimeMs) / 3_600_000;

	return NextResponse.json({
		exists: true,
		savedAt,
		ageHours: Math.round(ageHours * 10) / 10,
	});
}
