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
    // Jalankan proteksi keamanan berlapis di tingkat layout klien
    if (typeof window !== 'undefined') {
      const idGuru = localStorage.getItem('session_guru_id');
      const nipGuru = localStorage.getItem('session_guru_nip');
      
      // DIAGNOSTIK INTERNAL (Bisa dilihat di F12 Browser)
      console.log(`[Layout Protector] Memeriksa Token Sesi Guru -> ID: ${idGuru}, NIP: ${nipGuru}`);
      
      // KUNCI AMAN: Dua token ini wajib ada. Jika salah satu hilang, data database pasti zonk.
      if (!nipGuru || !idGuru) {
        console.warn('⚠️ Sesi tidak lengkap atau korup! Memaksa pembersihan lokal dan redosir ke login.');
        localStorage.removeItem('session_guru_id');
        localStorage.removeItem('session_guru_nip');
        localStorage.removeItem('session_guru_nama');
        router.push('/login'); 
      } else {
        setSudahLogin(true);
      }
    }
  }, [router, pathname]); // Ikut memantau perpindahan halaman (pathname)

  // Mencegah kedipan kebocoran konten sebelum status terverifikasi sepenuhnya
  if (!sudahLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-400 tracking-wider uppercase animate-pulse">
        Memvalidasi Otorisasi Panel...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      
      {/* SIDEBAR GURU (Tetap stand-by stabil di sisi kiri) */}
      <aside className="w-64 bg-gray-900 text-white p-6 flex flex-col justify-between fixed h-full z-50 shadow-xl border-r border-gray-950">
        <div className="space-y-6">
          <div className="border-b border-gray-800/60 pb-4">
            <h2 className="text-sm font-black tracking-widest text-amber-400">PANEL AKADEMIK</h2>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">Hak Akses: Tenaga Pengajar</p>
          </div>
          
          {/* Menu Navigasi Internal Menggunakan Komponen Link Next.js Tanpa Reload */}
          <nav className="flex flex-col space-y-1 text-xs font-bold tracking-wide">
            <Link 
              href="/guru" 
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                pathname === '/guru' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              🏠 Dashboard Utama
            </Link>
            
            <Link 
              href="/guru/bank-soal" 
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                pathname === '/guru/bank-soal' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              📝 Kelola Bank Soal
            </Link>
            
            <Link 
              href="/guru/pantau-ujian" 
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                pathname === '/guru/pantau-ujian' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              ⚡ Pantau Live Siswa
            </Link>
            
            <Link 
              href="/guru/rekap-nilai" 
              className={`p-3 rounded-xl transition-all flex items-center gap-2.5 ${
                pathname.includes('/rekap-nilai') 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              📊 Rekap Nilai Akhir
            </Link>
          </nav>
        </div>

        {/* Tombol Pemutus Sesi Aplikasi */}
        <button
          type="button"
          onClick={() => {
            if (confirm('Apakah Anda ingin keluar dari ekosistem panel Guru?')) {
              localStorage.clear(); // Hapus seluruh sisa kredensial di lokal browser
              router.push('/login'); 
            }
          }}
          className="w-full bg-red-950/40 hover:bg-red-900/60 text-red-300 p-3 rounded-xl text-[11px] font-black tracking-wider uppercase transition-all border border-red-900/30"
        >
          🚪 Keluar Aplikasi
        </button>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <main className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen text-gray-800 overflow-x-hidden">
        {children}
      </main>
      
    </div>
  );
}