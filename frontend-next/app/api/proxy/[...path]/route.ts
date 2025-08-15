import { NextRequest, NextResponse } from 'next/server';

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
  const allow = new Set(['content-type', 'authorization']);
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
  const init: RequestInit = { method, headers: pickHeaders(req), redirect: 'manual' };

  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (hasBody) {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      init.body = await req.text(); // keep raw JSON
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      init.body = await req.blob(); // generic pass-through
    } else {
      init.body = await req.arrayBuffer();
    }
  }

  const upstream = await fetch(url, init);
  const resHeaders = new Headers();
  for (const k of ['content-type', 'cache-control']) {
    const v = upstream.headers.get(k);
    if (v) resHeaders.set(k, v);
  }
  if (!resHeaders.has('cache-control')) resHeaders.set('cache-control', 'no-store');

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