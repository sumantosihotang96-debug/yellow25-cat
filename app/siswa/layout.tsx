'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

// 🚀 IMPORT UTAMA UNTUK MENDUKUNG RENDER EQUATION MATH/LATEX SISWA
import 'katex/dist/katex.min.css';

export default function SiswaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [namaSiswa, setNamaSiswa] = useState('');
  
  // 🏫 State Nama Instansi Otomatis dari Pengaturan Global
  const [namaSekolah, setNamaSekolah] = useState('Portal Ujian Siswa');

  // Fungsi mengubah huruf pertama nama menjadi kapital agar rapi di navbar
  const formatNama = (text: string) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Ambil konfigurasi nama sekolah dari database
  const fetchNamaSekolah = async () => {
    try {
      const { data, error } = await supabase
        .from('pengaturan_global')
        .select('nama_sekolah')
        .maybeSingle();

      if (!error && data?.nama_sekolah) {
        setNamaSekolah(data.nama_sekolah);
      }
    } catch (err) {
      console.error('Gagal memuat identitas nama sekolah di layout navbar:', err);
    }
  };

  useEffect(() => {
    // Pastikan kode hanya berjalan di sisi client (browser)
    if (typeof window !== 'undefined') {
      const idSiswa = localStorage.getItem('session_siswa_id');
      const nama = localStorage.getItem('session_siswa_nama');
      
      // Validasi ketat jika session kosong, string 'null', atau string 'undefined'
      if (!idSiswa || idSiswa === 'undefined' || idSiswa === 'null') {
        localStorage.clear();
        router.replace('/login-siswa');
      } else {
        setNamaSiswa(formatNama(nama || 'Siswa'));
        // Jalankan paralel pengisian nama sekolah global
        fetchNamaSekolah().finally(() => {
          setLoading(false);
        });
      }
    }
  }, [router]);

  // Tampilan Loading Tracker agar Layout tidak merender konten sebelum dipastikan aman
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold tracking-wider uppercase animate-pulse">Memeriksa Akses Otentikasi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* NAVBAR */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎓</span>
            {/* 🏫 SEKARANG: Otomatis mengikuti inputan database pengaturan_global */}
            <h1 className="font-black text-gray-950 tracking-tight text-sm uppercase">
              {namaSekolah}
            </h1>
          </div>
          
          {/* IDENTITAS SISWA (READ-ONLY) */}
          <div className="text-xs font-bold text-indigo-600 bg-indigo-50/70 px-4 py-1.5 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-1.5 cursor-default select-none">
            <span>👤</span>
            <span>{namaSiswa}</span>
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4">
        {children}
      </main>
    </div>
  );
}