'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface SesiSiswa {
  id: string;
  status_ujian: string;
  sisa_waktu_menit: number;
  siswa: {
    nama_lengkap: string;
    kelas: string;
  } | null;
  jadwal: {
    mapel: {
      nama_mapel: string;
    };
  } | null;
}

export default function PantauUjianGuruPage() {
  const router = useRouter();
  const [sesiArr, setSesiArr] = useState<SesiSiswa[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchSesiLive = async () => {
    setFetching(true);
    try {
      if (typeof window !== 'undefined') {
        const idGuru = localStorage.getItem('session_guru_id');
        
        if (!idGuru) {
          router.push('/login-guru');
          return;
        }

        // TAHAP 1: Ambil daftar id_mapel yang diampu oleh guru ini
        const { data: guruMapel, error: guruMapelErr } = await supabase
          .from('guru_mapel')
          .select('mapel_id')
          .eq('guru_id', idGuru);

        if (guruMapelErr) throw guruMapelErr;

        const mapelIds = guruMapel?.map((item) => item.mapel_id) || [];

        if (mapelIds.length === 0) {
          setSesiArr([]);
          setFetching(false);
          return;
        }

        // TAHAP 2: Ambil data sesi aktif menggunakan target relasi siswa_id ke tabel profiles
        const { data, error } = await supabase
          .from('sesi_ujian')
          .select(`
            id,
            status_ujian,
            sisa_waktu_menit,
            siswa:siswa_id(nama_lengkap, kelas),
            jadwal:id_jadwal(
              mapel_id,
              mapel:mapel_id(nama_mapel)
            )
          `);

        if (error) {
          // Jika id_jadwal juga bermasalah dengan nama relasi cache, gunakan fallback ke kode lama Anda
          console.warn("Mencoba fallback query jika schema mapel ketat...");
          const { data: fallbackData, error: fallbackErr } = await supabase
            .from('sesi_ujian')
            .select(`
              id,
              status_ujian,
              sisa_waktu_menit,
              siswa:profiles!sesi_ujian_siswa_id_fkey(nama_lengkap, kelas),
              jadwal:jadwal_ujian!inner(mapel_id, mapel(nama_mapel))
            `);
          
          if (fallbackErr) throw fallbackErr;
          
          if (fallbackData) {
            memprosesDataSesi(fallbackData, mapelIds);
          }
          return;
        }

        if (data) {
          memprosesDataSesi(data, mapelIds);
        }
      }
    } catch (err: any) {
      console.error('Gagal memantau sesi ujian live:', err.message);
    } finally {
      setFetching(false);
    }
  };

  // Fungsi pembantu untuk memfilter dan memetakan data array
  const memprosesDataSesi = (rawData: any[], mapelIds: string[]) => {
    // Saring agar hanya mapel yang diampu oleh guru ini yang muncul
    const sesiMilikGuru = rawData.filter((sesi) => {
      const mapelIdDariSesi = sesi.jadwal?.mapel_id;
      return mapelIdDariSesi && mapelIds.includes(mapelIdDariSesi);
    });

    const hasilPemetaan: SesiSiswa[] = sesiMilikGuru.map((s) => ({
      id: s.id,
      status_ujian: s.status_ujian,
      sisa_waktu_menit: s.sisa_waktu_menit,
      siswa: s.siswa ? { nama_lengkap: s.siswa.nama_lengkap, kelas: s.siswa.kelas } : null,
      jadwal: s.jadwal && s.jadwal.mapel ? { mapel: { nama_mapel: s.jadwal.mapel.nama_mapel } } : null,
    }));

    setSesiArr(hasilPemetaan);
  };

  useEffect(() => {
    fetchSesiLive();

    // Auto-refresh otomatis setiap 30 detik
    const interval = setInterval(() => {
      fetchSesiLive();
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      {/* HEADER PANTAUAN */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-gray-900">Layar Pantau Ruang Ujian Live</h1>
          <p className="text-xs text-gray-500 mt-0.5">Awasi status pengerjaan lembar ujian siswa Anda secara langsung (Real-time otomatis per 30 detik).</p>
        </div>
        <button 
          onClick={fetchSesiLive} 
          disabled={fetching}
          className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md shrink-0"
        >
          {fetching ? '🔄 Memindai...' : '🔄 Perbarui Grid Manual'}
        </button>
      </div>

      {/* GRID DAFTAR MONITORING */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4 w-32 text-center">Kelas</th>
                <th className="p-4">Mata Pelajaran</th>
                <th className="p-4 text-center w-36">Status Aktivitas</th>
                <th className="p-4 text-center w-28">Sisa Waktu</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 divide-y divide-gray-100 font-semibold">
              {fetching && sesiArr.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12 text-gray-400 animate-pulse font-bold tracking-wide uppercase">
                    ⏳ Sedang memindai ruang ujian siswa...
                  </td>
                </tr>
              ) : sesiArr.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12 text-gray-400 font-medium">
                    📭 Belum ada siswa dari kelas Anda yang terdeteksi sedang membuka lembar ujian.
                  </td>
                </tr>
              ) : (
                sesiArr.map((sesi, idx) => (
                  <tr key={sesi.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-400 text-center font-mono">{idx + 1}</td>
                    <td className="p-4 font-black text-gray-900 text-sm">{sesi.siswa?.nama_lengkap || 'Siswa Tanpa Nama'}</td>
                    <td className="p-4 text-center">
                      <span className="bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                        {sesi.siswa?.kelas || '-'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 font-medium">{sesi.jadwal?.mapel?.nama_mapel || '-'}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border shadow-sm ${
                        sesi.status_ujian?.toLowerCase() === 'berjalan' || sesi.status_ujian?.toLowerCase() === 'aktif'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {sesi.status_ujian || 'Belum Mulai'}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono font-black text-blue-600 text-sm">
                      {sesi.sisa_waktu_menit} <span className="text-[10px] font-medium text-gray-400">m</span>
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