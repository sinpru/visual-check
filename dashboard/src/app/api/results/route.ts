import { NextResponse } from 'next/server';
// @ts-ignore - Assuming core package will be implemented by Person 1
import { readResults } from '@visual-check/core';

export async function GET() {
  try {
    const results = await readResults();
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in GET /api/results:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
