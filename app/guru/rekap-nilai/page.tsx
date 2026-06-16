'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx';

interface MapelDiampu {
  mapel_id: string;
  nama_mapel: string;
}

interface NilaiGlobal {
  id: string;
  nilai: number;
  created_at: string;
  nama_siswa: string;
  kelas: string;
  id_siswa: string;
  id_jadwal: string;
  jadwal: {
    tanggal_ujian: string;
    mapel: {
      id: string;
      nama_mapel: string;
    };
  } | null;
}

export default function RekapNilaiGuruPage() {
  const router = useRouter();
  
  const [listNilai, setListNilai] = useState<NilaiGlobal[]>([]);
  const [filteredNilai, setFilteredNilai] = useState<NilaiGlobal[]>([]);
  const [fetching, setFetching] = useState(true);

  // Master Data Dropdown
  const [mapelOptions, setMapelOptions] = useState<MapelDiampu[]>([]);
  const [daftarKelas, setDaftarKelas] = useState<string[]>([]);
  
  // State Filter Dropdown
  const [selectedKelas, setSelectedKelas] = useState<string>('SEMUA');
  const [selectedMapelId, setSelectedMapelId] = useState<string>('SEMUA');

  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  /**
   * 🏫 MEMBUAT DAFTAR KELAS DROPDOWN SECARA OTOMATIS DARI DATA YANG ADA
   */
  const buatDaftarKelasDropdown = (dataNilai: NilaiGlobal[]) => {
    const semuaKelas = dataNilai
      .map((item) => item.kelas?.trim().toUpperCase())
      .filter((k): k is string => !!k);
    
    const kelasUnik = Array.from(new Set(semuaKelas)).sort();
    setDaftarKelas(kelasUnik);
  };

  /**
   * 🛠️ MEMUAT DATA REKAP UTAMA GURU
   */
  const muatDataRekapGuru = async () => {
    setFetching(true);
    try {
      if (typeof window !== 'undefined') {
        const idGuru = localStorage.getItem('session_guru_id');
        if (!idGuru) {
          router.push('/login');
          return;
        }

        // TAHAP 1: Ambil data dari 'guru_mapel' untuk tahu mapel apa saja yang diampu guru ini
        const { data: dataGuruMapel, error: errorGuruMapel } = await supabase
          .from('guru_mapel')
          .select(`
            mapel_id,
            mapel (
              nama_mapel
            )
          `)
          .eq('guru_id', idGuru);

        if (errorGuruMapel) throw errorGuruMapel;

        const mapelUnik: MapelDiampu[] = [];
        const listMapelIds: string[] = [];
        const namaMapelSet = new Set();

        if (dataGuruMapel) {
          dataGuruMapel.forEach((item: any) => {
            if (item.mapel && item.mapel_id) {
              const namaBersih = item.mapel.nama_mapel.trim();
              if (!namaMapelSet.has(namaBersih.toLowerCase())) {
                namaMapelSet.add(namaBersih.toLowerCase());
                mapelUnik.push({ mapel_id: item.mapel_id, nama_mapel: namaBersih });
              }
              listMapelIds.push(item.mapel_id);
            }
          });
          setMapelOptions(mapelUnik);
        }

        // TAHAP 2: Ambil semua data nilai_siswa secara utuh menggunakan kolom-kolom flat bawaan tabel Anda
        const { data: dataNilai, error: errorNilai } = await supabase
          .from('nilai_siswa')
          .select(`
            id,
            nilai,
            created_at,
            nama_siswa,
            kelas,
            id_siswa,
            id_jadwal,
            jadwal:id_jadwal(
              tanggal_ujian,
              mapel(id, nama_mapel)
            )
          `)
          .order('created_at', { ascending: false });

        if (errorNilai) throw errorNilai;

        if (dataNilai) {
          const formatData = dataNilai as unknown as NilaiGlobal[];
          
          // Saring di level aplikasi: Hanya tampilkan nilai yang mapel-nya diampu oleh guru ini
          const nilaiMilikGuru = formatData.filter((item) => {
            const mapelIdDariNilai = item.jadwal?.mapel?.id;
            return mapelIdDariNilai && listMapelIds.includes(mapelIdDariNilai);
          });

          setListNilai(nilaiMilikGuru);
          setFilteredNilai(nilaiMilikGuru);
          buatDaftarKelasDropdown(nilaiMilikGuru);
        }
      }
    } catch (err: any) {
      console.error('Gagal memuat rekap:', err.message);
      setNotifikasi({ pesan: `❌ Error: ${err.message}`, tipe: 'gagal' });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    muatDataRekapGuru();
  }, [router]);

  /**
   * 🔄 FILTER MULTI-DROPDOWN SISI KLIEN (KELAS & MAPEL)
   */
  useEffect(() => {
    let hasilSaring = [...listNilai];

    // 1. Filter Berdasarkan Pilihan Kelas
    if (selectedKelas !== 'SEMUA') {
      hasilSaring = hasilSaring.filter(
        (item) => item.kelas?.trim().toUpperCase() === selectedKelas.trim().toUpperCase()
      );
    }

    // 2. Filter Berdasarkan Pilihan Mata Pelajaran (Menggunakan mapel_id)
    if (selectedMapelId !== 'SEMUA') {
      hasilSaring = hasilSaring.filter(
        (item) => item.jadwal?.mapel?.id === selectedMapelId
      );
    }

    setFilteredNilai(hasilSaring);
  }, [selectedKelas, selectedMapelId, listNilai]);

  const handleDownloadExcel = () => {
    if (filteredNilai.length === 0) {
      setNotifikasi({ pesan: '⚠️ Tidak ada data nilai untuk diunduh.', tipe: 'gagal' });
      return;
    }

    const dataExcel = filteredNilai.map((item, index) => ({
      'No.': index + 1,
      'Nama Siswa': item.nama_siswa || 'Siswa Tanpa Nama',
      'Kelas': item.kelas || '-',
      'Mata Pelajaran': item.jadwal?.mapel?.nama_mapel || 'Matematika',
      'Skor Akhir': item.nilai,
      'Tanggal Ujian': item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');
    XLSX.writeFile(workbook, `REKAP_NILAI_GURU_${Date.now()}.xlsx`);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6 relative">
      
      {/* NOTIFIKASI LAYANG */}
      {notifikasi && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-xl flex items-center justify-between gap-4 max-w-sm border ${
          notifikasi.tipe === 'sukses' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="text-xs font-bold">{notifikasi.pesan}</div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">Rekap Nilai Hasil Ujian</h1>
        <p className="text-xs text-gray-500">Menampilkan skor riwayat siswa berdasarkan pemetaan mata pelajaran Anda.</p>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-bold text-gray-800">
        <div>
          <label className="block text-xs text-blue-900 mb-1">Pilih Kelas</label>
          <select 
            value={selectedKelas} 
            onChange={(e) => setSelectedKelas(e.target.value)} 
            className="w-full p-2.5 border rounded-xl bg-white outline-none font-semibold text-gray-700 text-xs shadow-sm"
          >
            <option value="SEMUA">🌐 Semua Kelas ({daftarKelas.length})</option>
            {daftarKelas.map((kls) => (
              <option key={kls} value={kls}>🏫 Kelas {kls}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-blue-900 mb-1">Pilih Mata Pelajaran</label>
          <select 
            value={selectedMapelId} 
            onChange={(e) => setSelectedMapelId(e.target.value)} 
            className="w-full p-2.5 border rounded-xl bg-white outline-none font-semibold text-gray-700 text-xs shadow-sm"
          >
            <option value="SEMUA">🌐 Semua Mapel Diajar</option>
            {mapelOptions.map((m) => (
              <option key={m.mapel_id} value={m.mapel_id}>📖 {m.nama_mapel}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 pt-2">
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={fetching || filteredNilai.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs uppercase shadow-md transition duration-200"
          >
            📥 Unduh Rekap Excel
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3">📋 Lembar Skor Siswa ({filteredNilai.length})</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700 divide-y divide-gray-100">
            <thead>
              <tr className="font-bold text-gray-500 uppercase tracking-wider">
                <th className="pb-3 w-10">No</th>
                <th className="pb-3">Nama Siswa</th>
                <th className="pb-3 w-20">Kelas</th>
                <th className="pb-3">Mata Pelajaran</th>
                <th className="pb-3 text-center w-20">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fetching ? (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">Memuat data nilai...</td></tr>
              ) : filteredNilai.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">Tidak ada record nilai ditemukan.</td></tr>
              ) : (
                filteredNilai.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 text-gray-400">{index + 1}</td>
                    <td className="py-3 font-bold text-gray-900">{item.nama_siswa || 'Tanpa Nama'}</td>
                    <td className="py-3"><span className="bg-gray-100 px-1.5 py-0.5 rounded font-bold text-gray-600">{item.kelas}</span></td>
                    <td className="py-3 text-gray-600">{item.jadwal?.mapel?.nama_mapel || '-'}</td>
                    <td className="py-3 text-center font-mono font-black text-sm text-blue-600">{item.nilai}</td>
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