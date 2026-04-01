import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSnapshotsDir } from '@visual-check/core';

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const imagePath = searchParams.get('path');

	if (!imagePath) {
		return NextResponse.json(
			{ error: 'Path is required' },
			{ status: 400 },
		);
	}

	const snapshotsRoot = getSnapshotsDir();
	const fullPath = path.resolve(snapshotsRoot, imagePath);

	// Path traversal prevention
	if (!fullPath.startsWith(snapshotsRoot)) {
		return NextResponse.json(
			{ error: 'Unauthorized path' },
			{ status: 403 },
		);
	}

	if (!fs.existsSync(fullPath)) {
		return NextResponse.json({ error: 'Image not found' }, { status: 404 });
	}

	try {
		const buffer = fs.readFileSync(fullPath);
		return new NextResponse(buffer, {
			headers: {
				'Content-Type': 'image/png',
			},
		});
	} catch (error) {
		console.error('Error reading image file:', error);
		return NextResponse.json(
			{ error: 'Failed to read image' },
			{ status: 500 },
		);
	}
}
