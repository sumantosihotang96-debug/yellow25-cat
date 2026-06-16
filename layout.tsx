import type { Metadata } from 'next';
import './globals.css'; // Memastikan Tailwind CSS kita aktif di semua halaman

export const metadata: Metadata = {
  title: 'CBT Nasional Engine',
  description: 'Sistem Ujian Berbasis Komputer Konfigurasi Mandiri',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {/* {children} ini adalah tempat halaman page.tsx (Login/Dashboard) dimasukkan secara dinamis */}
        {children}
      </body>
    </html>
  );
}