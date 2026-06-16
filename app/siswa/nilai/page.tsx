'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface RiwayatNilai {
  id: string;
  nilai: number;
  created_at: string;
  jadwal: {
    tanggal_ujian: string;
    mapel: {
      id: string; 
      nama_mapel: string;
    } | null;
  } | null;
}

export default function RekapNilaiSiswaPage() {
  const router = useRouter();
  const [listNilai, setListNilai] = useState<RiwayatNilai[]>([]);
  const [fetching, setFetching] = useState(true);
  
  // 👤 State Profil Siswa (Sama seperti komponen Dashboard)
  const [namaSiswa, setNamaSiswa] = useState('Memuat nama...');
  const [kelasSiswa, setKelasSiswa] = useState('-'); 
  
  // 🏫 State Pengaturan Global Sekolah
  const [namaSekolah, setNamaSekolah] = useState('Ruang Ujian');

  // Fungsi pengubah huruf pertama menjadi kapital (Standardisasi Tampilan)
  const formatNama = (text: string) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const fetchNilaiSiswa = async () => {
      setFetching(true);
      
      // Mengambil session yang disimpan saat login / dashboard
      const siswaId = localStorage.getItem('session_siswa_id');
      const namaLocal = localStorage.getItem('session_siswa_nama');
      const kelasLengkap = localStorage.getItem('session_siswa_kelas_lengkap');
      
      if (!siswaId) {
        router.replace('/login-siswa');
        return;
      }

      // 1. Prioritaskan nama dari Local Storage agar instan & sama persis seperti Dashboard
      if (namaLocal) {
        setNamaSiswa(formatNama(namaLocal));
      }
      setKelasSiswa(kelasLengkap || '-');
      
      try {
        // 🏫 2. Ambil Nama Sekolah
        const { data: globalConfig } = await supabase
          .from('pengaturan_global')
          .select('nama_sekolah')
          .maybeSingle();

        if (globalConfig?.nama_sekolah) {
          setNamaSekolah(globalConfig.nama_sekolah);
        }

        // 📝 3. Ambil Riwayat Nilai
        const { data, error } = await supabase
          .from('nilai_siswa')
          .select(`
            id,
            nilai,
            created_at,
            jadwal:id_jadwal(
              tanggal_ujian,
              mapel(id, nama_mapel)
            )
          `)
          .eq('id_siswa', siswaId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Gagal mengambil data rekap nilai:", error.message);
          throw error;
        }

        // 👤 4. Validasi nama real-time dari profiles jika di local storage kosong
        if (!namaLocal) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nama_lengkap')
            .eq('id', siswaId)
            .maybeSingle();

          if (profileData?.nama_lengkap) {
            setNamaSiswa(formatNama(profileData.nama_lengkap));
          } else {
            setNamaSiswa('Siswa');
          }
        }

        // 📊 5. Pemetaan Data ke Tabel
        if (data) {
          const formatData = (data as any[]).map((item) => ({
            id: item.id,
            nilai: item.nilai ?? 0,
            created_at: item.created_at,
            jadwal: item.jadwal ? {
              tanggal_ujian: item.jadwal.tanggal_ujian,
              mapel: item.jadwal.mapel ? {
                id: item.jadwal.mapel.id || '-',
                nama_mapel: item.jadwal.mapel.nama_mapel || 'Tanpa Nama Mapel'
              } : null
            } : null
          }));

          setListNilai(formatData as RiwayatNilai[]);
        }
      } catch (err) {
        console.error("Sistem error:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchNilaiSiswa();
  }, [router]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      
      {/* 🌟 BANNER HEADER (SINKRON DENGAN DASHBOARD) */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-black tracking-tight">
            Rekap Nilai: <span className="text-yellow-300">{namaSiswa}</span> di {namaSekolah}! 👋
          </h2>
          <p className="text-xs text-blue-100 opacity-90">
            Lihat riwayat perolehan skor hasil ujian yang telah selesai Anda kerjakan.
          </p>
        </div>

        {/* CONTROLS PROFILE & BACK BUTTON */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3.5 py-2 rounded-xl">
            <span className="text-lg">🏫</span>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-blue-200">Kelas</div>
              <div className="text-xs font-mono font-black text-yellow-300">{kelasSiswa}</div>
            </div>
          </div>

          <button
            onClick={() => router.push('/siswa/dashboard')}
            className="flex items-center gap-2 bg-gray-950/40 hover:bg-gray-950/60 border border-white/20 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm"
          >
            🏠 Dashboard
          </button>
        </div>
      </div>

      {/* TABEL DATA REKAP */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Mata Pelajaran</th>
                <th className="p-4">Tanggal Ujian</th>
                <th className="p-4 text-center w-32">Nilai Akhir</th>
                <th className="p-4 text-center w-36">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm divide-y divide-gray-100 font-medium">
              {fetching ? (
                <tr>
                  <td colSpan={5} className="text-center p-12 text-xs font-bold text-gray-400 tracking-widest uppercase animate-pulse">
                    ⏳ Memuat riwayat nilai...
                  </td>
                </tr>
              ) : listNilai.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-12 text-sm text-gray-400 font-medium">
                    📭 Anda belum memiliki riwayat ujian atau nilai belum dirilis.
                  </td>
                </tr>
              ) : (
                listNilai.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-400 text-center font-mono">{index + 1}</td>
                    
                    <td className="p-4">
                      <p className="font-bold text-gray-900">{item.jadwal?.mapel?.nama_mapel || 'Tanpa Nama Mapel'}</p>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                        ID MAPEL: {item.jadwal?.mapel?.id || '-'}
                      </span>
                    </td>
                    
                    <td className="p-4 text-gray-500 font-mono text-xs">
                      {item.jadwal?.tanggal_ujian 
                        ? new Date(item.jadwal.tanggal_ujian).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : '-'}
                    </td>
                    
                    <td className="p-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-lg font-mono font-black text-sm ${
                        item.nilai >= 75 
                          ? 'bg-green-50 text-green-600 border border-green-100' 
                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {item.nilai}
                      </span>
                    </td>
                    
                    <td className="p-4 text-center">
                      <span className="bg-green-50 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full border border-green-100 shadow-sm">
                        Selesai
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