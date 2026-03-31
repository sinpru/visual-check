import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - Assuming core package will be implemented by Person 1
import { updateStatus } from '@visual-check/core';

export async function POST(request: NextRequest) {
  try {
    const { testName } = await request.json();
    
    if (!testName) {
      return NextResponse.json({ error: 'testName is required' }, { status: 400 });
    }

    await updateStatus(testName, 'rejected');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in POST /api/reject:', error);
    return NextResponse.json({ error: 'Failed to reject test result' }, { status: 500 });
  }
}
