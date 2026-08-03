'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface ProgressSiswa {
  id_siswa: string;
  nama_siswa: string;
  kelas: string;
  id_jadwal: string;
  nama_mapel: string;
  total_soal_tampil: number;
  jumlah_terjawab: number;
  jumlah_pelanggaran: number;
  is_selesai: boolean;
  waktu_terakhir_aktif: string;
}

export default function PantauUjianAdminPage() {
  const router = useRouter();
  const [listPantau, setListPantau] = useState<ProgressSiswa[]>([]);
  const [listKelas, setListKelas] = useState<string[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('SEMUA');
  const [fetching, setFetching] = useState(true);

  // 1. Ambil daftar kelas unik dari database untuk pilihan filter
  const fetchDaftarKelas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('kelas')
        .not('kelas', 'is', null);

      if (!error && data) {
        const kelasUnik = Array.from(
          new Set(data.map((item) => item.kelas).filter(Boolean))
        ).sort();
        setListKelas(kelasUnik as string[]);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar kelas:', err);
    }
  }, []);

  // 2. Fetch data pengerjaan live siswa
  const fetchPantauanLive = useCallback(async () => {
    setFetching(true);
    try {
      if (typeof window === 'undefined') return;
      const idAdmin = localStorage.getItem('session_admin_id');

      if (!idAdmin) {
        router.push('/login-admin');
        return;
      }

      // TAHAP 1: Ambil data nilai_siswa untuk status pelanggaran & nilai
      const { data: dataNilai } = await supabase
        .from('nilai_siswa')
        .select('id_siswa, id_jadwal, jumlah_pelanggaran, nilai');

      const statusMap: { [key: string]: { pelanggaran: number; selesai: boolean } } = {};
      dataNilai?.forEach((n) => {
        const key = `${n.id_siswa}-${n.id_jadwal}`;
        statusMap[key] = {
          pelanggaran: n.jumlah_pelanggaran || 0,
          selesai: n.nilai !== null && n.nilai !== undefined,
        };
      });

      // TAHAP 2: Ambil seluruh data jawaban siswa + relasi ke profil & jadwal
      const { data: rawJawaban, error: errorJawaban } = await supabase
        .from('jawaban_siswa')
        .select(`
          id_siswa,
          id_jadwal,
          updated_at,
          siswa:id_siswa (
            nama_lengkap,
            kelas
          ),
          jadwal:id_jadwal (
            jumlah_soal_tampil,
            mapel:mapel_id (
              nama_mapel
            )
          )
        `);

      if (errorJawaban) throw errorJawaban;

      if (rawJawaban && rawJawaban.length > 0) {
        const akumulasiProgress: { [key: string]: ProgressSiswa } = {};

        (rawJawaban as any[]).forEach((row) => {
          const key = `${row.id_siswa}-${row.id_jadwal}`;
          const infoSiswa = row.siswa || { nama_lengkap: 'Siswa Tanpa Nama', kelas: 'Umum' };
          const infoStatus = statusMap[key] || { pelanggaran: 0, selesai: false };

          if (!akumulasiProgress[key]) {
            akumulasiProgress[key] = {
              id_siswa: row.id_siswa,
              id_jadwal: row.id_jadwal,
              nama_siswa: infoSiswa.nama_lengkap,
              kelas: infoSiswa.kelas || 'Umum',
              nama_mapel: row.jadwal?.mapel?.nama_mapel || 'Mata Pelajaran',
              total_soal_tampil: row.jadwal?.jumlah_soal_tampil || 0,
              jumlah_terjawab: 0,
              jumlah_pelanggaran: infoStatus.pelanggaran,
              is_selesai: infoStatus.selesai,
              waktu_terakhir_aktif: row.updated_at,
            };
          }

          akumulasiProgress[key].jumlah_terjawab += 1;

          if (new Date(row.updated_at) > new Date(akumulasiProgress[key].waktu_terakhir_aktif)) {
            akumulasiProgress[key].waktu_terakhir_aktif = row.updated_at;
          }
        });

        const hasilArray = Object.values(akumulasiProgress).sort(
          (a, b) => new Date(b.waktu_terakhir_aktif).getTime() - new Date(a.waktu_terakhir_aktif).getTime()
        );

        setListPantau(hasilArray);
      } else {
        setListPantau([]);
      }
    } catch (err: any) {
      console.error('Gagal memproses pantauan progres admin:', err.message || err);
    } finally {
      setFetching(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDaftarKelas();
    fetchPantauanLive();

    // ⚡ REALTIME SUBSCRIPTION
    const channelJawaban = supabase
      .channel('realtime-admin-monitoring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jawaban_siswa' }, () => {
        fetchPantauanLive();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nilai_siswa' }, () => {
        fetchPantauanLive();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelJawaban);
    };
  }, [fetchDaftarKelas, fetchPantauanLive]);

  // Filter daftar siswa berdasarkan kelas yang dipilih di Dropdown UI
  const filteredList = useMemo(() => {
    if (selectedKelas === 'SEMUA') return listPantau;
    return listPantau.filter((item) => item.kelas.toLowerCase() === selectedKelas.toLowerCase());
  }, [listPantau, selectedKelas]);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6 max-w-7xl mx-auto">
      {/* PANEL CONTROL HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-gray-900">🛡️ Radar Ujian Live</h1>
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Pantau progres pengerjaan ujian dan indikasi pelanggaran siswa secara terpusat.
          </p>
        </div>

        {/* CONTROLS: FILTER KELAS & REFRESH */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Dropdown Filter Kelas */}
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <label htmlFor="filterKelas" className="text-xs font-bold text-gray-500 whitespace-nowrap">
              Filter Kelas:
            </label>
            <select
              id="filterKelas"
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-900 outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value="SEMUA">🌐 Semua Kelas ({listPantau.length})</option>
              {listKelas.map((k) => (
                <option key={k} value={k}>
                  🏫 Kelas {k}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchPantauanLive}
            disabled={fetching}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md shrink-0 flex items-center justify-center gap-2 active:scale-95"
          >
            {fetching ? '🔄 Memindai...' : '🔄 Refresh Manual'}
          </button>
        </div>
      </div>

      {/* 📱 MOBILE VIEW: KARTU LIST SISWA (Hanya Tampil di Smartphone) */}
      <div className="block md:hidden space-y-3">
        {fetching && filteredList.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border text-center text-gray-400 font-bold text-xs animate-pulse">
            ⏳ Sedang memuat radar aktivitas siswa...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border text-center text-gray-400 font-medium text-xs">
            📭 Tidak ada aktivitas ujian untuk kelas ini.
          </div>
        ) : (
          filteredList.map((item) => {
            const total = item.total_soal_tampil || 1;
            const persen = Math.min(Math.round((item.jumlah_terjawab / total) * 100), 100);
            const waktuAktif = new Date(item.waktu_terakhir_aktif).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div key={`${item.id_siswa}-${item.id_jadwal}`} className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                {/* Header Kartu: Nama & Kelas */}
                <div className="flex justify-between items-start gap-2 border-b border-gray-100 pb-2.5">
                  <div>
                    <h3 className="font-black text-gray-900 text-sm">{item.nama_siswa}</h3>
                    <p className="text-[11px] text-gray-500 font-medium">{item.nama_mapel}</p>
                  </div>
                  <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] shrink-0">
                    {item.kelas}
                  </span>
                </div>

                {/* Status Badges */}
                <div className="flex items-center justify-between text-xs">
                  <div>
                    {item.is_selesai ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        ✅ Selesai
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase animate-pulse">
                        📝 Mengerjakan
                      </span>
                    )}
                  </div>

                  <div>
                    {item.jumlah_pelanggaran > 0 ? (
                      <span className="bg-red-50 text-red-600 border border-red-200 font-mono font-black px-2 py-0.5 rounded text-[10px] animate-bounce inline-block">
                        ⚠️ Pelanggaran: {item.jumlah_pelanggaran}x
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px]">Aman (0 Pelanggaran)</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Soal */}
                <div className="space-y-1 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <div className="flex justify-between text-[11px] font-bold text-gray-700">
                    <span>Progres: <span className="text-indigo-600">{item.jumlah_terjawab}</span>/{item.total_soal_tampil} Soal</span>
                    <span className={persen === 100 ? 'text-emerald-600 font-mono' : 'text-gray-600 font-mono'}>{persen}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${persen === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                      style={{ width: `${persen}%` }}
                    ></div>
                  </div>
                </div>

                {/* Waktu Aktif Terakhir */}
                <div className="text-right text-[10px] text-indigo-600 font-mono">
                  ⚡ Terakhir aktif: {waktuAktif} WIB
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 💻 DESKTOP VIEW: MONITORING TABEL (Hanya Tampil di Tablet / Dekstop) */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Lengkap Siswa</th>
                <th className="p-4 w-28 text-center">Kelas</th>
                <th className="p-4">Mata Pelajaran</th>
                <th className="p-4 text-center w-36">Progres Isian</th>
                <th className="p-4 text-center w-40">Bilah Visual</th>
                <th className="p-4 text-center w-32">Pelanggaran</th>
                <th className="p-4 text-center w-32">Status</th>
                <th className="p-4 text-center w-36">Aktivitas Terakhir</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 divide-y divide-gray-100 font-semibold">
              {fetching && filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-12 text-gray-400 font-bold tracking-wide uppercase animate-pulse">
                    ⏳ Sedang memuat radar aktivitas siswa...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-12 text-gray-400 font-medium">
                    📭 Tidak ada aktivitas ujian yang ditemukan untuk kriteria kelas ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const total = item.total_soal_tampil || 1;
                  const persen = Math.min(Math.round((item.jumlah_terjawab / total) * 100), 100);
                  const waktuAktif = new Date(item.waktu_terakhir_aktif).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={`${item.id_siswa}-${item.id_jadwal}`} className="hover:bg-gray-50/40 transition-colors">
                      <td className="p-4 text-gray-400 text-center font-mono">{idx + 1}</td>
                      <td className="p-4 font-black text-gray-900 text-sm">{item.nama_siswa}</td>
                      <td className="p-4 text-center">
                        <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[11px]">
                          {item.kelas}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 font-medium">{item.nama_mapel}</td>

                      {/* PROGRES SOAL */}
                      <td className="p-4 text-center font-mono font-bold text-gray-900">
                        <span className="text-indigo-600 font-black">{item.jumlah_terjawab}</span> / {item.total_soal_tampil} Soal
                      </td>

                      {/* PROGRESS BAR */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                            <div
                              className={`h-full transition-all duration-300 ${
                                persen === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${persen}%` }}
                            ></div>
                          </div>
                          <span
                            className={`font-mono font-bold text-[11px] w-8 text-right ${
                              persen === 100 ? 'text-emerald-600' : 'text-gray-500'
                            }`}
                          >
                            {persen}%
                          </span>
                        </div>
                      </td>

                      {/* STATUS PELANGGARAN */}
                      <td className="p-4 text-center">
                        {item.jumlah_pelanggaran > 0 ? (
                          <span className="bg-red-50 text-red-600 border border-red-200 font-mono font-black px-2.5 py-1 rounded-lg text-xs animate-bounce inline-block">
                            ⚠️ {item.jumlah_pelanggaran}x
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono text-xs">0</span>
                        )}
                      </td>

                      {/* STATUS PENGERJAAN */}
                      <td className="p-4 text-center">
                        {item.is_selesai ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase">
                            ✅ Selesai
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase animate-pulse">
                            📝 Mengerjakan
                          </span>
                        )}
                      </td>

                      {/* DETAK AKTIVITAS TERAKHIR */}
                      <td className="p-4 text-center text-indigo-600 font-mono text-[11px]">
                        ⚡ {waktuAktif} WIB
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}