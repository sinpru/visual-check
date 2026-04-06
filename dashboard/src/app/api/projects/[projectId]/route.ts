import { NextRequest, NextResponse } from 'next/server';
import { deleteProject } from '@visual-check/core';

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	try {
		const { projectId } = await params;
		deleteProject(projectId);
		return NextResponse.json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
