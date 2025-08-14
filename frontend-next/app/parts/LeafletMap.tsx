'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconAnchor: [12, 41],
});

export type Position = { latitude: number; longitude: number; deviceId?: number; serverTime?: string };

export default function LeafletMap({ positions }: { positions: Position[] }) {
  const center: [number, number] = positions && positions.length
    ? [positions[0].latitude, positions[0].longitude]
    : [14.5547, 121.0244];

  return (
    <MapContainer center={center as LatLngExpression} zoom={12} style={{height:400, borderRadius:12}}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors' />
      {positions?.map((p, i) => (
        <Marker key={i} position={[p.latitude, p.longitude] as LatLngExpression} icon={icon}>
          <Popup>
            <div style={{fontSize:12}}>
              <div><b>deviceId:</b> {p.deviceId ?? '—'}</div>
              <div><b>time:</b> {p.serverTime ?? '—'}</div>
              <div><b>lat,lng:</b> {p.latitude},{p.longitude}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}