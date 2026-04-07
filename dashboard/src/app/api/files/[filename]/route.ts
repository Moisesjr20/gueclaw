import { NextRequest, NextResponse } from 'next/server';

const VPS_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://147.93.69.211:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const isPreview = request.nextUrl.searchParams.get('preview') === 'true';

    const response = await fetch(
      `${VPS_BASE_URL}/api/files/${encodeURIComponent(filename)}`,
      {
        headers: {
          'x-api-key': process.env.DASHBOARD_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error('File not found');
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    
    if (!isPreview) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    }

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }
}
