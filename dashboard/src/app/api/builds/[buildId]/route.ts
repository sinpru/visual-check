import { NextRequest, NextResponse } from 'next/server';
import { deleteBuild } from '@visual-check/core';

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ buildId: string }> }
) {
	try {
		const { buildId } = await params;
		deleteBuild(buildId);
		return NextResponse.json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
