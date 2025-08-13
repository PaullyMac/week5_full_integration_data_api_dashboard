import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import useSWR from "swr";
import "leaflet/dist/leaflet.css";

// React-Leaflet pieces (client-only)
const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import("react-leaflet").then(m => m.Marker),       { ssr: false });
const Popup        = dynamic(() => import("react-leaflet").then(m => m.Popup),        { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then(m => m.CircleMarker), { ssr: false });

// A tiny client-only component that reports Leaflet bounds on move/zoom/load
const BoundsWatcher = dynamic(async () => {
  const { useMapEvents } = await import("react-leaflet");
  return function Watcher({ onChange }) {
    const map = useMapEvents({
      load()    { onChange(map.getBounds()); },
      moveend() { onChange(map.getBounds()); },
      zoomend() { onChange(map.getBounds()); },
    });
    return null;
  };
}, { ssr: false });

// Fix default marker icons so pins render in Next.js
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
const _iconRetina = (markerIcon2x && markerIcon2x.src) || markerIcon2x;
const _icon       = (markerIcon && markerIcon.src) || markerIcon;
const _shadow     = (markerShadow && markerShadow.src) || markerShadow;
L.Icon.Default.mergeOptions({ iconRetinaUrl: _iconRetina, iconUrl: _icon, shadowUrl: _shadow });

const API = "/api/proxy";
const fetcher = async (url) => {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch {
    return []; // guard: UI should never explode
  }
};
function toArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}
function coercePositions(data) {
  return toArray(data)
    .filter(p => p && p.latitude != null && p.longitude != null)
    .map(p => ({
      ...p,
      device_id: p.device_id ?? p.deviceId ?? null,
      latitude: typeof p.latitude  === "string" ? parseFloat(p.latitude)  : p.latitude,
      longitude: typeof p.longitude === "string" ? parseFloat(p.longitude) : p.longitude,
      speed: typeof p.speed === "string" ? parseFloat(p.speed) : p.speed,
    }))
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}

export default function Map() {
  // text filter for snapshot markers
  const [query, setQuery] = useState("");
  // bbox history overlay toggle + time window
  const [showHistory, setShowHistory] = useState(true);
  const [hours, setHours] = useState(24);
  const [bounds, setBounds] = useState(null);

  // Snapshot (latest) — same as before
  const { data: latestRaw, error, isLoading, isValidating } = useSWR(
    `${API}/api/positions/latest`,
    fetcher,
    { refreshInterval: 15000, dedupingInterval: 5000 }
  );
  const latest = useMemo(() => coercePositions(latestRaw), [latestRaw]);

  // Bounds → history URL (limit now; pagination later)
  const historyUrl = useMemo(() => {
    if (!showHistory || !bounds) return null;
    const sw = bounds.getSouthWest?.() || bounds._southWest;
    const ne = bounds.getNorthEast?.() || bounds._northEast;
    if (!sw || !ne) return null;
    const from = new Date(Date.now() - hours*60*60*1000).toISOString();
    const qs = new URLSearchParams({
      from,
      minLat: String(sw.lat),
      maxLat: String(ne.lat),
      minLng: String(sw.lng),
      maxLng: String(ne.lng),
      limit: "500",
    }).toString();
    return `${API}/api/positions?${qs}`;
  }, [showHistory, bounds, hours]);

  const { data: histRaw } = useSWR(historyUrl, fetcher, {
    refreshInterval: 15000,
    dedupingInterval: 5000,
  });
  const history = useMemo(() => coercePositions(histRaw), [histRaw]);

  const filtered = useMemo(() => {
    if (!query.trim()) return latest;
    const q = query.trim().toLowerCase();
    return latest.filter(p =>
      String(p.device_id ?? "").toLowerCase().includes(q) ||
      String(p.address ?? "").toLowerCase().includes(q)
    );
  }, [latest, query]);

  const center = filtered.length
    ? [filtered[0].latitude, filtered[0].longitude]
    : [14.5995, 120.9842]; // Manila

  const lastUpdated = useMemo(() => {
    const times = latest
      .map(p => p.fix_time ?? p.server_time ?? p.updated_at ?? p.created_at)
      .filter(Boolean)
      .map(t => new Date(t).getTime())
      .filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)).toLocaleString() : null;
  }, [latest]);

  return (
    <div>
      <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:8, flexWrap:"wrap"}}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by device ID or address…"
          style={{padding:"8px 10px", border:"1px solid #ddd", borderRadius:8, minWidth:"280px"}}
        />
        <label style={{fontSize:14}}>
          <input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />
          &nbsp;Show history in view
        </label>
        <label style={{fontSize:14}}>
          &nbsp;Window:&nbsp;
          <select value={hours} onChange={e => setHours(Number(e.target.value))}>
            <option value={1}>1h</option>
            <option value={3}>3h</option>
            <option value={6}>6h</option>
            <option value={12}>12h</option>
            <option value={24}>24h</option>
            <option value={48}>48h</option>
          </select>
        </label>
        <span style={{fontSize:12, color:"#666"}}>
          {isLoading ? "Loading…" : error ? "Error loading data" : isValidating ? "Refreshing…" : "Live"}
          {lastUpdated ? ` • Last updated: ${lastUpdated}` : ""}
        </span>
      </div>

      <div style={{height:"80vh", width:"100%"}}>
        <MapContainer center={center} zoom={12} style={{height:"100%", width:"100%"}}>
          <BoundsWatcher onChange={setBounds} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Latest snapshot markers */}
          {filtered.map((p, i) => (
            <Marker key={p.device_id ?? i} position={[p.latitude, p.longitude]}>
              <Popup>
                <div style={{lineHeight:1.4}}>
                  <b>Device</b>: {p.device_id ?? "N/A"}<br/>
                  <b>Speed</b>: {p.speed ?? 0}<br/>
                  <b>When</b>: {String(p.fix_time ?? p.server_time ?? "")}<br/>
                  {p.address ? <span><b>Addr</b>: {p.address}</span> : null}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* History overlay as small dots */}
          {showHistory && history.map((p, i) => (
            <CircleMarker
              key={`h-${p.traccar_id ?? i}`}
              center={[p.latitude, p.longitude]}
              radius={3}
              pathOptions={{ color: "#6a1b9a", weight: 1, opacity: 0.8, fillOpacity: 0.6 }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
