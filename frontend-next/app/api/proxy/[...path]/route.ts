import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';           // ensure Node runtime (not Edge)
export const dynamic = 'force-dynamic';    // don’t cache proxy results

const UPSTREAM =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE ||
  ''; // e.g. https://week5fullintegrationdataapidashboard-production.up.railway.app

function upstreamUrl(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api\/proxy/, '');
  const search = req.nextUrl.search || '';
  if (!UPSTREAM) throw new Error('Missing NEXT_PUBLIC_API_BASE / API_BASE');
  return new URL(path + search, UPSTREAM).toString();
}

function pickHeaders(req: NextRequest) {
  const h = new Headers();
  // Forward only the headers we actually need
  const allow = new Set(['content-type', 'authorization', 'accept']);
  req.headers.forEach((v, k) => {
    if (allow.has(k.toLowerCase())) h.set(k, v);
  });
  return h;
}

async function passThrough(
  req: NextRequest,
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'
) {
  const url = upstreamUrl(req);
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: pickHeaders(req),
    redirect: 'manual',
  };

  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (hasBody) {
    // Node/Undici requires duplex when there is a request body
    init.duplex = 'half';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      init.body = await req.text(); // keep raw JSON
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      // Generic pass-through; Undici handles Blob/stream with duplex
      init.body = await req.blob();
    } else {
      init.body = await req.arrayBuffer();
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e: any) {
    // Return a small JSON error so clients don't crash trying to parse ""
    return NextResponse.json(
      { ok: false, proxy_error: String(e?.message || e) },
      { status: 502, headers: { 'cache-control': 'no-store' } }
    );
  }

  // Copy minimal headers through
  const resHeaders = new Headers();
  for (const k of ['content-type', 'cache-control']) {
    const v = upstream.headers.get(k);
    if (v) resHeaders.set(k, v);
  }
  if (!resHeaders.has('cache-control')) resHeaders.set('cache-control', 'no-store');

  // Some upstream errors return empty bodies; keep it binary-safe
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers: resHeaders });
}

export async function GET(req: NextRequest)     { return passThrough(req, 'GET'); }
export async function HEAD(req: NextRequest)    { return passThrough(req, 'HEAD'); }
export async function POST(req: NextRequest)    { return passThrough(req, 'POST'); }
export async function PUT(req: NextRequest)     { return passThrough(req, 'PUT'); }
export async function PATCH(req: NextRequest)   { return passThrough(req, 'PATCH'); }
export async function DELETE(req: NextRequest)  { return passThrough(req, 'DELETE'); }
export async function OPTIONS(req: NextRequest) { return passThrough(req, 'OPTIONS'); }