import { NextRequest, NextResponse } from 'next/server';

// Prefer a server-only env var; fall back to NEXT_PUBLIC_* if set.
const UPSTREAM =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '';

if (!UPSTREAM) {
  // Throwing at module init surfaces clearly in builds
  throw new Error('Missing API_BASE (or NEXT_PUBLIC_API_BASE) for proxy upstream');
}

// No static optimization / caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toUpstreamUrl(req: NextRequest) {
  // Strip /api/proxy prefix
  const path = req.nextUrl.pathname.replace(/^\/api\/proxy/, '');
  const search = req.nextUrl.search || '';
  // Ensure UPSTREAM has a scheme
  const base = UPSTREAM.startsWith('http') ? UPSTREAM : `https://${UPSTREAM}`;
  return new URL(path + search, base).toString();
}

function forwardableHeaders(req: NextRequest) {
  // Keep it minimal & safe. Add others if you need them later.
  const allow = new Set(['accept', 'content-type', 'authorization']);
  const h = new Headers();
  req.headers.forEach((v, k) => {
    if (allow.has(k.toLowerCase())) h.set(k, v);
  });
  return h;
}

async function handle(req: NextRequest, method:
  'GET'|'HEAD'|'POST'|'PUT'|'PATCH'|'DELETE'|'OPTIONS') {

  // Same-origin proxy: short-circuit preflight locally
  if (method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
        'access-control-allow-headers': req.headers.get('access-control-request-headers') || '*',
        'access-control-max-age': '600',
      },
    });
  }

  const url = toUpstreamUrl(req);

  const init: RequestInit = {
    method,
    headers: forwardableHeaders(req),
    redirect: 'manual',
    // For GET/HEAD, no body. For others, prefer streaming body if available.
    body: (method === 'GET' || method === 'HEAD') ? undefined : (req.body ?? await req.arrayBuffer()),
  };

  const upstream = await fetch(url, init);

  // Copy a small, safe subset of headers back
  const resHeaders = new Headers();
  const ct = upstream.headers.get('content-type');
  const cc = upstream.headers.get('cache-control');
  if (ct) resHeaders.set('content-type', ct);
  resHeaders.set('cache-control', cc || 'no-store');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export const GET     = (req: NextRequest) => handle(req, 'GET');
export const HEAD    = (req: NextRequest) => handle(req, 'HEAD');
export const POST    = (req: NextRequest) => handle(req, 'POST');
export const PUT     = (req: NextRequest) => handle(req, 'PUT');
export const PATCH   = (req: NextRequest) => handle(req, 'PATCH');
export const DELETE  = (req: NextRequest) => handle(req, 'DELETE');
export const OPTIONS = (req: NextRequest) => handle(req, 'OPTIONS');