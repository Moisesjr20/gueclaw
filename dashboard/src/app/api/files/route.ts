import { NextRequest, NextResponse } from 'next/server';

const VPS_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://147.93.69.211:3742';

export async function GET() {
  try {
    const response = await fetch(`${VPS_BASE_URL}/api/files`, {
      headers: {
        'x-api-key': process.env.DASHBOARD_API_KEY || '',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
