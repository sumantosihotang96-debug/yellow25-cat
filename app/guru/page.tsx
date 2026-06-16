'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface MapelDetail {
  id: string;
  nama_mapel: string;
  kelas: string;
  jurusan: string;
}

export default function GuruDashboardPage() {
  const router = useRouter();
  const [namaGuru, setNamaGuru] = useState('');
  const [nipGuru, setNipGuru] = useState('');
  const [mapelDiampu, setMapelDiampu] = useState<MapelDetail[]>([]);
  const [stats, setStats] = useState({ totalSoal: 0, ujianAktif: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const muatDataDashboard = async () => {
      try {
        if (typeof window !== 'undefined') {
          const idGuru = localStorage.getItem('session_guru_id');
          const nipSimpanan = localStorage.getItem('session_guru_nip');
          const namaSimpanan = localStorage.getItem('session_guru_nama');

          // Pengaman jika sesi tidak ditemukan
          if (!idGuru) {
            router.push('/login-guru');
            return;
          }

          setNamaGuru(namaSimpanan || 'Guru');
          setNipGuru(nipSimpanan || '-');

          // 1. Ambil relasi jadwal mata pelajaran yang diampu oleh guru ini dari tabel guru_mapel
          const { data: relasiMapel, error: relasiErr } = await supabase
            .from('guru_mapel')
            .select('mapel_id, mapel(id, nama_mapel, kelas, jurusan)')
            .eq('guru_id', idGuru);

          if (relasiErr) throw relasiErr;

          const listMapel: MapelDetail[] = [];
          const mapelIds: string[] = [];

          if (relasiMapel) {
            relasiMapel.forEach((item: any) => {
              if (item.mapel) {
                listMapel.push({
                  id: item.mapel.id,
                  nama_mapel: item.mapel.nama_mapel,
                  kelas: item.mapel.kelas || 'Semua',
                  jurusan: item.mapel.jurusan || 'UMUM',
                });
                mapelIds.push(item.mapel_id);
              }
            });
            setMapelDiampu(listMapel);
          }

          // 2. Jika ada mata pelajaran terdaftar, lakukan perhitungan statistik instan
          if (mapelIds.length > 0) {
            
            // A. Hitung total bank soal yang dibuat guru berdasarkan id_mapel
            const { count: countSoal } = await supabase
              .from('soal')
              .select('*', { count: 'exact', head: true })
              .in('id_mapel', mapelIds);

            // B. Hitung Jadwal Ujian Aktif Hari Ini (Menggunakan format YYYY-MM-DD lokal)
            const tgl = new Date();
            const yyyy = tgl.getFullYear();
            const mm = String(tgl.getMonth() + 1).padStart(2, '0');
            const dd = String(tgl.getDate()).padStart(2, '0');
            const hariIniLokal = `${yyyy}-${mm}-${dd}`;

            // DISESUAIKAN: Menyaring data tabel 'jadwal_ujian' berdasarkan kolom 'mapel_id'
            const { count: countUjian } = await supabase
              .from('jadwal_ujian')
              .select('*', { count: 'exact', head: true })
              .eq('tanggal_ujian', hariIniLokal)
              .in('mapel_id', mapelIds);

            setStats({
              totalSoal: countSoal || 0,
              ujianAktif: countUjian || 0,
            });
          }
        }
      } catch (error) {
        console.error('Gagal memuat informasi dashboard guru:', error);
      } finally {
        setLoading(false);
      }
    };

    muatDataDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs font-bold text-gray-400 tracking-wider uppercase animate-pulse">
        ⏳ Menyusun Informasi Dashboard...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      
      {/* CARD PROFIL GURU */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Selamat Datang, {namaGuru}!</h1>
          <p className="text-xs text-gray-500 mt-0.5">NIP: {nipGuru} • Hak Akses Portal: Guru</p>
        </div>
        <button
          onClick={() => router.push('/guru/rekap-nilai')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition shrink-0"
        >
          📊 Lihat Rekap Nilai Siswa
        </button>
      </div>

      {/* PANEL STATISTIK RINGKAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            📝
          </div>
          <div>
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Total Bank Soal</span>
            <span className="text-xl font-black text-gray-900 font-mono">
              {stats.totalSoal} <span className="text-xs font-medium text-gray-500">Soal</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            ⚡
          </div>
          <div>
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ujian Aktif Hari Ini</span>
            <span className="text-xl font-black text-emerald-600 font-mono">
              {stats.ujianAktif} <span className="text-xs font-medium text-gray-500">Sesi</span>
            </span>
          </div>
        </div>
      </div>

      {/* TABEL JADWAL MAPEL YANG DIAMPU */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
            📖 Jadwal Mata Pelajaran Diampu ({mapelDiampu.length})
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Daftar kelas pengajaran aktif Anda yang terdaftar di dalam database sistem.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="pb-3 w-12 text-center">No</th>
                <th className="pb-3 pl-2">Mata Pelajaran</th>
                <th className="pb-3 text-center w-28">Kelas</th>
                <th className="pb-3 text-center w-40">Jurusan / Peminatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700 font-semibold">
              {mapelDiampu.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 font-medium">
                    ⚠️ Anda belum ditugaskan mengajar mata pelajaran apa pun oleh Administrator.
                  </td>
                </tr>
              ) : (
                mapelDiampu.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 text-center text-gray-400 font-mono">{index + 1}</td>
                    <td className="py-3.5 pl-2 text-gray-900 font-black text-sm tracking-wide">{item.nama_mapel}</td>
                    <td className="py-3.5 text-center">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md text-[11px] font-bold border border-blue-100">
                        Kelas {item.kelas}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-md text-[11px] font-mono tracking-wide">
                        {item.jurusan}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}