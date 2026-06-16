'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx';

interface NilaiGlobal {
  id: string;
  nilai: number;
  created_at: string;
  nama_siswa: string;
  kelas: string;
  id_siswa: string;
  id_jadwal: string; 
  jadwal: {
    mapel: {
      nama_mapel: string;
    } | null;
  } | null;
}

export default function RekapNilaiAdminPage() {
  const [listNilai, setListNilai] = useState<NilaiGlobal[]>([]);
  const [filteredNilai, setFilteredNilai] = useState<NilaiGlobal[]>([]);
  const [fetching, setFetching] = useState(true);

  // State untuk Dropdown Filter
  const [daftarKelas, setDaftarKelas] = useState<string[]>([]);
  const [daftarMapel, setDaftarMapel] = useState<string[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('SEMUA');
  const [selectedMapel, setSelectedMapel] = useState<string>('SEMUA');

  // State untuk Banner Notifikasi Berwaktu
  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  const [modalReset, setModalReset] = useState<{
    isOpen: boolean;
    idRecord: string;
    idSiswa: string;
    idJadwal: string;
    namaSiswa: string;
    mapel: string;
  }>({
    isOpen: false,
    idRecord: '',
    idSiswa: '',
    idJadwal: '',
    namaSiswa: '',
    mapel: '',
  });

  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  const fetchDaftarKelasMaster = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('kelas')
        .eq('role', 'siswa');

      if (!error && data) {
        const semuaKelas = data
          .map((item) => item.kelas?.trim().toUpperCase())
          .filter((k): k is string => !!k);
        
        const kelasUnik = Array.from(new Set(semuaKelas)).sort();
        setDaftarKelas(kelasUnik);
      }
    } catch (err) {
      console.error('Gagal mengambil konfigurasi daftar kelas dari profiles:', err);
    }
  };

  const fetchNilaiGlobal = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('nilai_siswa')
      .select(`
        id,
        nilai,
        created_at,
        nama_siswa,
        kelas,
        id_siswa,
        id_jadwal,
        jadwal:id_jadwal (
          mapel (
            nama_mapel
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatData = data as unknown as NilaiGlobal[];
      setListNilai(formatData);
      setFilteredNilai(formatData);

      // 🛠️ PERBAIKAN 1: Bersihkan nama mapel saat dimasukkan ke dalam daftar dropdown filter
      const mapelUnik = Array.from(
        new Set(
          formatData
            .map((item) => item.jadwal?.mapel?.nama_mapel?.trim()) // Hapus spasi gaib
            .filter((m): m is string => !!m)
        )
      ).sort();
      setDaftarMapel(mapelUnik);
    } else if (error) {
      console.error("Gagal menarik data rekap nilai:", error.message);
    }
    setFetching(false);
  };

  useEffect(() => {
    fetchDaftarKelasMaster();
    fetchNilaiGlobal();
  }, []);

  // 🛠️ PERBAIKAN 2: Logika Penyaringan (Filter) Kebal Spasi dan Huruf Besar-Kecil
  useEffect(() => {
    let hasilSaring = [...listNilai];

    if (selectedKelas !== 'SEMUA') {
      hasilSaring = hasilSaring.filter(
        (item) => item.kelas?.trim().toUpperCase() === selectedKelas
      );
    }

    if (selectedMapel !== 'SEMUA') {
      hasilSaring = hasilSaring.filter((item) => {
        const namaMapelDb = item.jadwal?.mapel?.nama_mapel?.trim().toLowerCase() || '';
        const namaMapelFilter = selectedMapel.trim().toLowerCase();
        return namaMapelDb === namaMapelFilter;
      });
    }

    setFilteredNilai(hasilSaring);
  }, [selectedKelas, selectedMapel, listNilai]);

  const eksekusiHapusNilaiSiswa = async () => {
    try {
      if (modalReset.idSiswa && modalReset.idJadwal) {
        await supabase
          .from('jawaban_siswa')
          .delete()
          .eq('id_siswa', modalReset.idSiswa)
          .eq('id_jadwal', modalReset.idJadwal);
      }

      const { error } = await supabase
        .from('nilai_siswa')
        .delete()
        .eq('id', modalReset.idRecord);

      if (error) throw error;

      setNotifikasi({ 
        pesan: `🔄 Sesi ujian "${modalReset.namaSiswa}" pada mapel "${modalReset.mapel}" berhasil direset total!`, 
        tipe: 'sukses' 
      });
      
      fetchNilaiGlobal();
    } catch (err: any) {
      console.error(err.message);
      setNotifikasi({ 
        pesan: `❌ Gagal mereset data ujian siswa: ${err.message}`, 
        tipe: 'gagal' 
      });
    } finally {
      setModalReset({ isOpen: false, idRecord: '', idSiswa: '', idJadwal: '', namaSiswa: '', mapel: '' });
    }
  };

  const handleDownloadExcel = () => {
    if (filteredNilai.length === 0) {
      setNotifikasi({ pesan: '⚠️ Tidak ada data nilai yang bisa diunduh untuk filter saat ini.', tipe: 'gagal' });
      return;
    }

    const dataExcel = filteredNilai.map((item, index) => ({
      'No.': index + 1,
      'Nama Siswa': item.nama_siswa || 'Siswa Tanpa Nama',
      'Kelas': item.kelas || '-',
      'Mata Pelajaran': item.jadwal?.mapel?.nama_mapel || '-',
      'Skor Akhir': item.nilai,
      'Tanggal Ujian': item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');

    const namaFile = `REKAP_NILAI_KLS_${selectedKelas}_MAPEL_${selectedMapel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, namaFile);
    setNotifikasi({ pesan: '📥 File rekap nilai berhasil diunduh ke komputer Anda!', tipe: 'sukses' });
  };

  return (
    <div className="space-y-8 relative">
      {notifikasi && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-xl border transition-all duration-300 max-w-md ${
          notifikasi.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="text-sm font-semibold">{notifikasi.pesan}</div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Rekap Nilai Global</h1>
        <p className="text-gray-500 text-sm">Laporan perolehan nilai hasil ujian seluruh siswa untuk kebutuhan evaluasi dan cetak rapor.</p>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="w-full sm:w-48">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Filter per Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium focus:border-blue-500"
            >
              <option value="SEMUA">🌐 Semua Kelas</option>
              {daftarKelas.map((kls) => (
                <option key={kls} value={kls}>🏫 {kls}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Filter per Mata Pelajaran</label>
            <select
              value={selectedMapel}
              onChange={(e) => setSelectedMapel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium focus:border-blue-500"
            >
              <option value="SEMUA">🌐 Semua Mata Pelajaran</option>
              {daftarMapel.map((mpl) => (
                <option key={mpl} value={mpl}>📖 {mpl}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadExcel}
          disabled={fetching || filteredNilai.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-all shadow-sm flex items-center justify-center gap-2 w-full md:w-auto"
        >
          <span>📥</span> Download Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-semibold">
              <th className="p-4 w-16">No.</th>
              <th className="p-4">Nama Siswa</th>
              <th className="p-4 w-32">Kelas</th>
              <th className="p-4">Mata Pelajaran</th>
              <th className="p-4 text-center w-32">Skor Akhir</th>
              <th className="p-4 text-center w-24">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm divide-y divide-gray-50">
            {fetching ? (
              <tr><td colSpan={6} className="text-center p-8 text-gray-400">Sedang menarik data rekap nilai...</td></tr>
            ) : filteredNilai.length === 0 ? (
              <tr><td colSpan={6} className="text-center p-8 text-gray-400">Tidak ada rekaman nilai ujian yang cocok dengan filter.</td></tr>
            ) : (
              filteredNilai.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 text-gray-500">{index + 1}</td>
                  <td className="p-4 font-semibold text-gray-800">{item.nama_siswa || 'Siswa Tanpa Nama'}</td>
                  <td className="p-4">
                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-bold">
                      {item.kelas || '-'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700">{item.jadwal?.mapel?.nama_mapel || '-'}</td>
                  <td className="p-4 text-center">
                    <span className={`font-mono font-black text-base ${item.nilai >= 75 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.nilai}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => setModalReset({
                        isOpen: true,
                        idRecord: item.id,
                        idSiswa: item.id_siswa,
                        idJadwal: item.id_jadwal,
                        namaSiswa: item.nama_siswa || 'Siswa',
                        mapel: item.jadwal?.mapel?.nama_mapel || 'Ujian'
                      })}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all"
                    >
                      🗑️ Reset
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalReset.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-sm w-full shadow-2xl space-y-5 transform scale-100 transition-all duration-200">
            <div className="text-center space-y-2">
              <span className="text-3xl inline-block bg-rose-50 p-3 rounded-full text-rose-600">⚠️</span>
              <h3 className="font-bold text-gray-900 text-base">Konfirmasi Reset Ujian</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus data nilai <span className="font-bold text-gray-800">"{modalReset.namaSiswa}"</span> pada mata pelajaran <span className="font-bold text-gray-800">"{modalReset.mapel}"</span>?
              </p>
              <div className="p-2 bg-amber-50 rounded-lg text-[11px] font-medium text-amber-800 border border-amber-200 text-left">
                📌 Catatan: Seluruh riwayat lembar jawaban siswa akan dibersihkan agar siswa dapat mengulang pengerjaan dari awal secara jujur.
              </div>
            </div>

            <div className="flex gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalReset({ isOpen: false, idRecord: '', idSiswa: '', idJadwal: '', namaSiswa: '', mapel: '' })}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl transition uppercase tracking-wider"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={eksekusiHapusNilaiSiswa}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl transition uppercase tracking-wider shadow-sm"
              >
                Ya, Reset ➡️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}