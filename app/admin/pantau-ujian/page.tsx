'use client';

import { useEffect, useState } from 'react';
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
  waktu_terakhir_aktif: string;
}

export default function PantauUjianGuruPage() {
  const router = useRouter();
  const [listPantau, setListPantau] = useState<ProgressSiswa[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchPantauanLive = async () => {
    setFetching(true);
    try {
      if (typeof window !== 'undefined') {
        const idGuru = localStorage.getItem('session_guru_id');
        
        if (!idGuru) {
          router.push('/login-guru');
          return;
        }

        // TAHAP 1: Ambil mapel yang diampu oleh guru aktif
        const { data: guruMapel, error: guruMapelErr } = await supabase
          .from('guru_mapel')
          .select('mapel_id')
          .eq('guru_id', idGuru);

        if (guruMapelErr) throw guruMapelErr;
        const mapelIds = guruMapel?.map((item) => item.mapel_id) || [];

        if (mapelIds.length === 0) {
          setListPantau([]);
          setFetching(false);
          return;
        }

        // TAHAP 2: Ambil semua riwayat jawaban siswa yang sedang berjalan
        const { data: rawJawaban, error: errorJawaban } = await supabase
          .from('jawaban_siswa')
          .select(`
            id_siswa,
            id_jadwal,
            updated_at,
            jadwal:id_jadwal (
              mapel_id,
              jumlah_soal_tampil,
              mapel:mapel_id (
                nama_mapel
              )
            )
          `);

        if (errorJawaban) throw errorJawaban;

        if (rawJawaban && rawJawaban.length > 0) {
          // Saring agar hanya mengambil riwayat jawaban yang sesuai dengan mapel ampunan guru
          const jawabanMilikGuru = (rawJawaban as any[]).filter((j) => {
            return j.jadwal?.mapel_id && mapelIds.includes(j.jadwal.mapel_id);
          });

          if (jawabanMilikGuru.length === 0) {
            setListPantau([]);
            setFetching(false);
            return;
          }

          // TAHAP 3: Ambil referensi identitas profil dari tabel profiles
          const { data: dataProfil } = await supabase
            .from('profiles')
            .select('id, nama_lengkap, kelas');

          const profilMap: { [key: string]: { nama: string; kelas: string } } = {};
          dataProfil?.forEach((p) => {
            profilMap[p.id] = { nama: p.nama_lengkap, kelas: p.kelas || 'Umum' };
          });

          // TAHAP 4: Kelompokkan data jawaban per (id_siswa + id_jadwal)
          const akumulasiProgress: { [key: string]: ProgressSiswa } = {};

          jawabanMilikGuru.forEach((row) => {
            const key = `${row.id_siswa}-${row.id_jadwal}`;
            const infoSiswa = profilMap[row.id_siswa] || { nama: 'Siswa Tanpa Nama', kelas: '-' };

            if (!akumulasiProgress[key]) {
              akumulasiProgress[key] = {
                id_siswa: row.id_siswa,
                id_jadwal: row.id_jadwal,
                nama_siswa: infoSiswa.nama,
                kelas: infoSiswa.kelas,
                nama_mapel: row.jadwal?.mapel?.nama_mapel || 'Mata Pelajaran',
                total_soal_tampil: row.jadwal?.jumlah_soal_tampil || 0,
                jumlah_terjawab: 0,
                waktu_terakhir_aktif: row.updated_at,
              };
            }

            // Tambahkan hitungan jumlah jawaban yang sudah diisi
            akumulasiProgress[key].jumlah_terjawab += 1;

            // Cari tahu rekam waktu detak klik terakhir dari siswa tersebut
            if (new Date(row.updated_at) > new Date(akumulasiProgress[key].waktu_terakhir_aktif)) {
              akumulasiProgress[key].waktu_terakhir_aktif = row.updated_at;
            }
          });

          // Konversi hasil pemetaan objek ke dalam bentuk array dan urutkan dari yang paling baru aktif
          const hasilArray = Object.values(akumulasiProgress).sort(
            (a, b) => new Date(b.waktu_terakhir_aktif).getTime() - new Date(a.waktu_terakhir_aktif).getTime()
          );

          setListPantau(hasilArray);
        } else {
          setListPantau([]);
        }
      }
    } catch (err: any) {
      console.error('Gagal memproses pantauan progres:', err.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchPantauanLive();

    // Sinyal radar diperbarui otomatis setiap 15 detik agar terasa real-time
    const interval = setInterval(() => {
      fetchPantauanLive();
    }, 15000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* PANEL CONTROL HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-gray-900">📡 Radar Pantau Progres Ujian (Live)</h1>
          <p className="text-xs text-gray-500 mt-0.5">Memantau aktivitas pengerjaan butir soal siswa berdasarkan data jawaban yang masuk ke server.</p>
        </div>
        <button 
          onClick={fetchPantauanLive} 
          disabled={fetching}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-md shrink-0 flex items-center gap-2"
        >
          {fetching ? '🔄 Memindai Sinyal...' : '🔄 Sinkronkan Radar'}
        </button>
      </div>

      {/* VIEW MONITORING TABEL PROGRES */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Lengkap Siswa</th>
                <th className="p-4 w-28 text-center">Kelas</th>
                <th className="p-4">Mata Pelajaran</th>
                <th className="p-4 text-center w-40">Progres Isian</th>
                <th className="p-4 text-center w-44">Bilah Visual Kontrol</th>
                <th className="p-4 text-center w-36">Detak Aktivitas</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 divide-y divide-gray-100 font-semibold">
              {fetching && listPantau.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-12 text-gray-400 font-bold tracking-wide uppercase animate-pulse">
                    ⏳ Sedang menangkap sinyal pergerakan lembar siswa...
                  </td>
                </tr>
              ) : listPantau.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-12 text-gray-400 font-medium">
                    📭 Belum ada riwayat aktivitas pengerjaan yang terdeteksi dari siswa untuk ujian Anda.
                  </td>
                </tr>
              ) : (
                listPantau.map((item, idx) => {
                  const total = item.total_soal_tampil || 1;
                  const persen = Math.min(Math.round((item.jumlah_terjawab / total) * 100), 100);
                  const waktuAktif = new Date(item.waktu_terakhir_aktif).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <tr key={`${item.id_siswa}-${item.id_jadwal}`} className="hover:bg-gray-50/40 transition-colors">
                      <td className="p-4 text-gray-400 text-center font-mono">{idx + 1}</td>
                      <td className="p-4 font-black text-gray-900 text-sm">{item.nama_siswa}</td>
                      <td className="p-4 text-center">
                        <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[11px]">
                          {item.kelas}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 font-medium">{item.nama_mapel}</td>
                      {/* PROGRES SOAL DALAM ANGKA */}
                      <td className="p-4 text-center font-mono font-bold text-gray-900">
                        <span className="text-indigo-600 font-black">{item.jumlah_terjawab}</span> / {item.total_soal_tampil} Soal
                      </td>
                      {/* PROGRESS BAR VISUAL PERSENTASE */}
                      <td className="p-4">
                        <div className="flex items-center gap-3 justify-center">
                          <div className="w-28 bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                            <div 
                              className={`h-full transition-all duration-300 ${persen === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                              style={{ width: `${persen}%` }}
                            ></div>
                          </div>
                          <span className={`font-mono font-bold w-10 text-right ${persen === 100 ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {persen}%
                          </span>
                        </div>
                      </td>
                      {/* LOG DETAK WAKTU TERAKHIR AKTIF KLIK JAWABAN */}
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