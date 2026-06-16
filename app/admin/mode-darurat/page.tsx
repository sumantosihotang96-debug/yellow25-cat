'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface Mapel {
  id: string;
  kode_mapel: string;
  nama_mapel: string;
}

interface Soal {
  id: string;
  kode_mapel: string;
  soal_teks: string;
  url_gambar: string | null;
  pil_a_teks: string;
  pil_a_gambar: string | null;
  pil_b_teks: string;
  pil_b_gambar: string | null;
  pil_c_teks: string;
  pil_c_gambar: string | null;
  pil_d_teks: string;
  pil_d_gambar: string | null;
  pil_e_teks: string;
  pil_e_gambar: string | null;
}

export default function ModeDaruratPage() {
  // State Data Master & Filter
  const [listMapel, setListMapel] = useState<Mapel[]>([]);
  const [selectedMapel, setSelectedMapel] = useState<string>('');
  const [listSoal, setListSoal] = useState<Soal[]>([]);
  const [fetching, setFetching] = useState(false);
  const [loadingAksi, setLoadingAksi] = useState(false);

  // State Modal Suntik Gambar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSoal, setActiveSoal] = useState<Soal | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);

  // State Banner Notifikasi Sistem (Pengganti alert bawaan browser)
  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  // 1. Mengambil master data Mata Pelajaran untuk dropdown
  useEffect(() => {
    const fetchMapel = async () => {
      const { data } = await supabase
        .from('mapel')
        .select('id, kode_mapel, nama_mapel')
        .order('nama_mapel', { ascending: true });
      if (data) {
        setListMapel(data);
        if (data.length > 0) setSelectedMapel(data[0].kode_mapel);
      }
    };
    fetchMapel();
  }, []);

  // 2. Mengambil daftar Soal berdasarkan Mapel yang aktif dipilih
  const fetchSoalBerdasarkanMapel = async () => {
    if (!selectedMapel) return;
    setFetching(true);
    const { data, error } = await supabase
      .from('soal')
      .select('*')
      .eq('kode_mapel', selectedMapel)
      .order('id', { ascending: true });

    if (!error && data) {
      setListSoal(data as Soal[]);
    }
    setFetching(false);
  };

  useEffect(() => {
    fetchSoalBerdasarkanMapel();
  }, [selectedMapel]);

  // 3. Menangani unggah file gambar langsung ke Supabase Storage Bucket ("soal-images")
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: keyof Soal) => {
    const file = e.target.files?.[0];
    if (!file || !activeSoal) return;

    setUploadingTarget(fieldKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `emergency-${activeSoal.id}-${fieldKey}-${Date.now()}.${fileExt}`;
      const filePath = `emergency-media/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('soal-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('soal-images')
        .getPublicUrl(filePath);

      // Masukkan manifest URL ke objek state penampung modal
      setActiveSoal({ ...activeSoal, [fieldKey]: publicUrl });
      setNotifikasi({ pesan: `📷 Media berhasil terunggah untuk bagian [${fieldKey}]`, tipe: 'sukses' });
    } catch (err: any) {
      setNotifikasi({ pesan: '❌ Gagal mengunggah file: ' + err.message, tipe: 'gagal' });
    } finally {
      setUploadingTarget(null);
    }
  };

  // 4. Injeksi final ke baris database (Memperbarui layar siswa saat itu juga)
  const handleExecuteInjeksi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSoal) return;
    setLoadingAksi(true);

    try {
      const { error } = await supabase
        .from('soal')
        .update({
          url_gambar: activeSoal.url_gambar,
          pil_a_gambar: activeSoal.pil_a_gambar,
          pil_b_gambar: activeSoal.pil_b_gambar,
          pil_c_gambar: activeSoal.pil_c_gambar,
          pil_d_gambar: activeSoal.pil_d_gambar,
          pil_e_gambar: activeSoal.pil_e_gambar,
        })
        .eq('id', activeSoal.id);

      if (error) throw error;

      setNotifikasi({ pesan: '🚨 MITIGASI BERHASIL: Perubahan gambar telah disuntikkan secara real-time ke sistem ujian siswa!', tipe: 'sukses' });
      setIsModalOpen(false);
      fetchSoalBerdasarkanMapel();
    } catch (err: any) {
      setNotifikasi({ pesan: '❌ Gagal melakukan injeksi data: ' + err.message, tipe: 'gagal' });
    } finally {
      setLoadingAksi(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      
      {/* BANNER NOTIFIKASI LAYANG */}
      {notifikasi && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-lg border transition-all duration-300 max-w-md ${
          notifikasi.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="text-sm font-semibold">{notifikasi.pesan}</div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-red-700 flex items-center gap-2">🚨 Mode Darurat: Penyisipan Gambar Instan</h1>
        <p className="text-gray-500 text-sm">Gunakan panel taktis ini untuk melakukan perbaikan aset gambar soal atau pilihan yang bermasalah langsung saat token ujian aktif.</p>
      </div>

      {/* SELEKTOR MATA PELAJARAN TARGET */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 max-w-md">
        <label className="block text-xs font-bold text-red-700 mb-1.5 uppercase tracking-wider">Mata Pelajaran Terkendala</label>
        <select
          value={selectedMapel}
          onChange={(e) => setSelectedMapel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 text-gray-950 bg-white font-semibold"
        >
          {listMapel.length === 0 ? (
            <option value="">Memuat data mata pelajaran...</option>
          ) : (
            listMapel.map((mapel) => (
              <option key={mapel.kode_mapel} value={mapel.kode_mapel}>
                [{mapel.kode_mapel}] {mapel.nama_mapel}
              </option>
            ))
          )}
        </select>
      </div>

      {/* MONITORING ANTRIAN SOAL LIVE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-red-50/40 border-b border-red-100">
          <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider">Lembar Pemantauan Soal Aktis</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs font-bold uppercase">
              <th className="p-4 w-16">No.</th>
              <th className="p-4">Deskripsi / Teks Pertanyaan</th>
              <th className="p-4 w-44 text-center">Status Lampiran Media</th>
              <th className="p-4 w-32 text-center">Aksi Krisis</th>
            </tr>
          </thead>
          <tbody className="text-gray-950 text-sm divide-y divide-gray-50">
            {fetching ? (
              <tr><td colSpan={4} className="text-center p-8 text-gray-400">Sedang memetakan daftar pertanyaan...</td></tr>
            ) : listSoal.length === 0 ? (
              <tr><td colSpan={4} className="text-center p-8 text-gray-400">Tidak ditemukan data soal di dalam mata pelajaran ini.</td></tr>
            ) : (
              listSoal.map((soal, index) => (
                <tr key={soal.id} className="hover:bg-red-50/10 transition-colors">
                  <td className="p-4 font-mono text-gray-400 text-xs">{index + 1}</td>
                  <td className="p-4">
                    <p className="line-clamp-2 font-medium text-gray-900">{soal.soal_teks}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {soal.id}</p>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-1 items-center justify-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${soal.url_gambar ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {soal.url_gambar ? '🖼️ Gambar Utama Aktif' : '❌ Tanpa Gambar Utama'}
                      </span>
                      {/* DI SINI SUDAH DIPERBAIKI: soal.pil_b_gambar (sebelumnya soja) */}
                      {([soal.pil_a_gambar, soal.pil_b_gambar, soal.pil_c_gambar, soal.pil_d_gambar, soal.pil_e_gambar].some(Boolean)) && (
                        <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold">🎨 Opsi Pilihan Bergambar</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => { setActiveSoal(soal); setIsModalOpen(true); }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap"
                    >
                      🔥 Injeksi Media
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* POPUP CONTAINER: PANEL INJEKSI REAL-TIME MULTIMEDIA */}
      {isModalOpen && activeSoal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="border-b pb-2">
              <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">Live Feed Override</span>
              <h3 className="text-base font-bold text-gray-900 mt-1.5">Suntik File Media Darurat</h3>
              <p className="text-xs text-gray-400 line-clamp-1">Pertanyaan Target: "{activeSoal.soal_teks}"</p>
            </div>

            <form onSubmit={handleExecuteInjeksi} className="space-y-5">
              
              {/* INPUT OVERRIDE UNTUK GAMBAR UTAMA SOAL */}
              <div className="p-3 bg-red-50/30 rounded-xl border border-red-100 space-y-2">
                <label className="block text-xs font-bold text-gray-700">🖼️ Pasang/Ganti Gambar Utama Soal (`url_gambar`)</label>
                <div className="flex items-center gap-4">
                  <input type="file" accept="image/*" onChange={(e) => handleDirectUpload(e, 'url_gambar')} className="text-xs text-gray-500 cursor-pointer flex-1" />
                  {uploadingTarget === 'url_gambar' && <span className="text-xs text-red-600 animate-pulse">Memuat...</span>}
                  {activeSoal.url_gambar && <img src={activeSoal.url_gambar} alt="Preview" className="h-12 w-12 object-contain rounded border bg-white p-0.5" />}
                </div>
              </div>

              {/* INPUT OVERRIDE UNTUK GAMBAR OPSI A - E */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">🎨 Perbaikan Gambar Lembar Pilihan Opsi</h4>
                
                {(['a', 'b', 'c', 'd', 'e'] as const).map((opsi) => {
                  const targetGambar = `pil_${opsi}_gambar` as keyof Soal;
                  const targetTeks = `pil_${opsi}_teks` as keyof Soal;

                  return (
                    <div key={opsi} className="flex items-center justify-between p-2.5 border border-gray-100 rounded-lg bg-gray-50/60 gap-4">
                      <div className="flex-1 truncate">
                        <span className="text-xs font-extrabold text-gray-700 uppercase mr-2 bg-gray-200 px-1.5 py-0.5 rounded">{opsi}</span>
                        <span className="text-xs text-gray-600 font-medium">{activeSoal[targetTeks] as string}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="file" accept="image/*" onChange={(e) => handleDirectUpload(e, targetGambar)} className="text-[10px] text-gray-400 max-w-[120px]" />
                        {uploadingTarget === targetGambar && <span className="text-[10px] text-red-600 animate-pulse">...</span>}
                        {activeSoal[targetGambar] && <img src={activeSoal[targetGambar] as string} alt="Preview" className="h-8 w-8 object-contain rounded border bg-white p-0.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TOMBOL AKSI AKHIR */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-xs transition-all">
                  Batal
                </button>
                <button type="submit" disabled={loadingAksi || uploadingTarget !== null} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-all shadow-md">
                  {loadingAksi ? 'Melakukan Injeksi...' : '💥 Terapkan Langsung Ke Siswa'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}