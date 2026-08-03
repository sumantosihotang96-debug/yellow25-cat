'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface MapelDetail {
  id: string;
  nama_mapel: string;
  kelas: string;
  jurusan: string;
  acak_soal: boolean;
  jadwal_id?: string;
  token_ujian?: string;
}

export default function GuruDashboardPage() {
  const router = useRouter();
  const [namaGuru, setNamaGuru] = useState('');
  const [nipGuru, setNipGuru] = useState('');
  const [mapelDiampu, setMapelDiampu] = useState<MapelDetail[]>([]);
  const [stats, setStats] = useState({ totalSoal: 0, ujianAktif: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [savingTokenId, setSavingTokenId] = useState<string | null>(null);

  // Sakelar dari Admin untuk mengontrol akses token Guru
  const [izinkanGuruToken, setIzinkanGuruToken] = useState<boolean>(true);

  useEffect(() => {
    const muatDataDashboard = async () => {
      try {
        if (typeof window !== 'undefined') {
          const idGuru = localStorage.getItem('session_guru_id');
          const nipSimpanan = localStorage.getItem('session_guru_nip');
          const namaSimpanan = localStorage.getItem('session_guru_nama');

          if (!idGuru) {
            router.push('/');
            return;
          }

          setNamaGuru(namaSimpanan || 'Guru');
          setNipGuru(nipSimpanan || '-');

          // 0. BACA PENGATURAN GLOBAL ADMIN
          const { data: configAdmin } = await supabase
            .from('pengaturan_global')
            .select('izinkan_guru_token')
            .maybeSingle();

          if (configAdmin) {
            setIzinkanGuruToken(
              configAdmin.izinkan_guru_token !== undefined && configAdmin.izinkan_guru_token !== null
                ? Boolean(configAdmin.izinkan_guru_token)
                : true
            );
          }

          // 1. Ambil relasi mapel yang diampu guru
          const { data: relasiMapel, error: relasiErr } = await supabase
            .from('guru_mapel')
            .select('mapel_id, mapel(id, nama_mapel, kelas, jurusan, acak_soal)')
            .eq('guru_id', idGuru);

          if (relasiErr) throw relasiErr;

          const mapelIds: string[] = [];
          const mapelTempMap: Record<string, MapelDetail> = {};

          if (relasiMapel) {
            relasiMapel.forEach((item: any) => {
              if (item.mapel) {
                mapelIds.push(item.mapel.id);
                mapelTempMap[item.mapel.id] = {
                  id: item.mapel.id,
                  nama_mapel: item.mapel.nama_mapel,
                  kelas: item.mapel.kelas || 'Semua',
                  jurusan: item.mapel.jurusan || 'UMUM',
                  acak_soal: item.mapel.acak_soal !== false,
                  token_ujian: '',
                };
              }
            });
          }

          // 2. Ambil Jadwal & Token
          if (mapelIds.length > 0) {
            const { data: jadwalData } = await supabase
              .from('jadwal_ujian')
              .select('id, mapel_id, token_ujian')
              .in('mapel_id', mapelIds)
              .order('tanggal_ujian', { ascending: false });

            if (jadwalData) {
              jadwalData.forEach((j: any) => {
                if (mapelTempMap[j.mapel_id] && !mapelTempMap[j.mapel_id].jadwal_id) {
                  mapelTempMap[j.mapel_id].jadwal_id = j.id;
                  mapelTempMap[j.mapel_id].token_ujian = j.token_ujian || '';
                }
              });
            }

            // 3. Hitung Statistik
            const tgl = new Date();
            const yyyy = tgl.getFullYear();
            const mm = String(tgl.getMonth() + 1).padStart(2, '0');
            const dd = String(tgl.getDate()).padStart(2, '0');
            const hariIniLokal = `${yyyy}-${mm}-${dd}`;

            const { count: countSoal } = await supabase
              .from('soal')
              .select('*', { count: 'exact', head: true })
              .in('id_mapel', mapelIds);

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

          setMapelDiampu(Object.values(mapelTempMap));
        }
      } catch (error) {
        console.error('Gagal memuat informasi dashboard guru:', error);
      } finally {
        setLoading(false);
      }
    };

    muatDataDashboard();
  }, [router]);

  const handleToggleAcak = async (mapelId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setMapelDiampu((prev) =>
      prev.map((m) => (m.id === mapelId ? { ...m, acak_soal: newStatus } : m))
    );
    setUpdatingId(mapelId);

    try {
      const { error } = await supabase
        .from('mapel')
        .update({ acak_soal: newStatus })
        .eq('id', mapelId);

      if (error) throw error;
    } catch (err) {
      console.error('Gagal mengupdate status acak soal:', err);
      setMapelDiampu((prev) =>
        prev.map((m) => (m.id === mapelId ? { ...m, acak_soal: currentStatus } : m))
      );
      alert('Gagal mengubah pengaturan acak soal.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleGenerateToken = (mapelId: string) => {
    const karakter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let hasilToken = '';
    for (let i = 0; i < 5; i++) {
      hasilToken += karakter.charAt(Math.floor(Math.random() * karakter.length));
    }
    setMapelDiampu((prev) =>
      prev.map((m) => (m.id === mapelId ? { ...m, token_ujian: hasilToken } : m))
    );
  };

  const handleTokenChange = (mapelId: string, value: string) => {
    setMapelDiampu((prev) =>
      prev.map((m) => (m.id === mapelId ? { ...m, token_ujian: value.toUpperCase() } : m))
    );
  };

  const handleSimpanToken = async (item: MapelDetail) => {
    if (!item.token_ujian || item.token_ujian.trim() === '') {
      alert('⚠️ Mohon isi token terlebih dahulu!');
      return;
    }

    setSavingTokenId(item.id);
    try {
      const tokenClean = item.token_ujian.trim().toUpperCase();

      if (item.jadwal_id) {
        const { error } = await supabase
          .from('jadwal_ujian')
          .update({ token_ujian: tokenClean })
          .eq('id', item.jadwal_id);

        if (error) throw error;
      } else {
        const tgl = new Date();
        const yyyy = tgl.getFullYear();
        const mm = String(tgl.getMonth() + 1).padStart(2, '0');
        const dd = String(tgl.getDate()).padStart(2, '0');
        const hariIniLokal = `${yyyy}-${mm}-${dd}`;

        const { data, error } = await supabase
          .from('jadwal_ujian')
          .insert([
            {
              mapel_id: item.id,
              token_ujian: tokenClean,
              tanggal_ujian: hariIniLokal,
              jam_mulai: '08:00',
              durasi_menit: 90,
              jumlah_soal_tampil: 40,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setMapelDiampu((prev) =>
            prev.map((m) => (m.id === item.id ? { ...m, jadwal_id: data.id } : m))
          );
        }
      }

      alert(`🎉 Berhasil! Token "${tokenClean}" tersimpan.`);
    } catch (err: any) {
      console.error('Gagal menyinkronkan token:', err);
      alert('❌ Gagal menyimpan token: ' + (err.message || 'Terjadi kesalahan server'));
    } finally {
      setSavingTokenId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs font-bold text-gray-400 tracking-wider uppercase animate-pulse">
        ⏳ Menyusun Informasi Dashboard...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* HEADER PROFIL GURU */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-gray-900">Selamat Datang, {namaGuru}!</h1>
          <p className="text-xs text-gray-500 mt-0.5">NIP: {nipGuru} • Hak Akses: Tenaga Pengajar</p>
        </div>
        <button
          onClick={() => router.push('/guru/rekap-nilai')}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition shrink-0 flex items-center justify-center gap-2"
        >
          📊 Lihat Rekap Nilai Siswa
        </button>
      </div>

      {/* RINGKASAN STATISTIK */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg sm:text-xl shrink-0">
            📝
          </div>
          <div>
            <span className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total Soal
            </span>
            <span className="text-base sm:text-xl font-black text-gray-900 font-mono">
              {stats.totalSoal} <span className="text-[10px] sm:text-xs font-medium text-gray-500">Soal</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg sm:text-xl shrink-0">
            ⚡
          </div>
          <div>
            <span className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
              Ujian Aktif
            </span>
            <span className="text-base sm:text-xl font-black text-emerald-600 font-mono">
              {stats.ujianAktif} <span className="text-[10px] sm:text-xs font-medium text-gray-500">Sesi</span>
            </span>
          </div>
        </div>
      </div>

      {/* KELOLA MAPEL & SOAL TERIKAT */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
            📖 Kelola Mapel & Soal Ujian ({mapelDiampu.length})
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Atur soal terikat, pengacakan soal, dan token masuk ujian secara konsisten per mata pelajaran.
          </p>
        </div>

        {mapelDiampu.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs font-medium">
            ⚠️ Anda belum ditugaskan mengajar mata pelajaran apa pun oleh Administrator.
          </div>
        ) : (
          <>
            {/* 📱 MOBILE CARD VIEW (Muncul pada mode layar kecil < md) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {mapelDiampu.map((item, index) => (
                <div key={item.id} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-gray-400 block">#{index + 1}</span>
                      <h3 className="font-black text-gray-900 text-sm">{item.nama_mapel}</h3>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                        {item.kelas}
                      </span>
                      <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px] font-mono">
                        {item.jurusan}
                      </span>
                    </div>
                  </div>

                  {/* AKSI SOAL TERIKAT PER MAPEL */}
                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-600">📝 Soal Ujian:</span>
                    <button
                      onClick={() => router.push(`/guru/bank-soal?mapel_id=${item.id}`)}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-600 active:bg-blue-700 text-white rounded-lg shadow-sm transition flex items-center gap-1"
                    >
                      Kelola Soal ➔
                    </button>
                  </div>

                  {/* SAKELAR ACAK SOAL */}
                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600">🎲 Acak Soal:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => handleToggleAcak(item.id, item.acak_soal)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          item.acak_soal ? 'bg-indigo-600' : 'bg-gray-300'
                        } ${updatingId === item.id ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            item.acak_soal ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span
                        className={`text-[11px] font-bold ${
                          item.acak_soal ? 'text-indigo-600' : 'text-gray-400'
                        }`}
                      >
                        {item.acak_soal ? 'Aktif' : 'Off'}
                      </span>
                    </div>
                  </div>

                  {/* PEMBUATAN TOKEN */}
                  {izinkanGuruToken && (
                    <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-600 block">🔑 Token Masuk Ujian:</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="TOKEN"
                          value={item.token_ujian || ''}
                          onChange={(e) => handleTokenChange(item.id, e.target.value)}
                          className="w-full px-3 py-2 text-center font-mono text-xs font-bold uppercase bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleGenerateToken(item.id)}
                          className="p-2 text-gray-600 bg-gray-200 active:bg-gray-300 rounded-lg transition shrink-0 font-bold text-xs"
                        >
                          Acak 🎲
                        </button>
                        <button
                          type="button"
                          disabled={savingTokenId === item.id}
                          onClick={() => handleSimpanToken(item)}
                          className="px-3 py-2 text-xs font-bold bg-emerald-600 active:bg-emerald-700 text-white rounded-lg transition shrink-0 disabled:opacity-50 shadow-sm"
                        >
                          {savingTokenId === item.id ? '...' : 'Simpan'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 💻 DESKTOP TABEL VIEW (Muncul pada mode layar sedang ke atas >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                    <th className="pb-3 w-10 text-center">No</th>
                    <th className="pb-3 pl-2">Mata Pelajaran</th>
                    <th className="pb-3 text-center w-20">Kelas</th>
                    <th className="pb-3 text-center w-24">Jurusan</th>
                    <th className="pb-3 text-center w-32">📝 Soal Terikat</th>
                    <th className="pb-3 text-center w-28">🎲 Acak Soal</th>
                    {izinkanGuruToken && <th className="pb-3 text-center w-64">🔑 Token Ujian</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700 font-semibold">
                  {mapelDiampu.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 text-center text-gray-400 font-mono">{index + 1}</td>
                      <td className="py-3.5 pl-2 text-gray-900 font-black text-sm tracking-wide">
                        {item.nama_mapel}
                      </td>
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

                      {/* TOMBOL KELOLA SOAL TERIKAT */}
                      <td className="py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => router.push(`/guru/bank-soal?mapel_id=${item.id}`)}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition shadow-xs"
                        >
                          ⚙️ Kelola Soal
                        </button>
                      </td>

                      {/* TOGGLE ACAK SOAL */}
                      <td className="py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => handleToggleAcak(item.id, item.acak_soal)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              item.acak_soal ? 'bg-indigo-600' : 'bg-gray-300'
                            } ${updatingId === item.id ? 'opacity-50' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                item.acak_soal ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[10px] font-bold ${
                              item.acak_soal ? 'text-indigo-600' : 'text-gray-400'
                            }`}
                          >
                            {item.acak_soal ? 'Aktif' : 'Off'}
                          </span>
                        </div>
                      </td>

                      {/* PEMBUATAN TOKEN */}
                      {izinkanGuruToken && (
                        <td className="py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="text"
                              maxLength={5}
                              placeholder="TOKEN"
                              value={item.token_ujian || ''}
                              onChange={(e) => handleTokenChange(item.id, e.target.value)}
                              className="w-24 px-2 py-1.5 text-center font-mono text-xs font-bold uppercase bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-wider text-blue-600"
                            />
                            <button
                              type="button"
                              onClick={() => handleGenerateToken(item.id)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-lg border border-gray-200 transition text-xs font-bold"
                            >
                              Acak 🎲
                            </button>
                            <button
                              type="button"
                              disabled={savingTokenId === item.id}
                              onClick={() => handleSimpanToken(item)}
                              className="px-2.5 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
                            >
                              {savingTokenId === item.id ? '...' : 'Simpan'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}