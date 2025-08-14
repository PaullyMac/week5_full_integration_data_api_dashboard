// frontend-next/app/layout.tsx
import 'leaflet/dist/leaflet.css'; // global CSS from node_modules must be imported in a layout
import './globals.css';            // optional: create an empty file if you don't have styles yet
import React from 'react';

export const metadata = {
  title: 'Week 5 – Dashboard',
  description: 'Data App + API + Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f7f7f7' }}>{children}</body>
    </html>
  );
}