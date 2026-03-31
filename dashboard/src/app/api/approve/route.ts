import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - Assuming core package will be implemented by Person 1
import { approveBaseline, updateStatus } from '@visual-check/core';

export async function POST(request: NextRequest) {
  try {
    const { testName } = await request.json();
    
    if (!testName) {
      return NextResponse.json({ error: 'testName is required' }, { status: 400 });
    }

    await approveBaseline(testName);
    await updateStatus(testName, 'approved');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in POST /api/approve:', error);
    return NextResponse.json({ error: 'Failed to approve baseline' }, { status: 500 });
  }
}
