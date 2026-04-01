import { NextRequest, NextResponse } from 'next/server';
import { createProject, readProjects } from '@visual-check/core';

export async function GET() {
	try {
		const projects = readProjects();
		return NextResponse.json(projects);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json() as { name: string };

		if (!body.name || !body.name.trim()) {
			return NextResponse.json(
				{ error: 'Project name is required' },
				{ status: 400 },
			);
		}

		// Prevent duplicate names
		const existing = readProjects();
		const duplicate = existing.find(
			(p) => p.name.toLowerCase() === body.name.trim().toLowerCase()
		);
		if (duplicate) {
			return NextResponse.json(
				{ error: `A project named "${body.name.trim()}" already exists` },
				{ status: 409 },
			);
		}

		const project = createProject(body.name);
		return NextResponse.json({ ok: true, project }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}