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

const LeafletMap = dynamic(
  () => import('./parts/LeafletMap'),
  { ssr: false }
) as React.ComponentType<{ positions: any[]; showPath?: boolean }>;

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d2 = Math.floor(h / 24);
  return `${d2} d ago`;
}
function useRerenderEvery(ms: number) {
  const [, set] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => set(x => x + 1), ms); return () => clearInterval(id); }, [ms]);
}

export default function Page() {
  const { data: health }       = useSWR('/api/health', fetcher, { refreshInterval: 12000, revalidateOnFocus: false });
  const { data: devicesRaw }   = useSWR('/api/traccar/devices', fetcher, { refreshInterval: 15000, revalidateOnFocus: false });
  const devices: Array<{ id:number; name?:string }> = Array.isArray(devicesRaw) ? devicesRaw : [];

  // Pick a device (defaults to the first one once devices load)
  const [deviceId, setDeviceId] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!deviceId && devices.length) setDeviceId(devices[0].id);
  }, [devices, deviceId]);

  // Track positions for the selected device (from Laravel -> Traccar)
  const { data: trackRaw } = useSWR(
    deviceId ? `/api/traccar/positions?deviceId=${deviceId}` : null,
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: false }
  );

  const track = Array.isArray(trackRaw)
    ? trackRaw.map((p: any) => ({
        latitude:  p.latitude,
        longitude: p.longitude,
        deviceId:  p.deviceId,
        serverTime: p.fixTime ?? p.serverTime ?? null,
        speed:     p.speed ?? null,
      }))
    : [];

  // Also keep your DB "latest" list to fall back if ever needed
  const { data: latestRaw } = useSWR('/api/positions/latest', fetcher, { refreshInterval: 10000, revalidateOnFocus: false });
  const latest = Array.isArray(latestRaw)
    ? latestRaw.map((p:any)=>({ latitude:p.latitude, longitude:p.longitude, serverTime:p.fix_time ?? p.server_time ?? null }))
    : [];

  // What we’ll render on the map: prefer live track if we have it, else DB latest
  const positions = track.length ? track : latest;

  // Freshness line based on newest timestamp from what we’re showing
  useRerenderEvery(30_000);
  const newestISO = React.useMemo(() => {
    const ts = positions
      .map(p => (p.serverTime ? new Date(p.serverTime).getTime() : NaN))
      .filter(n => Number.isFinite(n));
    return ts.length ? new Date(Math.max(...ts)).toISOString() : null;
  }, [positions]);
  const lastUpdatedLabel = newestISO ? timeAgo(new Date(newestISO)) : '—';

  // ---- Quick ETA (unchanged) ----
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
      setEta(await r.json());
    } finally { setLoadingEta(false); }
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
          {/* Device picker + freshness */}
          <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
            <label style={{fontSize:14}}>
              Device:&nbsp;
              <select
                value={deviceId ?? ''}
                onChange={e => setDeviceId(e.target.value ? Number(e.target.value) : null)}
                style={{padding:'6px 8px', border:'1px solid #ddd', borderRadius:8, minWidth:160}}
              >
                {!devices.length && <option value="">(none)</option>}
                {devices.map(d => <option key={d.id} value={d.id}>{d.name ?? `Device ${d.id}`}</option>)}
              </select>
            </label>

            <small style={{color:'#666'}}>
              Last update: <b title={newestISO ?? ''}>{lastUpdatedLabel}</b>
            </small>
            <small style={{color:'#999'}}>{track.length ? 'source: Traccar (live)' : 'source: DB latest'}</small>
          </div>

          <LeafletMap positions={positions} showPath={!!track.length} />
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