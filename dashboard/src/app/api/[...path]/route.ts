// Server-side proxy: catches all /api/* requests, forwards to VPS debug-api
// The GUECLAW_API_KEY never reaches the browser

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.GUECLAW_API_URL ?? '';
const API_KEY = process.env.GUECLAW_API_KEY ?? '';

async function forward(req: NextRequest, pathParts: string[]): Promise<NextResponse> {
  // Debug: log environment
  console.log('[Proxy Debug]', {
    hasApiUrl: !!API_URL,
    hasApiKey: !!API_KEY,
    apiUrlPreview: API_URL?.substring(0, 20) + '...',
    method: req.method,
    path: pathParts.join('/'),
  });
  
  if (!API_URL) {
    return NextResponse.json({ 
      error: 'GUECLAW_API_URL not configured',
      debug: {
        env: process.env.VERCEL_ENV,
        hasApiUrl: !!API_URL,
        hasApiKey: !!API_KEY,
      }
    }, { status: 503 });
  }
  const path = pathParts.join('/');
  const search = req.nextUrl.search ?? '';
  const url = `${API_URL}/api/${path}${search}`;

  const headers: HeadersInit = { 
    'x-api-key': API_KEY,
    'content-type': 'application/json',
  };
  let body: BodyInit | undefined;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { 
      // Clone request to read body multiple times if needed
      const clonedReq = req.clone();
      const bodyText = await clonedReq.text();
      
      if (bodyText && bodyText.trim()) {
        // Validate JSON
        try {
          const parsed = JSON.parse(bodyText);
          // Re-stringify to ensure clean JSON
          body = JSON.stringify(parsed);
          console.log('[Proxy] Body validated:', { length: body.length, preview: body.substring(0, 100) });
        } catch (parseErr) {
          console.error('[Proxy] Invalid JSON:', bodyText);
          return NextResponse.json({ 
            error: 'Invalid JSON in request body',
            received: bodyText.substring(0, 100),
          }, { status: 400 });
        }
      }
    } catch (err: any) {
      console.error('[Proxy] Body read error:', err.message);
      return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
    }
  }

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000), // Increased timeout for LLM
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    console.error('Proxy error:', err.message);
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
