'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';

interface Mapel {
  id: string;
  kelas: string; 
  nama_mapel: string;
  jurusan: string; 
  status_mapel?: string | null;
}

interface MasterData {
  kelas: string[];
  mapel: string[];
  jurusan: string[];
  status: string[];
}

export default function DataMapelPage() {
  const [listMapel, setListMapel] = useState<Mapel[]>([]);
  const [kelas, setKelas] = useState(''); 
  const [namaMapel, setNamaMapel] = useState('');
  const [jurusan, setJurusan] = useState(''); 
  const [statusMapel, setStatusMapel] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false); 

  const fileInputRef = useRef<HTMLInputElement>(null); 

  // State Data Master Dropdown
  const [master, setMaster] = useState<MasterData>({ kelas: [], mapel: [], jurusan: [], status: [] });

  // State Modal Kelola Master (Tambah/Hapus)
  const [isMasterOpen, setIsMasterOpen] = useState(false);
  const [tipeMaster, setTipeMaster] = useState<'kelas' | 'mapel' | 'jurusan' | 'status'>('kelas');
  const [inputMasterBaru, setInputMasterBaru] = useState('');

  // State Modal Edit Mapel
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editKelas, setEditKelas] = useState(''); 
  const [editNama, setEditNama] = useState('');
  const [editJurusan, setEditJurusan] = useState(''); 
  const [editStatusMapel, setEditStatusMapel] = useState('');

  // State Modal Konfirmasi Pop-Up (Tengah Layar)
  const [modalKonfirmasi, setModalKonfirmasi] = useState<{
    isOpen: boolean;
    judul: string;
    pesan: string;
    tipeAksi: 'hapusMaster' | 'resetMapel' | null;
    payload?: any;
  }>({
    isOpen: false,
    judul: '',
    pesan: '',
    tipeAksi: null,
  });

  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  const fetchMasterData = useCallback(async () => {
    const [resKelas, resMapel, resJurusan, resStatus] = await Promise.all([
      supabase.from('master_kelas').select('nama_kelas').order('nama_kelas', { ascending: true }),
      supabase.from('master_nama_mapel').select('nama_mapel').order('nama_mapel', { ascending: true }),
      supabase.from('master_jurusan').select('nama_jurusan').order('nama_jurusan', { ascending: true }),
      supabase.from('master_status_mapel').select('nama_status').order('nama_status', { ascending: true })
    ]);

    setMaster({
      kelas: resKelas.data?.map(d => d.nama_kelas) || [],
      mapel: resMapel.data?.map(d => d.nama_mapel) || [],
      jurusan: resJurusan.data?.map(d => d.nama_jurusan) || [],
      status: resStatus.data?.map(d => d.nama_status) || []
    });
  }, []);

  const fetchMapel = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('mapel')
      .select('*')
      .order('nama_mapel', { ascending: true });
    
    if (!error && data) {
      setListMapel(data as Mapel[]);
    } else if (error) {
      console.error("Fetch Mapel Error:", error.message || error);
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    fetchMapel();
    fetchMasterData();
  }, [fetchMapel, fetchMasterData]);

  // --- FUNGSI TAMBAH DATA MASTER ---
  const handleTambahMasterBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMasterBaru.trim()) return;
    setLoading(true);

    let tabelTarget = '';
    let kolomTarget = '';
    const nilaiInput = inputMasterBaru.trim();

    if (tipeMaster === 'kelas') { 
      tabelTarget = 'master_kelas'; 
      kolomTarget = 'nama_kelas'; 
    } else if (tipeMaster === 'mapel') { 
      tabelTarget = 'master_nama_mapel'; 
      kolomTarget = 'nama_mapel'; 
    } else if (tipeMaster === 'jurusan') { 
      tabelTarget = 'master_jurusan'; 
      kolomTarget = 'nama_jurusan'; 
    } else if (tipeMaster === 'status') { 
      tabelTarget = 'master_status_mapel'; 
      kolomTarget = 'nama_status'; 
    }

    const nilaiFinal = tipeMaster === 'mapel' ? nilaiInput : nilaiInput.toUpperCase();

    const { error } = await supabase
      .from(tabelTarget)
      .insert([{ [kolomTarget]: nilaiFinal }])
      .select();

    if (!error) {
      await fetchMasterData();
      setInputMasterBaru('');
      setNotifikasi({ pesan: `🎉 Opsi ${tipeMaster} baru berhasil ditambahkan!`, tipe: 'sukses' });
    } else {
      console.error("Tambah Master Error Message:", error.message);
      setNotifikasi({ pesan: `❌ Gagal: ${error.message || 'Data mungkin sudah ada/tabel belum dibuat.'}`, tipe: 'gagal' });
    }
    setLoading(false);
  };

  // --- TRIGGER KONFIRMASI HAPUS MASTER ---
  const triggerKonfirmasiHapusMaster = (namaItem: string) => {
    setModalKonfirmasi({
      isOpen: true,
      judul: 'Hapus Opsi Dropdown',
      pesan: `Apakah Anda yakin ingin menghapus opsi "${namaItem}" dari daftar ${tipeMaster}?`,
      tipeAksi: 'hapusMaster',
      payload: { namaItem }
    });
  };

  // --- EKSEKUSI HAPUS MASTER ---
  const eksekusiHapusMaster = async (namaItem: string) => {
    let tabelTarget = '';
    let kolomTarget = '';

    if (tipeMaster === 'kelas') { 
      tabelTarget = 'master_kelas'; 
      kolomTarget = 'nama_kelas'; 
    } else if (tipeMaster === 'mapel') { 
      tabelTarget = 'master_nama_mapel'; 
      kolomTarget = 'nama_mapel'; 
    } else if (tipeMaster === 'jurusan') { 
      tabelTarget = 'master_jurusan'; 
      kolomTarget = 'nama_jurusan'; 
    } else if (tipeMaster === 'status') { 
      tabelTarget = 'master_status_mapel'; 
      kolomTarget = 'nama_status'; 
    }

    const { error } = await supabase
      .from(tabelTarget)
      .delete()
      .eq(kolomTarget, namaItem);

    if (!error) {
      await fetchMasterData();
      setNotifikasi({ pesan: `🗑️ Opsi ${namaItem} berhasil dihapus.`, tipe: 'sukses' });
    } else {
      console.error("Hapus Master Error Message:", error.message);
      setNotifikasi({ pesan: `❌ Gagal menghapus opsi: ${error.message}`, tipe: 'gagal' });
    }
  };

  // --- FUNGSI TAMBAH MAPEL BARU ---
  const handleTambahMapel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kelas || !namaMapel || !jurusan) return;
    setLoading(true);

    const payload = { 
      kelas: kelas.toUpperCase().trim(), 
      nama_mapel: namaMapel.trim(), 
      jurusan: jurusan.toUpperCase().trim(), 
      status_mapel: statusMapel ? statusMapel.toUpperCase().trim() : null
    };

    const { error } = await supabase
      .from('mapel')
      .insert([payload])
      .select();

    if (!error) {
      setKelas('');
      setNamaMapel('');
      setJurusan('');
      setStatusMapel('');
      fetchMapel(); 
      setNotifikasi({ pesan: '🎉 Mata pelajaran berhasil ditambahkan!', tipe: 'sukses' });
    } else {
      console.error("Gagal Tambah Mapel - Message:", error.message);
      setNotifikasi({ 
        pesan: `❌ Gagal: ${error.message || 'Cek konsol browser / constraint Supabase.'}`, 
        tipe: 'gagal' 
      });
    }
    setLoading(false);
  };

  const bukaModalEdit = (mapel: Mapel) => {
    setEditId(mapel.id);
    setEditKelas(mapel.kelas || ''); 
    setEditNama(mapel.nama_mapel);
    setEditJurusan(mapel.jurusan || ''); 
    setEditStatusMapel(mapel.status_mapel || '');
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
        jurusan: editJurusan.toUpperCase().trim(),
        status_mapel: editStatusMapel ? editStatusMapel.toUpperCase().trim() : null
      })
      .eq('id', editId)
      .select();

    if (!error) {
      setIsEditOpen(false);
      fetchMapel(); 
      setNotifikasi({ pesan: '🎉 Perubahan data berhasil disimpan!', tipe: 'sukses' });
    } else {
      console.error("Simpan Edit Mapel Error Message:", error.message);
      setNotifikasi({ pesan: `❌ Gagal memperbarui data: ${error.message}`, tipe: 'gagal' });
    }
    setLoading(false);
  };

  // --- FUNGSI HAPUS MAPEL (LANGSUNG TANPA KONFIRMASI) ---
  const handleHapusMapel = async (id: string, nama: string) => {
    const { error } = await supabase
      .from('mapel')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchMapel(); 
      setNotifikasi({ pesan: `🗑️ Mata pelajaran "${nama}" berhasil dihapus.`, tipe: 'sukses' });
    } else {
      console.error("Hapus Mapel Error Message:", error.message);
      setNotifikasi({ pesan: `❌ Gagal menghapus data: ${error.message}`, tipe: 'gagal' });
    }
  };

  // --- TRIGGER KONFIRMASI RESET SEMUA MAPEL ---
  const triggerKonfirmasiResetSemuaMapel = () => {
    if (listMapel.length === 0) return;
    setModalKonfirmasi({
      isOpen: true,
      judul: 'Reset Seluruh Data Mapel',
      pesan: 'Apakah Anda yakin ingin menghapus seluruh data mata pelajaran di tabel ini? Tindakan ini tidak dapat dibatalkan.',
      tipeAksi: 'resetMapel'
    });
  };

  // --- EKSEKUSI RESET MAPEL ---
  const eksekusiResetSemuaMapel = async () => {
    setResetLoading(true);

    const { error } = await supabase
      .from('mapel')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); 

    if (!error) {
      setListMapel([]);
      setNotifikasi({ pesan: '💥 Seluruh data mapel berhasil dikosongkan!', tipe: 'sukses' });
    } else {
      console.error("Reset Mapel Error Message:", error.message);
      setNotifikasi({ pesan: `❌ Gagal mereset tabel: ${error.message}`, tipe: 'gagal' });
    }
    setResetLoading(false);
  };

  // --- EKSEKUTOR AKSI MODAL POPUP ---
  const handleJalankanAksiModal = async () => {
    const { tipeAksi, payload } = modalKonfirmasi;
    setModalKonfirmasi({ isOpen: false, judul: '', pesan: '', tipeAksi: null });

    if (tipeAksi === 'hapusMaster' && payload?.namaItem) {
      await eksekusiHapusMaster(payload.namaItem);
    } else if (tipeAksi === 'resetMapel') {
      await eksekusiResetSemuaMapel();
    }
  };

  const handleDownloadTemplate = () => {
    const headers = 'kelas,nama_mapel,jurusan,status_mapel\n';
    const contohData = 'X,Matematika,UMUM,\nXI,Pendidikan Agama Islam,TKJ,AGAMA\nXII,Bahasa Jepang,RPL,MAPEL PILIHAN';
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

      const idxKelas = headers.indexOf('kelas');
      const idxNama = headers.indexOf('nama_mapel');
      const idxJurusan = headers.indexOf('jurusan');
      const idxStatus = headers.indexOf('status_mapel');

      if (idxKelas === -1 || idxNama === -1 || idxJurusan === -1) {
        setNotifikasi({ pesan: '❌ Header CSV tidak sesuai template.', tipe: 'gagal' });
        setImportLoading(false);
        return;
      }

      const dataToInsert = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(pemisah).map(c => c.replace(/["']/g, '').trim());
        if (columns.length >= 3) {
          const valKelas = columns[idxKelas];
          const valNama = columns[idxNama];
          const valJurusan = columns[idxJurusan];
          const rawStatus = idxStatus !== -1 && columns[idxStatus] ? columns[idxStatus].toUpperCase() : '';

          if (valKelas && valNama && valJurusan) {
            dataToInsert.push({
              kelas: valKelas.toUpperCase(),
              nama_mapel: valNama, 
              jurusan: valJurusan.toUpperCase(),
              status_mapel: rawStatus || null
            });
          }
        }
      }

      if (dataToInsert.length === 0) {
        setNotifikasi({ pesan: '❌ Tidak ada data valid yang bisa diimport.', tipe: 'gagal' });
        setImportLoading(false);
        return;
      }

      const { error } = await supabase
        .from('mapel')
        .insert(dataToInsert)
        .select();

      if (!error) {
        fetchMapel();
        setNotifikasi({ pesan: `🎉 Berhasil mengimport ${dataToInsert.length} data!`, tipe: 'sukses' });
      } else {
        console.error("Import CSV Error Message:", error.message);
        setNotifikasi({ pesan: `❌ Gagal: ${error.message}`, tipe: 'gagal' });
      }
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const bukaModalMaster = (tipe: 'kelas' | 'mapel' | 'jurusan' | 'status') => {
    setTipeMaster(tipe);
    setInputMasterBaru('');
    setIsMasterOpen(true);
  };

  return (
    <div className="space-y-6 sm:space-y-8 relative p-3 sm:p-6 max-w-5xl mx-auto w-full">
      {/* Toast Notification */}
      {notifikasi && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto z-50 p-4 rounded-xl shadow-md border transition-all ${notifikasi.tipe === 'sukses' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'}`}>
          <div className="text-xs sm:text-sm font-semibold">{notifikasi.pesan}</div>
        </div>
      )}

      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kelola Mata Pelajaran</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Atur kurikulum, kelas, jurusan, dan status opsional mata pelajaran.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
          <button type="button" onClick={handleDownloadTemplate} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all">📥 Template CSV</button>
          <button type="button" disabled={importLoading} onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-all">{importLoading ? '⏳ Mengimport...' : '📤 Import CSV'}</button>
          <button type="button" disabled={resetLoading} onClick={triggerKonfirmasiResetSemuaMapel} className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition-all">{resetLoading ? '⏳ Mereset...' : '💥 Reset Tabel'}</button>
        </div>
      </div>

      {/* QUICK MASTER BAR */}
      <div className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">⚙️ Pengaturan Opsi Dropdown:</span>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button type="button" onClick={() => bukaModalMaster('kelas')} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-xs text-center transition-all">⚙️ Kelola Kelas</button>
          <button type="button" onClick={() => bukaModalMaster('mapel')} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-xs text-center transition-all">⚙️ Kelola Nama Mapel</button>
          <button type="button" onClick={() => bukaModalMaster('jurusan')} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 shadow-xs text-center transition-all">⚙️ Kelola Jurusan</button>
          <button type="button" onClick={() => bukaModalMaster('status')} className="px-3 py-1.5 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg text-xs font-bold text-purple-700 shadow-xs text-center transition-all">⚙️ Kelola Status Khusus</button>
        </div>
      </div>

      {/* FORM UTAMA */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-4">Tambah Mata Pelajaran Baru</h2>
        <form onSubmit={handleTambahMapel} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Kelas</label>
            <select value={kelas} onChange={(e) => setKelas(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
              <option value="">-- Pilih Kelas --</option>
              {master.kelas.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Mata Pelajaran</label>
            <select value={namaMapel} onChange={(e) => setNamaMapel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
              <option value="">-- Pilih Mata Pelajaran --</option>
              {master.mapel.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Jurusan / Rumpun</label>
            <select value={jurusan} onChange={(e) => setJurusan(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
              <option value="">-- Pilih Jurusan --</option>
              {master.jurusan.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status Khusus <span className="text-gray-400 font-normal">(Opsional)</span></label>
            <select value={statusMapel} onChange={(e) => setStatusMapel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none">
              <option value="">-- Ikuti Kelas & Jurusan --</option>
              {master.status.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          <div className="md:col-span-4 flex justify-end mt-2">
            <button type="submit" disabled={loading} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg text-xs sm:text-sm disabled:opacity-50 transition-all shadow-sm">{loading ? 'Menyimpan...' : 'Tambah Mapel'}</button>
          </div>
        </form>
      </div>

      {/* TABEL DATA MAPEL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 text-xs sm:text-sm font-semibold">
                <th className="p-3 sm:p-4 w-12 sm:w-16 text-center">No.</th>
                <th className="p-3 sm:p-4 text-center">Kelas</th>
                <th className="p-3 sm:p-4">Nama Mata Pelajaran</th>
                <th className="p-3 sm:p-4 text-center">Jurusan</th>
                <th className="p-3 sm:p-4 text-center">Status Khusus</th>
                <th className="p-3 sm:p-4 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-900 text-xs sm:text-sm divide-y">
              {fetching ? (
                <tr><td colSpan={6} className="text-center p-8 text-gray-400">Memuat data...</td></tr>
              ) : listMapel.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-gray-400">Belum ada data mata pelajaran.</td></tr>
              ) : (
                listMapel.map((mapel, index) => (
                  <tr key={mapel.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 sm:p-4 text-center text-gray-500">{index + 1}</td>
                    <td className="p-3 sm:p-4 text-center font-bold text-blue-700">{mapel.kelas}</td>
                    <td className="p-3 sm:p-4 font-semibold">{mapel.nama_mapel}</td>
                    <td className="p-3 sm:p-4 text-center"><span className="bg-gray-100 text-gray-800 text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded">{mapel.jurusan}</span></td>
                    
                    <td className="p-3 sm:p-4 text-center">
                      {mapel.status_mapel ? (
                        <span className="text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                          {mapel.status_mapel}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs font-normal italic">- (Reguler)</span>
                      )}
                    </td>

                    <td className="p-3 sm:p-4 text-center">
                      <div className="flex justify-center items-center gap-1.5">
                        <button type="button" onClick={() => bukaModalEdit(mapel)} className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded border border-amber-200 text-xs font-bold transition-all">✏️ Edit</button>
                        {/* Hapus Mapel Langsung Tanpa Konfirmasi */}
                        <button type="button" onClick={() => handleHapusMapel(mapel.id, mapel.nama_mapel)} className="text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded border border-red-200 text-xs font-bold transition-all">🗑️ Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KELOLA MASTER (TAMBAH & HAPUS OPSI) */}
      {isMasterOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-sm w-full p-5 sm:p-6 space-y-4">
            
            <div className="flex justify-between items-center">
              <h3 className="text-sm sm:text-base font-black text-gray-900 capitalize">Kelola {tipeMaster === 'status' ? 'Status Khusus' : tipeMaster}</h3>
              <button onClick={() => setIsMasterOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">✕</button>
            </div>
            
            {/* Form Tambah */}
            <form onSubmit={handleTambahMasterBaru} className="space-y-2">
              <label className="block text-xs font-semibold text-gray-600">Tambah Opsi Baru</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inputMasterBaru} 
                  onChange={(e) => setInputMasterBaru(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" 
                  placeholder={tipeMaster === 'kelas' ? 'Cth: XII' : tipeMaster === 'jurusan' ? 'Cth: MM' : tipeMaster === 'status' ? 'Cth: AGAMA / PILIHAN' : 'Cth: Fisika'} 
                  required 
                />
                <button type="submit" disabled={loading} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap">
                  {loading ? '⏳' : 'Tambah'}
                </button>
              </div>
            </form>

            {/* List Data & Hapus Opsi Dropdown */}
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Daftar {tipeMaster === 'status' ? 'Status Khusus' : tipeMaster} Saat Ini:</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {master[tipeMaster].length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Belum ada data opsi.</p>
                ) : (
                  master[tipeMaster].map((item) => (
                    <div key={item} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100 group">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">{item}</span>
                      <button
                        type="button"
                        onClick={() => triggerKonfirmasiHapusMaster(item)}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title={`Hapus ${item}`}
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL EDIT DATA MAPEL */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-md w-full p-5 sm:p-6 space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">Ubah Data Mata Pelajaran</h3>
            <form onSubmit={handleSimpanEdit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kelas</label>
                <select value={editKelas} onChange={(e) => setEditKelas(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
                  {master.kelas.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Mata Pelajaran</label>
                <select value={editNama} onChange={(e) => setEditNama(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
                  {master.mapel.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Jurusan / Rumpun</label>
                <select value={editJurusan} onChange={(e) => setEditJurusan(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none" required>
                  {master.jurusan.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status Khusus <span className="text-gray-400 font-normal">(Opsional)</span></label>
                <select value={editStatusMapel} onChange={(e) => setEditStatusMapel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="">-- Ikuti Kelas & Jurusan --</option>
                  {master.status.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all">{loading ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP MODAL KONFIRMASI (DI TENGAH LAYAR) */}
      {modalKonfirmasi.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border max-w-sm w-full p-5 sm:p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">{modalKonfirmasi.judul}</h3>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{modalKonfirmasi.pesan}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalKonfirmasi({ isOpen: false, judul: '', pesan: '', tipeAksi: null })}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleJalankanAksiModal}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-xs shadow-sm transition-all"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}