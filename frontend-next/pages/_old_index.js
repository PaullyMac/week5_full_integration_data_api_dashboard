// frontend-next/pages/index.js
import dynamic from "next/dynamic";
const MapNoSSR = dynamic(() => import("../components/Map"), { ssr: false });

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Thumbworx Live Tracking</h1>
      <MapNoSSR />
    </main>
  );
}