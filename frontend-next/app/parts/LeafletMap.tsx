'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression, LatLngBoundsExpression } from 'leaflet';
import React from 'react';
import useSWR from 'swr';

// Fix default marker icons in Next.js/Leaflet
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import marker from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
L.Icon.Default.mergeOptions({
  iconRetinaUrl: (marker2x as any).src ?? (marker2x as any),
  iconUrl: (marker as any).src ?? (marker as any),
  shadowUrl: (shadow as any).src ?? (shadow as any),
});

type Pos = {
  latitude: number;
  longitude: number;
  serverTime?: string | null;
  deviceId?: number | string | null;
  speed?: number | null;
};

const API_BASE = '/api/proxy'; // use the Vercel proxy so no CORS headaches

// simple fetcher
const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};

// helpers to accept either array or {data:[...]}
function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export default function LeafletMap({
  positions,
  showPath = true,
}: {
  positions: Pos[];
  showPath?: boolean;
}) {
  // Draw path in chronological order when timestamps exist; otherwise keep input order
  const sorted = React.useMemo(() => {
    const hasTime = positions.some(p => p.serverTime);
    if (!hasTime) return positions;
    return [...positions].sort((a, b) => {
      const at = a.serverTime ? new Date(a.serverTime).getTime() : 0;
      const bt = b.serverTime ? new Date(b.serverTime).getTime() : 0;
      return at - bt;
    });
  }, [positions]);

  const coords: LatLngExpression[] = sorted
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map(p => [p.latitude, p.longitude]);

  const last = sorted.length ? sorted[sorted.length - 1] : null;

  // --- History overlay state (in-view) ---
  const [bounds, setBounds] = React.useState<any>(null);
  const [showHistory, setShowHistory] = React.useState(true);
  const [hours, setHours] = React.useState(24);

  // Build a URL using current Leaflet bounds + time window
  const historyUrl = React.useMemo(() => {
    if (!showHistory || !bounds) return null;
    const sw = bounds.getSouthWest?.() || bounds._southWest;
    const ne = bounds.getNorthEast?.() || bounds._northEast;
    if (!sw || !ne) return null;

    const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const qs = new URLSearchParams({
      from,
      minLat: String(sw.lat),
      maxLat: String(ne.lat),
      minLng: String(sw.lng),
      maxLng: String(ne.lng),
      limit: '500', // guardrail for UI
    }).toString();

    // Query Laravel DB history via proxy: /api/positions?...
    return `${API_BASE}/api/positions?${qs}`;
  }, [showHistory, bounds, hours]);

  const { data: histRaw } = useSWR(historyUrl, fetcher, {
    refreshInterval: 15000,
    dedupingInterval: 5000,
  });

  const historyDots = React.useMemo(() => {
    return toArray(histRaw)
      .filter((p: any) => p && p.latitude != null && p.longitude != null)
      .map((p: any) => ({
        lat: typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude,
        lng: typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude,
        id: p.traccar_id ?? p.id ?? undefined,
      }))
      .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }, [histRaw]);

  return (
    <div style={{ position: 'relative', height: 520, width: '100%' }}>
      {/* Speed badge (top-right) */}
      <SpeedBadge speed={last?.speed} />

      {/* Overlay controls (top-left) */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          zIndex: 1000,
          pointerEvents: 'auto',
          background: 'rgba(255,255,255,.92)',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '6px 10px',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showHistory}
            onChange={e => setShowHistory(e.target.checked)}
          />
          Show history in view
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Window:
          <select
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            style={{ padding: '2px 6px' }}
          >
            <option value={1}>1h</option>
            <option value={3}>3h</option>
            <option value={6}>6h</option>
            <option value={12}>12h</option>
            <option value={24}>24h</option>
            <option value={48}>48h</option>
          </select>
        </label>
      </div>

      <MapContainer center={coords[0] ?? [15.0, 121.0]} zoom={7} style={{ height: '100%', width: '100%' }}>
        <BoundsWatcher onChange={setBounds} />

        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showPath && coords.length >= 2 && <Polyline positions={coords} />}

        {last && (
          <Marker position={[last.latitude, last.longitude]}>
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                <div>
                  <b>Device</b>: {String(last.deviceId ?? '—')}
                </div>
                <div>
                  <b>Time</b>:{' '}
                  {last.serverTime ? new Date(last.serverTime).toLocaleString() : '—'}
                </div>
                <div>
                  <b>Lat/Lng</b>: {last.latitude}, {last.longitude}
                </div>
                {typeof last.speed === 'number' && (
                  <div>
                    <b>Speed</b>: {last.speed}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* History dots */}
        {showHistory &&
          historyDots.map((p, i) => (
            <CircleMarker
              key={p.id ?? `h-${i}`}
              center={[p.lat, p.lng]}
              radius={3}
              pathOptions={{ color: '#6a1b9a', weight: 1, opacity: 0.85, fillOpacity: 0.6 }}
            />
          ))}

        <FitToData coords={coords} />
      </MapContainer>
    </div>
  );
}

function FitToData({ coords }: { coords: LatLngExpression[] }) {
  const map = useMap();
  const key = React.useMemo(
    () => coords.map(c => (Array.isArray(c) ? `${c[0]},${c[1]}` : String(c))).join('|'),
    [coords]
  );

  React.useEffect(() => {
    if (!coords.length) return;
    if (coords.length === 1) {
      map.setView(coords[0] as any, 14);
    } else {
      const bounds: LatLngBoundsExpression = coords as any;
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, key]);

  return null;
}

function BoundsWatcher({ onChange }: { onChange: (b: any) => void }) {
  const map = useMapEvents({
    load() {
      onChange(map.getBounds());
    },
    moveend() {
      onChange(map.getBounds());
    },
    zoomend() {
      onChange(map.getBounds());
    },
  });
  return null;
}

function SpeedBadge({ speed }: { speed?: number | null }) {
  const label = typeof speed === 'number' ? String(speed) : '—';
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: 12,
        zIndex: 1000,
        pointerEvents: 'none',
        background: 'rgba(17,17,17,.85)',
        color: '#fff',
        borderRadius: 10,
        padding: '6px 10px',
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 999,
          background: '#4ade80',
        }}
      />
      <span style={{ opacity: 0.8 }}>Speed</span>
      <strong style={{ fontWeight: 700 }}>{label}</strong>
    </div>
  );
}