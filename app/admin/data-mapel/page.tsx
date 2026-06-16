'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase';

interface Mapel {
  id: string;
  kelas: string; 
  nama_mapel: string;
  jurusan: string; 
  status_aktif: boolean;
}

// Interface untuk data master dropdown
interface MasterData {
  kelas: string[];
  mapel: string[];
  jurusan: string[];
}

export default function DataMapelPage() {
  const [listMapel, setListMapel] = useState<Mapel[]>([]);
  const [kelas, setKelas] = useState(''); 
  const [namaMapel, setNamaMapel] = useState('');
  const [jurusan, setJurusan] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false); 

  const fileInputRef = useRef<HTMLInputElement>(null); 

  // State Data Master Dropdown
  const [master, setMaster] = useState<MasterData>({ kelas: [], mapel: [], jurusan: [] });

  // State Modal Tambah Opsi Master Baru
  const [isMasterOpen, setIsMasterOpen] = useState(false);
  const [tipeMaster, setTipeMaster] = useState<'kelas' | 'mapel' | 'jurusan'>('kelas');
  const [inputMasterBaru, setInputMasterBaru] = useState('');

  // State Modal Edit Mapel
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editKelas, setEditKelas] = useState(''); 
  const [editNama, setEditNama] = useState('');
  const [editJurusan, setEditJurusan] = useState(''); 

  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  // Fetch seluruh data opsi dropdown dari tabel master
  const fetchMasterData = async () => {
    const [resKelas, resMapel, resJurusan] = await Promise.all([
      supabase.from('master_kelas').select('nama_kelas').order('nama_kelas', { ascending: true }),
      supabase.from('master_nama_mapel').select('nama_mapel').order('nama_mapel', { ascending: true }),
      supabase.from('master_jurusan').select('nama_jurusan').order('nama_jurusan', { ascending: true })
    ]);

    setMaster({
      kelas: resKelas.data?.map(d => d.nama_kelas) || [],
      mapel: resMapel.data?.map(d => d.nama_mapel) || [],
      jurusan: resJurusan.data?.map(d => d.nama_jurusan) || []
    });
  };

  const fetchMapel = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('mapel')
      .select('*')
      .order('nama_mapel', { ascending: true });
    
    if (!error && data) {
      setListMapel(data as Mapel[]);
    }
    setFetching(false);
  };

  useEffect(() => {
    fetchMapel();
    fetchMasterData();
  }, []);

  // Handler Tambah Opsi Master Baru (Kelas / Mapel / Jurusan) via UI Modal
  const handleTambahMasterBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMasterBaru.trim()) return;
    setLoading(true);

    let tabelTarget = '';
    let kolomTarget = '';
    const nilaiInput = inputMasterBaru.trim();

    if (tipeMaster === 'kelas') { tabelTarget = 'master_kelas'; kolomTarget = 'nama_kelas'; }
    else if (tipeMaster === 'mapel') { tabelTarget = 'master_nama_mapel'; kolomTarget = 'nama_mapel'; }
    else { tabelTarget = 'master_jurusan'; kolomTarget = 'nama_jurusan'; }

    // Format Kapitalisasi otomatis kecuali untuk nama mapel
    const nilaiFinal = tipeMaster === 'mapel' ? nilaiInput : nilaiInput.toUpperCase();

    const { error } = await supabase
      .from(tabelTarget)
      .insert([{ [kolomTarget]: nilaiFinal }]);

    if (!error) {
      await fetchMasterData();
      setInputMasterBaru('');
      setIsMasterOpen(false);
      setNotifikasi({ pesan: `🎉 Opsi ${tipeMaster} baru berhasil ditambahkan!`, tipe: 'sukses' });
    } else {
      setNotifikasi({ pesan: '❌ Gagal: Data sudah ada atau gangguan jaringan.', tipe: 'gagal' });
    }
    setLoading(false);
  };

  const handleTambahMapel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kelas || !namaMapel || !jurusan) return;
    setLoading(true);

    const { error } = await supabase
      .from('mapel')
      .insert([
        { 
          kelas: kelas.toUpperCase().trim(), 
          nama_mapel: namaMapel.trim(), 
          jurusan: jurusan.toUpperCase().trim(), 
          status_aktif: true 
        }
      ]);

    if (!error) {
      setKelas('');
      setNamaMapel('');
      setJurusan('');
      fetchMapel(); 
      setNotifikasi({ pesan: '🎉 Mata pelajaran berhasil ditambahkan!', tipe: 'sukses' });
    } else {
      console.error("Tambah Mapel Error:", error);
      setNotifikasi({ pesan: `❌ Gagal: ${error.message || 'Periksa koneksi DB'}`, tipe: 'gagal' });
    }
    setLoading(false);
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('mapel')
      .update({ status_aktif: !currentStatus })
      .eq('id', id);

    if (!error) {
      setListMapel(listMapel.map(item => 
        item.id === id ? { ...item, status_aktif: !currentStatus } : item
      ));
      setNotifikasi({ pesan: '🔄 Status visibilitas diperbarui.', tipe: 'sukses' });
    } else {
      setNotifikasi({ pesan: '❌ Gagal mengubah status.', tipe: 'gagal' });
    }
  };

  const bukaModalEdit = (mapel: Mapel) => {
    setEditId(mapel.id);
    setEditKelas(mapel.kelas || ''); 
    setEditNama(mapel.nama_mapel);
    setEditJurusan(mapel.jurusan || ''); 
    setIsEditOpen(true);
  };

  const handleSimpanEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editKelas || !editNama || !editJurusan) return;
    setLoading(true);

    const { error } = await supabase
      .from('mapel')
      .update({
        kelas: editKelas.toUpperCase().trim(), 
        nama_mapel: editNama.trim(), 
        jurusan: editJurusan.toUpperCase().trim()
      })
      .eq('id', editId);

    if (!error) {
      setIsEditOpen(false);
      fetchMapel(); 
      setNotifikasi({ pesan: '🎉 Perubahan data berhasil disimpan!', tipe: 'sukses' });
    } else {
      setNotifikasi({ pesan: '❌ Gagal memperbarui data.', tipe: 'gagal' });
    }
    setLoading(false);
  };

  const handleHapusMapel = async (id: string, nama: string) => {
    const konfirmasi = confirm(`⚠️ Hapus mata pelajaran "${nama}"?`);
    if (!konfirmasi) return;

    const { error } = await supabase
      .from('mapel')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchMapel(); 
      setNotifikasi({ pesan: '🗑️ Data berhasil dihapus.', tipe: 'sukses' });
    } else {
      setNotifikasi({ pesan: '❌ Gagal menghapus data.', tipe: 'gagal' });
    }
  };

  const handleResetSemuaMapel = async () => {
    if (listMapel.length === 0) return;
    const konfirmasi = confirm("⚠️ Hapus semua data di tabel ini? Tindakan ini permanen!");
    if (!konfirmasi) return;

    setResetLoading(true);
    const semuaId = listMapel.map(mapel => mapel.id);

    const { error } = await supabase
      .from('mapel')
      .delete()
      .in('id', semuaId); 

    if (!error) {
      setListMapel([]);
      setNotifikasi({ pesan: '💥 Seluruh data mapel berhasil dikosongkan!', tipe: 'sukses' });
    } else {
      console.error("Reset Error:", error);
      setNotifikasi({ pesan: `❌ Gagal mereset tabel: ${error.message || 'Periksa aturan RLS DB'}`, tipe: 'gagal' });
    }
    setResetLoading(false);
  };

  const handleDownloadTemplate = () => {
    const headers = 'kelas,nama_mapel,jurusan\n';
    const contohData = 'X,Matematika,UMUM\nXI,Bahasa Inggris,TKJ';
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + contohData);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', 'template_mapel.csv');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setImportLoading(false);
        return;
      }

      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length < 2) {
        setNotifikasi({ pesan: '❌ File CSV kosong.', tipe: 'gagal' });
        setImportLoading(false);
        return;
      }

      const pemisah = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].toLowerCase().split(pemisah).map(h => h.replace(/["']/g, '').trim());
      
      if (!headers.includes('kelas') || !headers.includes('nama_mapel') || !headers.includes('jurusan')) {
        setNotifikasi({ pesan: '❌ Format salah. Harus ada kolom: kelas, nama_mapel, jurusan', tipe: 'gagal' });
        setImportLoading(false);
        return;
      }

      const dataToInsert = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(pemisah).map(c => c.replace(/["']/g, '').trim());
        if (columns.length >= headers.length) {
          const valKelas = columns[headers.indexOf('kelas')];
          const valNama = columns[headers.indexOf('nama_mapel')];
          const valJurusan = columns[headers.indexOf('jurusan')];

          if (valKelas && valNama && valJurusan) {
            dataToInsert.push({
              kelas: valKelas.toUpperCase(),
              nama_mapel: valNama, 
              jurusan: valJurusan.toUpperCase(),
              status_aktif: true
            });
          }
        }
      }

      if (dataToInsert.length === 0) {
        setImportLoading(false);
        return;
      }

      const { error } = await supabase.from('mapel').insert(dataToInsert);
      if (!error) {
        fetchMapel();
        setNotifikasi({ pesan: `🎉 Berhasil mengimport ${dataToInsert.length} data!`, tipe: 'sukses' });
      } else {
        setNotifikasi({ pesan: `❌ Gagal: ${error.message}`, tipe: 'gagal' });
      }
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const bukaModalMaster = (tipe: 'kelas' | 'mapel' | 'jurusan') => {
    setTipeMaster(tipe);
    setInputMasterBaru('');
    setIsMasterOpen(true);
  };

  return (
    <div className="space-y-8 relative p-4 max-w-5xl mx-auto">
      {notifikasi && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-md border ${notifikasi.tipe === 'sukses' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'}`}>
          <div className="text-sm font-semibold">{notifikasi.pesan}</div>
        </div>
      )}

      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Mata Pelajaran</h1>
          <p className="text-gray-500 text-sm">Kelola kurikulum, kelas, dan rumpun jurusan secara realtime.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
          <button type="button" onClick={handleDownloadTemplate} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold">📥 Template CSV</button>
          <button type="button" disabled={importLoading} onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">{importLoading ? '⏳ Mengimport...' : '📤 Import CSV'}</button>
          <button type="button" disabled={resetLoading} onClick={handleResetSemuaMapel} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold">{resetLoading ? '⏳ Mereset...' : '💥 Reset Tabel'}</button>
        </div>
      </div>

      {/* QUICK MASTER CONTROLLER BAR */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">⚙️ Pengaturan Opsi Master:</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => bukaModalMaster('kelas')} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-xs">➕ Buat Kelas Baru</button>
          <button type="button" onClick={() => bukaModalMaster('mapel')} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-xs">➕ Buat Mapel Baru</button>
          <button type="button" onClick={() => bukaModalMaster('jurusan')} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-xs">➕ Buat Jurusan Baru</button>
        </div>
      </div>

      {/* CONTAINER FORM UTAMA (DROPDOWN) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-base font-bold text-gray-800 mb-4">Tambah Mata Pelajaran Baru</h2>
        <form onSubmit={handleTambahMapel} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Kelas</label>
            <select value={kelas} onChange={(e) => setKelas(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
              <option value="">-- Pilih Kelas --</option>
              {master.kelas.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Mata Pelajaran</label>
            <select value={namaMapel} onChange={(e) => setNamaMapel(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
              <option value="">-- Pilih Mata Pelajaran --</option>
              {master.mapel.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Jurusan / Rumpun</label>
            <select value={jurusan} onChange={(e) => setJurusan(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
              <option value="">-- Pilih Jurusan --</option>
              {master.jurusan.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white font-medium px-6 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? 'Menyimpan...' : 'Tambah Mapel'}</button>
          </div>
        </form>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600 text-sm font-semibold">
              <th className="p-4 w-16">No.</th>
              <th className="p-4 text-center">Kelas</th>
              <th className="p-4">Nama Mata Pelajaran</th>
              <th className="p-4 text-center">Jurusan</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-900 text-sm divide-y">
            {fetching ? (
              <tr><td colSpan={6} className="text-center p-8 text-gray-400">Memuat data...</td></tr>
            ) : listMapel.length === 0 ? (
              <tr><td colSpan={6} className="text-center p-8 text-gray-400">Belum ada data mata pelajaran.</td></tr>
            ) : (
              listMapel.map((mapel, index) => (
                <tr key={mapel.id} className="hover:bg-gray-50/50">
                  <td className="p-4 text-gray-500">{index + 1}</td>
                  <td className="p-4 text-center font-bold text-blue-700">{mapel.kelas}</td>
                  <td className="p-4 font-semibold">{mapel.nama_mapel}</td>
                  <td className="p-4 text-center"><span className="bg-gray-100 text-gray-800 text-xs font-bold px-2.5 py-0.5 rounded">{mapel.jurusan}</span></td>
                  <td className="p-4 text-center">
                    <button type="button" onClick={() => handleToggleStatus(mapel.id, mapel.status_aktif)} className={`px-3 py-1 rounded-full text-xs font-bold ${mapel.status_aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {mapel.status_aktif ? 'BUKA' : 'TUTUP'}
                    </button>
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <button type="button" onClick={() => bukaModalEdit(mapel)} className="text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 text-xs font-bold">✏️ Edit</button>
                    <button type="button" onClick={() => handleHapusMapel(mapel.id, mapel.nama_mapel)} className="text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 text-xs font-bold">🗑️ Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 🟢 MODAL MASTER BARU (UNTUK MEMBUAT OPSI BARU TANPA KE DATABASE MANUAL) */}
      {isMasterOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-black text-gray-900 capitalize">Tambah Master {tipeMaster} Baru</h3>
            <form onSubmit={handleTambahMasterBaru} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nama {tipeMaster}</label>
                <input 
                  type="text" 
                  value={inputMasterBaru} 
                  onChange={(e) => setInputMasterBaru(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" 
                  placeholder={tipeMaster === 'kelas' ? 'Contoh: XII' : tipeMaster === 'jurusan' ? 'Contoh: MM' : 'Contoh: Fisika'} 
                  required 
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setIsMasterOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm">{loading ? 'Memproses...' : 'Simpan Pilihan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔵 MODAL EDIT DATA MAPEL (SUDAH MENJADI DROPDOWN JUGA) */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Ubah Data Mata Pelajaran</h3>
            <form onSubmit={handleSimpanEdit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kelas</label>
                <select value={editKelas} onChange={(e) => setEditKelas(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
                  {master.kelas.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Mata Pelajaran</label>
                <select value={editNama} onChange={(e) => setEditNama(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
                  {master.mapel.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Jurusan / Rumpun</label>
                <select value={editJurusan} onChange={(e) => setEditJurusan(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
                  {master.jurusan.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs shadow-sm">{loading ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}