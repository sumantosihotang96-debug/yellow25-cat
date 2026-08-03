'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function GuruLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sudahLogin, setSudahLogin] = useState(false);

  useEffect(() => {
    // Proteksi keamanan berlapis di tingkat layout
    if (typeof window !== 'undefined') {
      const idGuru = localStorage.getItem('session_guru_id');
      const nipGuru = localStorage.getItem('session_guru_nip');

      console.log(`[Layout Protector] Memeriksa Token Sesi Guru -> ID: ${idGuru}, NIP: ${nipGuru}`);

      if (!nipGuru || !idGuru) {
        console.warn('⚠️ Sesi tidak lengkap atau korup! Memaksa pembersihan lokal dan redirect ke login.');
        localStorage.removeItem('session_guru_id');
        localStorage.removeItem('session_guru_nip');
        localStorage.removeItem('session_guru_nama');

        router.push('/');
      } else {
        setSudahLogin(true);
      }
    }
  }, [router, pathname]);

  const handleLogout = () => {
    if (confirm('Apakah Anda ingin keluar dari ekosistem panel Guru?')) {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      }
    }
  };

  // Helper untuk mengecek keaktifan tautan
  const isPathActive = (path: string) => {
    if (path === '/guru') return pathname === '/guru';
    return pathname.startsWith(path);
  };

  if (!sudahLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-400 tracking-wider uppercase animate-pulse">
        Memvalidasi Otorisasi Panel...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* 1. SIDEBAR DESKTOP (Sembunyi di HP dengan 'hidden md:flex') */}
      <aside className="hidden md:flex w-64 bg-gray-900 text-white p-6 flex-col justify-between fixed h-full z-50 shadow-xl border-r border-gray-950">
        <div className="space-y-6">
          <div className="border-b border-gray-800/60 pb-4">
            <h2 className="text-sm font-black tracking-widest text-amber-400">PANEL AKADEMIK</h2>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">
              Hak Akses: Tenaga Pengajar
            </p>
          </div>

          <nav className="flex flex-col space-y-1 text-xs font-bold tracking-wide">
            <Link
              href="/guru"
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                isPathActive('/guru') && pathname === '/guru'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              🏠 Dashboard Utama
            </Link>

            <Link
              href="/guru/bank-soal"
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                isPathActive('/guru/bank-soal')
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              📝 Kelola Bank Soal
            </Link>

            <Link
              href="/guru/pantau-ujian"
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                isPathActive('/guru/pantau-ujian')
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              ⚡ Pantau Live Siswa
            </Link>

            <Link
              href="/guru/rekap-nilai"
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                isPathActive('/guru/rekap-nilai')
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              📊 Rekap Nilai Akhir
            </Link>
          </nav>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full bg-red-950/40 hover:bg-red-900/60 text-red-300 p-3 rounded-xl text-[11px] font-black tracking-wider uppercase transition-all border border-red-900/30"
        >
          🚪 Keluar Aplikasi
        </button>
      </aside>

      {/* 2. AREA KONTEN UTAMA (Margin disesuaikan: ml-0 pada mobile, md:ml-64 pada desktop) */}
      <main className="flex-1 ml-0 md:ml-64 p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen text-gray-800 overflow-x-hidden pb-24 md:pb-8">
        {children}
      </main>

      {/* 3. BOTTOM NAVIGATION BAR (Khusus Tampilan Mobile - Sembunyi di Desktop dengan 'md:hidden') */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800 px-2 py-2 md:hidden z-50 flex justify-around items-center shadow-2xl">
        <Link
          href="/guru"
          className={`flex flex-col items-center gap-0.5 min-w-[50px] transition ${
            pathname === '/guru' ? 'text-amber-400 font-bold' : 'text-gray-400'
          }`}
        >
          <span className="text-base">🏠</span>
          <span className="text-[10px]">Home</span>
        </Link>

        <Link
          href="/guru/bank-soal"
          className={`flex flex-col items-center gap-0.5 min-w-[50px] transition ${
            isPathActive('/guru/bank-soal') ? 'text-amber-400 font-bold' : 'text-gray-400'
          }`}
        >
          <span className="text-base">📝</span>
          <span className="text-[10px]">Soal</span>
        </Link>

        <Link
          href="/guru/pantau-ujian"
          className={`flex flex-col items-center gap-0.5 min-w-[50px] transition ${
            isPathActive('/guru/pantau-ujian') ? 'text-amber-400 font-bold' : 'text-gray-400'
          }`}
        >
          <span className="text-base">⚡</span>
          <span className="text-[10px]">Live</span>
        </Link>

        <Link
          href="/guru/rekap-nilai"
          className={`flex flex-col items-center gap-0.5 min-w-[50px] transition ${
            isPathActive('/guru/rekap-nilai') ? 'text-amber-400 font-bold' : 'text-gray-400'
          }`}
        >
          <span className="text-base">📊</span>
          <span className="text-[10px]">Nilai</span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 text-red-400 min-w-[50px] transition"
        >
          <span className="text-base">🚪</span>
          <span className="text-[10px]">Keluar</span>
        </button>
      </nav>

    </div>
  );
}