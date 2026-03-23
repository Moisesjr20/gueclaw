// Server-side proxy: catches all /api/* requests, forwards to VPS debug-api
// The GUECLAW_API_KEY never reaches the browser

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.GUECLAW_API_URL ?? '';
const API_KEY = process.env.GUECLAW_API_KEY ?? '';

async function forward(req: NextRequest, pathParts: string[]): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json({ error: 'GUECLAW_API_URL not configured' }, { status: 503 });
  }
  const path = pathParts.join('/');
  const search = req.nextUrl.search ?? '';
  const url = `${API_URL}/api/${path}${search}`;

  const headers: HeadersInit = { 'x-api-key': API_KEY };
  let body: BodyInit | undefined;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { body = await req.text(); headers['content-type'] = 'application/json'; } catch {}
  }

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

// Next.js 15: params is a Promise
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path);
}
