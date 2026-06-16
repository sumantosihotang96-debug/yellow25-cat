'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    siswa: 0,
    guru: 0,
    mapel: 0,
    ujianAktif: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        // 🛠️ PERBAIKAN 1: Format Tanggal Mengikuti Timezone Lokal (WIB / GMT+7)
        const formatTglLokal = () => {
          const d = new Date();
          const offset = d.getTimezoneOffset();
          const tglLokal = new Date(d.getTime() - (offset * 60 * 1000));
          return tglLokal.toISOString().split('T')[0];
        };
        
        const hariIni = formatTglLokal();

        // 🛠️ PERBAIKAN 2: Gunakan Promise.all agar query diproses secara paralel (jauh lebih cepat)
        const [resSiswa, resGuru, resMapel, resUjian] = await Promise.all([
          // 1. Hitung jumlah siswa dari tabel profiles
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'siswa'),

          // 2. Hitung jumlah guru dari tabel profiles
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'guru'),

          // 3. Hitung jumlah mata pelajaran
          supabase
            .from('mapel')
            .select('*', { count: 'exact', head: true }),

          // 4. Hitung jadwal ujian aktif hari ini
          supabase
            .from('jadwal_ujian')
            .select('*', { count: 'exact', head: true })
            .eq('tanggal_ujian', hariIni)
        ]);

        setStats({
          siswa: resSiswa.count || 0,
          guru: resGuru.count || 0,
          mapel: resMapel.count || 0,
          ujianAktif: resUjian.count || 0,
        });
      } catch (error) {
        console.error('Gagal memuat statistik dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Bagian Selamat Datang */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Ringkasan Sistem CBT</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pantau seluruh aktivitas data master, akun pengguna, dan status ujian secara berkala.
        </p>
      </div>

      {/* Grid Kartu Statistik Modern */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Kartu Siswa */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Siswa</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">
              {loading ? '...' : stats.siswa}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xl">
            🎓
          </div>
        </div>

        {/* Kartu Guru */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Guru</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">
              {loading ? '...' : stats.guru}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xl">
            👨‍🏫
          </div>
        </div>

        {/* Kartu Mapel */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mata Pelajaran</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">
              {loading ? '...' : stats.mapel}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-xl">
            📚
          </div>
        </div>

        {/* Kartu Ujian Hari Ini */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ujian Hari Ini</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">
              {loading ? '...' : stats.ujianAktif}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 font-bold text-xl">
            ⏱️
          </div>
        </div>
      </div>

      {/* Informasi Log Aktivitas Darurat */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-base font-bold text-gray-800 mb-2">Panduan Cepat Admin</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Sebagai Administrator Utama, Anda bertanggung jawab penuh atas kelancaran siklus ujian. Pastikan untuk memperbarui 
          <strong> Data Master Sekolah</strong> sebelum merilis <strong>Jadwal & Token Ujian</strong> baru. Jika terdapat kendala 
          teknis di mana guru berhalangan melengkapi materi visual, Anda dapat memanfaatkan fitur <strong>Mode Penyisipan Gambar</strong> 
          untuk membantu memperbarui bank soal secara instan berdasarkan kode ID Soal.
        </p>
      </div>
    </div>
  );
}