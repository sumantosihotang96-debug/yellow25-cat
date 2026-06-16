'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface Mapel {
  id: string;
  nama_mapel: string;
  kelas: string | null;
  jurusan: string | null;
}

interface Jadwal {
  id: string;
  tanggal_ujian: string;
  jam_mulai: string;
  durasi_menit: number;
  token_ujian: string;
  jumlah_soal_tampil: number;
  mapel_id: string; // Diwajibkan agar penanganan edit state tidak bermasalah
  mapel: {
    nama_mapel: string;
    kelas: string | null;
    jurusan: string | null;
  } | null; // Dibuat nullable untuk mengamankan jika ada mapel terhapus accidental
}

export default function KelolaJadwalPage() {
  const [listJadwal, setListJadwal] = useState<Jadwal[]>([]);
  const [listMapel, setListMapel] = useState<Mapel[]>([]);
  
  const [selectedMapelId, setSelectedMapelId] = useState('');
  const [tanggalUjian, setTanggalUjian] = useState('');
  const [jamMulai, setJamMulai] = useState('');
  const [durasi, setDurasi] = useState(90);
  const [token, setToken] = useState('');
  const [jumlahSoal, setJumlahSoal] = useState(40);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const { data: mapelData, error: mapelError } = await supabase
        .from('mapel')
        .select('id, nama_mapel, kelas, jurusan')
        .order('nama_mapel', { ascending: true });
        
      if (mapelError) throw mapelError;
      if (mapelData) setListMapel(mapelData);

      const { data: jadwalData, error: jadwalError } = await supabase
        .from('jadwal_ujian')
        .select('id, tanggal_ujian, jam_mulai, durasi_menit, token_ujian, jumlah_soal_tampil, mapel_id, mapel(nama_mapel, kelas, jurusan)')
        .order('tanggal_ujian', { ascending: false });

      if (jadwalError) throw jadwalError;
      if (jadwalData) {
        // PERBAIKAN: Mapping tipe data yang aman tanpa memicu crash 'unknown object'
        const formattedJadwal = (jadwalData as any[]).map((item) => ({
          id: item.id,
          tanggal_ujian: item.tanggal_ujian,
          jam_mulai: item.jam_mulai,
          durasi_menit: item.durasi_menit,
          token_ujian: item.token_ujian,
          jumlah_soal_tampil: item.jumlah_soal_tampil,
          mapel_id: item.mapel_id,
          mapel: Array.isArray(item.mapel) ? item.mapel[0] : item.mapel,
        }));
        setListJadwal(formattedJadwal);
      }
    } catch (err: any) {
      console.error("Gagal mengambil data dari server:", err.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateRandomToken = () => {
    const karakter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let hasilToken = '';
    for (let i = 0; i < 5; i++) {
      hasilToken += karakter.charAt(Math.floor(Math.random() * karakter.length));
    }
    setToken(hasilToken);
  };

  const handlePicuEdit = (jadwal: Jadwal) => {
    setEditingId(jadwal.id);
    setSelectedMapelId(jadwal.mapel_id);
    setTanggalUjian(jadwal.tanggal_ujian);
    setJamMulai(jadwal.jam_mulai);
    setDurasi(jadwal.durasi_menit);
    setToken(jadwal.token_ujian);
    setJumlahSoal(jadwal.jumlah_soal_tampil);
    
    setNotifikasi({ pesan: '✏️ Mode Koreksi Aktif: Silakan ubah parameter form di atas.', tipe: 'sukses' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBatalkanEdit = () => {
    setEditingId(null);
    setSelectedMapelId('');
    setTanggalUjian('');
    setJamMulai('');
    setDurasi(90);
    setToken('');
    setJumlahSoal(40);
  };

  const handleSimpanAtauRilahJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMapelId || !tanggalUjian || !jamMulai || !token || jumlahSoal <= 0) {
      setNotifikasi({ pesan: '⚠️ Mohon lengkapi seluruh data parameter jadwal.', tipe: 'gagal' });
      return;
    }
    setLoading(true);

    const payload = {
      mapel_id: selectedMapelId,
      tanggal_ujian: tanggalUjian,
      jam_mulai: jamMulai,
      durasi_menit: Number(durasi),
      token_ujian: token.trim().toUpperCase(),
      jumlah_soal_tampil: Number(jumlahSoal),
    };

    let errorResult;

    if (editingId) {
      const { error } = await supabase
        .from('jadwal_ujian')
        .update(payload)
        .eq('id', editingId);
      errorResult = error;
    } else {
      const { error } = await supabase
        .from('jadwal_ujian')
        .insert([payload]);
      errorResult = error;
    }

    if (!errorResult) {
      setNotifikasi({ 
        pesan: editingId ? '🎉 Perubahan parameter rilis jadwal berhasil diperbarui!' : '🎉 Berhasil! Jadwal Ujian telah dirilis.', 
        tipe: 'sukses' 
      });
      handleBatalkanEdit();
      fetchData(); 
    } else {
      setNotifikasi({ pesan: '❌ Gagal mengeksekusi data: ' + errorResult.message, tipe: 'gagal' });
    }
    setLoading(false);
  };

  const handleHapusJadwal = async (id: string) => {
    const konfirmasi = confirm('⚠️ Apakah Anda yakin ingin menghapus jadwal rilis ini?');
    if (!konfirmasi) return;

    try {
      const { error } = await supabase
        .from('jadwal_ujian')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifikasi({ pesan: '🗑️ Jadwal ujian berhasil dihapus.', tipe: 'sukses' });
      if (editingId === id) handleBatalkanEdit();
      fetchData();
    } catch (err: any) {
      setNotifikasi({ pesan: '❌ Gagal menghapus jadwal: ' + err.message, tipe: 'gagal' });
    }
  };

  return (
    <div className="space-y-8 relative max-w-6xl mx-auto p-4">
      {notifikasi && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-lg border transition-all duration-300 max-w-md ${
          notifikasi.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="text-sm font-semibold">{notifikasi.pesan}</div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rilis Jadwal & Atur Kuota Soal</h1>
        <p className="text-gray-500 text-sm">Distribusikan ujian secara acak terkontrol lengkap dengan konfigurasi waktu, token masuk, dan batas soal tampil.</p>
      </div>

      <div className={`p-6 rounded-xl shadow-sm border transition-all ${editingId ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-gray-200'}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-gray-800">
            {editingId ? '✏️ Koreksi Parameter Distribusi Ujian' : 'Parameter Rilis Ujian Baru'}
          </h2>
          {editingId && (
            <button type="button" onClick={handleBatalkanEdit} className="text-xs bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-bold transition-all">
              Batalkan Koreksi
            </button>
          )}
        </div>

        <form onSubmit={handleSimpanAtauRilahJadwal} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Pilih Mata Pelajaran</label>
            <select 
              value={selectedMapelId} 
              onChange={(e) => setSelectedMapelId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 font-medium"
              required
            >
              <option value="" className="text-gray-500 bg-white">-- Pilih Mata Pelajaran --</option>
              {listMapel.length === 0 ? (
                <option disabled className="text-gray-400 bg-white italic">Tidak ada mapel tersedia di database</option>
              ) : (
                listMapel.map(m => (
                  <option key={m.id} value={m.id} className="text-gray-950 bg-white font-medium">
                    {m.nama_mapel} ({m.kelas || 'Semua Kelas'} - {m.jurusan || 'UMUM'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal Pelaksanaan</label>
            <input type="date" value={tanggalUjian} onChange={(e) => setTanggalUjian(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 font-medium bg-white" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Jam Mulai Masuk (WIB)</label>
            <input type="time" value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 font-medium bg-white" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Durasi Ujian (Menit)</label>
            <input type="number" value={durasi} onChange={(e) => setDurasi(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 font-medium bg-white" min="1" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Batas Maks Soal Tampil</label>
            <input type="number" value={jumlahSoal} onChange={(e) => setJumlahSoal(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 font-medium bg-white" min="1" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Token Akses Masuk</label>
            <div className="flex gap-2">
              <input type="text" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold tracking-widest text-center text-blue-600 bg-gray-50" maxLength={5} required />
              <button type="button" onClick={generateRandomToken} className="bg-gray-800 hover:bg-gray-900 text-white font-bold px-3 py-2 rounded-lg text-xs transition-all whitespace-nowrap">Acak 🎲</button>
            </div>
          </div>

          <div className="lg:col-span-3 flex justify-end mt-2">
            <button type="submit" disabled={loading} className={`font-medium px-8 py-2.5 rounded-lg text-sm transition-all shadow-md w-full lg:w-auto text-white ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {loading ? 'Menyinkronkan Server...' : editingId ? '💾 Terapkan Hasil Koreksi' : '🚀 Rilis Jadwal & Buka Kran Ujian'}
            </button>
          </div>
        </form>
      </div>

      {/* TABEL LIST JADWAL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-700">Daftar Jadwal & Status Distribusi Soal</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm font-semibold">
              <th className="p-4 w-16">No.</th>
              <th className="p-4">Mata Pelajaran</th>
              <th className="p-4">Tanggal & Jam</th>
              <th className="p-4 text-center">Durasi</th>
              <th className="p-4 text-center">Kuota Soal</th>
              <th className="p-4 text-center">Token</th>
              <th className="p-4 text-center w-40">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-950 text-sm divide-y divide-gray-100">
            {fetching ? (
              <tr><td colSpan={7} className="text-center p-8 text-gray-400">Sedang memuat jadwal rilis...</td></tr>
            ) : listJadwal.length === 0 ? (
              <tr><td colSpan={7} className="text-center p-8 text-gray-400">Belum ada jadwal ujian yang dikonfigurasi.</td></tr>
            ) : (
              listJadwal.map((jadwal, index) => (
                <tr key={jadwal.id} className={`transition-colors ${editingId === jadwal.id ? 'bg-amber-50/60' : 'hover:bg-gray-50/50'}`}>
                  <td className="p-4 text-gray-500">{index + 1}</td>
                  <td className="p-4">
                    <p className="font-semibold text-gray-900">
                      {jadwal.mapel 
                        ? `${jadwal.mapel.nama_mapel} (${jadwal.mapel.kelas || 'Semua Kelas'} - ${jadwal.mapel.jurusan || 'UMUM'})`
                        : 'Mapel Terhapus'
                      }
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-gray-800">{jadwal.tanggal_ujian}</p>
                    <p className="text-xs text-gray-500">Pukul {jadwal.jam_mulai} WIB</p>
                  </td>
                  <td className="p-4 text-center font-semibold text-gray-600">{jadwal.durasi_menit} Menit</td>
                  <td className="p-4 text-center">
                    <span className="bg-purple-50 text-purple-700 font-bold px-2.5 py-0.5 rounded text-xs">{jadwal.jumlah_soal_tampil} Soal</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-blue-50 text-blue-700 font-mono font-black text-sm px-3 py-1 rounded border border-blue-100 tracking-wider">{jadwal.token_ujian}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-center items-center">
                      <button type="button" onClick={() => handlePicuEdit(jadwal)} className="p-1 px-2.5 bg-gray-100 hover:bg-amber-500 hover:text-white rounded-md text-xs font-bold text-gray-600 transition-all border border-gray-200">✏️ Edit</button>
                      <button type="button" onClick={() => handleHapusJadwal(jadwal.id)} className="p-1 px-2.5 bg-gray-100 hover:bg-rose-600 hover:text-white rounded-md text-xs font-bold text-rose-600 transition-all border border-gray-200">🗑️ Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}