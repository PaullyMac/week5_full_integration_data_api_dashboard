'use client';

import React from 'react';
import useSWR from 'swr';
import dynamic from 'next/dynamic';

// Read from your Railway API
const API = process.env.NEXT_PUBLIC_API_BASE ?? '';

const fetcher = (path: string) =>
  fetch(`${API}${path}`).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

// Type the dynamically-imported component's props to silence TS
const LeafletMap = dynamic(
  () => import('./parts/LeafletMap'),
  { ssr: false }
) as React.ComponentType<{ positions: any[] }>;

export default function Page() {
  const { data: health }    = useSWR('/api/health', fetcher, { refreshInterval: 12000 });
  const { data: devices }   = useSWR('/api/traccar/devices', fetcher, { refreshInterval: 15000 });
  const { data: positionsRaw } = useSWR('/api/positions/latest', fetcher, { refreshInterval: 10000 });

  const positions = Array.isArray(positionsRaw)
    ? positionsRaw.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        deviceId: p.device_id,
        serverTime: p.fix_time ?? p.server_time ?? null,
      }))
    : [];

  const [form, setForm] = React.useState({
    current_lat: 14.5535, current_lng: 121.0447,
    dropoff_lat: 14.5353, dropoff_lng: 120.9830
  });
  const [eta, setEta] = React.useState<any>(null);
  const [loadingEta, setLoadingEta] = React.useState(false);

  async function submitETA(e: React.FormEvent) {
    e.preventDefault();
    setLoadingEta(true);
    try {
      const r = await fetch(`${API}/api/predict-eta`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      setEta(j);
    } finally {
      setLoadingEta(false);
    }
  }

  return (
    <main style={{padding:'20px', maxWidth: 1100, margin:'0 auto', fontFamily:'system-ui,Segoe UI,Roboto,Arial'}}>
      <h1 style={{fontSize:28, fontWeight:700, marginBottom:12}}>Week 5 – Data App Dashboard (Preview)</h1>

      <section style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16}}>
        <Card title="API Health">
          <div>
            <div>Laravel API: <b>OK</b></div>
            <div>Flask: {health?.flask?.ok ? 'OK' : '—'}</div>
            <div>Redis: {String(health?.flask?.redis ?? '—')}</div>
          </div>
        </Card>

        <Card title="Traccar Devices">
          <div>{Array.isArray(devices) ? `${devices.length} device(s)` : '—'}</div>
          <small style={{color:'#666'}}>Positions may be empty until phone starts sending.</small>
        </Card>

        <Card title="Quick ETA (via Flask)">
          <form onSubmit={submitETA} style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {(['current_lat','current_lng','dropoff_lat','dropoff_lng'] as const).map(k => (
              <input key={k} required type="number" step="any"
                value={form[k]}
                onChange={e=>setForm(p=>({...p,[k]: Number(e.target.value)}))}
                placeholder={k.replace('_',' ')} style={{padding:8,border:'1px solid #ddd',borderRadius:8}} />
            ))}
            <button disabled={loadingEta} style={{gridColumn:'1 / span 2',padding:'8px 12px',borderRadius:8,background:'#111',color:'#fff'}}>
              {loadingEta ? 'Calculating…' : 'Predict ETA'}
            </button>
          </form>
          {eta && <pre style={{marginTop:8, background:'#fafafa', padding:8, borderRadius:8, maxHeight:150, overflow:'auto'}}>{JSON.stringify(eta, null, 2)}</pre>}
        </Card>
      </section>

      <section style={{marginTop:16}}>
        <Card title="Live Positions">
          <LeafletMap positions={positions} />
        </Card>
      </section>
    </main>
  );
}

function Card({title, children}:{title:string, children:React.ReactNode}) {
  return (
    <div style={{border:'1px solid #eee', borderRadius:12, padding:14, background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,.04)'}}>
      <div style={{fontWeight:600, marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}
