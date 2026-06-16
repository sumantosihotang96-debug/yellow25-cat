'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx';

interface MapelDiampu {
  id: string;
  nama_mapel: string;
}

interface Soal {
  id: string;
  id_mapel: string;
  kelas_target: string;
  jurusan_target: string;
  pertanyaan: string;
  gambar_soal: string | null;
  opsi_a: string; gambar_a: string | null;
  opsi_b: string; gambar_b: string | null;
  opsi_c: string; gambar_c: string | null;
  opsi_d: string; gambar_d: string | null;
  opsi_e: string; gambar_e: string | null;
  jawaban_benar: string;
}

interface BannerNotif {
  tampilkan: boolean;
  pesan: string;
  tipe: 'sukses' | 'gagal';
}

export default function BankSoalLengkapPage() {
  const router = useRouter();
  const [mapelOptions, setMapelOptions] = useState<MapelDiampu[]>([]);
  const [mapelTerpilih, setMapelTerpilih] = useState('');
  const [namaMapelAktif, setNamaMapelAktif] = useState('');
  
  const [kelasTerpilih, setKelasTerpilih] = useState('X');
  const [jurusanTerpilih, setJurusanTerpilih] = useState('UMUM');
  
  const [listSoal, setListSoal] = useState<Soal[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // STATE: Mengontrol sembunyi/tampil form manual
  const [tampilkanFormManual, setTampilkanFormManual] = useState(false);

  const [idSoalDiedit, setIdSoalDiedit] = useState<string | null>(null);
  const [isiSoal, setIsiSoal] = useState('');
  const [gambarSoal, setGambarSoal] = useState<File | null>(null);
  const [previewSoal, setPreviewSoal] = useState('');

  const [opsiA, setOpsiA] = useState(''); const [gambarA, setGambarA] = useState<File | null>(null); const [previewA, setPreviewA] = useState('');
  const [opsiB, setOpsiB] = useState(''); const [gambarB, setGambarB] = useState<File | null>(null); const [previewB, setPreviewB] = useState('');
  const [opsiC, setOpsiC] = useState(''); const [gambarC, setGambarC] = useState<File | null>(null); const [previewC, setPreviewC] = useState('');
  const [opsiD, setOpsiD] = useState(''); const [gambarD, setGambarD] = useState<File | null>(null); const [previewD, setPreviewD] = useState('');
  const [opsiE, setOpsiE] = useState(''); const [gambarE, setGambarE] = useState<File | null>(null); const [previewE, setPreviewE] = useState('');

  const [jawabanBenar, setJawabanBenar] = useState('A');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [notif, setNotif] = useState<BannerNotif>({ tampilkan: false, pesan: '', tipe: 'sukses' });

  const picuNotifikasi = (pesan: string, tipe: 'sukses' | 'gagal' = 'sukses') => {
    setNotif({ tampilkan: true, pesan, tipe });
  };

  useEffect(() => {
    if (notif.tampilkan) {
      const timer = setTimeout(() => {
        setNotif((prev) => ({ ...prev, tampilkan: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notif.tampilkan]);

  // FUNGSI KOMPRESI GAMBAR (Target Luaran: Maksimal ~70 KB, Format JPEG)
  const kompresGambar = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 1000;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Gagal memuat Context Canvas'));
          
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(`Ukuran setelah kompresi: ${(blob.size / 1024).toFixed(2)} KB`);
                resolve(blob);
              } else {
                reject(new Error('Gagal kompresi blob'));
              }
            },
            'image/jpeg',
            0.65
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // 1. Ambil data mapel unik milik guru
  useEffect(() => {
    const ambilMapelOtomatis = async () => {
      try {
        if (typeof window !== 'undefined') {
          const idGuru = localStorage.getItem('session_guru_id');
          if (!idGuru) { router.push('/login'); return; }

          const { data, error } = await supabase
            .from('guru_mapel')
            .select('mapel_id, mapel(id, nama_mapel)')
            .eq('guru_id', idGuru);

          if (error) throw error;

          if (data) {
            const mapelUnik: MapelDiampu[] = [];
            const namaSajaSet = new Set();
            data.forEach((item: any) => {
              if (item.mapel) {
                const namaBersih = item.mapel.nama_mapel.trim();
                if (!namaSajaSet.has(namaBersih.toLowerCase())) {
                  namaSajaSet.add(namaBersih.toLowerCase());
                  mapelUnik.push({ id: item.mapel.id, nama_mapel: namaBersih });
                }
              }
            });
            setMapelOptions(mapelUnik);
            if (mapelUnik.length > 0) {
              setMapelTerpilih(mapelUnik[0].id);
              setNamaMapelAktif(mapelUnik[0].nama_mapel);
            }
          }
        }
      } catch (err) { 
        console.error('Gagal mengambil data mapel guru:', err); 
      } finally { 
        setFetching(false); 
      }
    };
    ambilMapelOtomatis();
  }, [router]);

  // 2. Ambil list soal dari database
  const muatDaftarSoal = async () => {
    if (!mapelTerpilih || mapelTerpilih === '') {
      setListSoal([]);
      return;
    }
    setLoadingList(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('soal')
        .select('*')
        .eq('id_mapel', mapelTerpilih)
        .eq('kelas_target', kelasTerpilih)
        .eq('jurusan_target', jurusanTerpilih.toUpperCase().trim())
        .order('id', { ascending: false });

      if (supabaseError) {
        picuNotifikasi(`Gagal mengambil daftar soal: ${supabaseError.message}`, 'gagal');
        return;
      }
      setListSoal(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (mapelTerpilih && mapelTerpilih !== '') {
      muatDaftarSoal();
    }
  }, [mapelTerpilih, kelasTerpilih, jurusanTerpilih]);

  const handleMapelChange = (id: string) => {
    setMapelTerpilih(id);
    const m = mapelOptions.find(o => o.id === id);
    if (m) setNamaMapelAktif(m.nama_mapel);
  };

  // UNDUH TEMPLATE EXCEL
  const handleUnduhTemplate = () => {
    if (!mapelTerpilih) return picuNotifikasi('Pilih mapel dulu.', 'gagal');
    const dataTemplate = [{
      'PERTANYAAN SOAL': 'Contoh Soal...',
      'OPSI A': 'A', 'OPSI B': 'B', 'OPSI C': 'C', 'OPSI D': 'D', 'OPSI E': 'E',
      'KUNCI JAWABAN (A/B/C/D/E)': 'A'
    }];
    const worksheet = XLSX.utils.json_to_sheet(dataTemplate);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, `Template_${namaMapelAktif.replace(/\s+/g, '_')}.xlsx`);
  };

  // IMPORT FILE EXCEL
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapelTerpilih) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const barisData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (barisData.length === 0) return picuNotifikasi('File Excel kosong.', 'gagal');

        const paketSoal = barisData.map((row: any) => ({
          id_mapel: mapelTerpilih, kelas_target: kelasTerpilih, jurusan_target: jurusanTerpilih.toUpperCase().trim(),
          pertanyaan: row['PERTANYAAN SOAL'] || '',
          opsi_a: row['OPSI A'] || '', opsi_b: row['OPSI B'] || '', opsi_c: row['OPSI C'] || '', opsi_d: row['OPSI D'] || '', opsi_e: row['OPSI E'] || '',
          jawaban_benar: (row['KUNCI JAWABAN (A/B/C/D/E)'] || 'A').toUpperCase().trim(),
          gambar_soal: null, gambar_a: null, gambar_b: null, gambar_c: null, gambar_d: null, gambar_e: null
        }));

        const { error } = await supabase.from('soal').insert(paketSoal);
        if (error) throw error;
        picuNotifikasi('🎉 Berhasil mengimpor soal!');
        muatDaftarSoal();
      } catch (err: any) { 
        picuNotifikasi(`Gagal: ${err.message}`, 'gagal'); 
      } finally { 
        setImporting(false); e.target.value = ''; 
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileChange = (file: File | undefined, setFile: (f: File | null) => void, setPreview: (s: string) => void) => {
    if (file) { 
      setFile(file); 
      setPreview(URL.createObjectURL(file)); 
    }
  };

  // UPLOAD STORAGE DENGAN SYSTEM AUTO COMPRESS KECIL (~70 KB)
  const uploadKeStorage = async (file: File | null, prefix: string, currentPreviewUrl: string): Promise<string | null> => {
    if (!file) {
      return currentPreviewUrl.startsWith('http') ? currentPreviewUrl : null;
    }
    
    try {
      const blobKompresi = await kompresGambar(file);
      const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      const { error } = await supabase.storage
        .from('soal-images')
        .upload(fileName, blobKompresi, { contentType: 'image/jpeg' });
        
      if (error) throw error;

      const { data } = supabase.storage.from('soal-images').getPublicUrl(fileName);
      return data.publicUrl || null;
    } catch (err) {
      console.error('Gagal Upload & Kompresi:', err);
      return null;
    }
  };

  const bersihkanForm = () => {
    setIdSoalDiedit(null);
    setIsiSoal(''); setOpsiA(''); setOpsiB(''); setOpsiC(''); setOpsiD(''); setOpsiE('');
    setGambarSoal(null); setGambarA(null); setGambarB(null); setGambarC(null); setGambarD(null); setGambarE(null);
    setPreviewSoal(''); setPreviewA(''); setPreviewB(''); setPreviewC(''); setPreviewD(''); setPreviewE('');
    setJawabanBenar('A');
  };

  const aksiPicuTambahManualBaru = () => {
    bersihkanForm();
    setTampilkanFormManual(true);
    setTimeout(() => {
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }, 100);
  };

  // SIMPAN INPUT MANUAL & UPDATE DATA (Satu Fungsi Dua Kegunaan)
  const handleSimpanSoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapelTerpilih || !isiSoal) return;
    setLoading(true);

    try {
      const urlGambarSoal = await uploadKeStorage(gambarSoal, 'soal', previewSoal);
      const urlGambarA = await uploadKeStorage(gambarA, 'opsiA', previewA);
      const urlGambarB = await uploadKeStorage(gambarB, 'opsiB', previewB);
      const urlGambarC = await uploadKeStorage(gambarC, 'opsiC', previewC);
      const urlGambarD = await uploadKeStorage(gambarD, 'opsiD', previewD);
      const urlGambarE = await uploadKeStorage(gambarE, 'opsiE', previewE);

      const payloadData = {
        id_mapel: mapelTerpilih, kelas_target: kelasTerpilih, jurusan_target: jurusanTerpilih.toUpperCase().trim(),
        pertanyaan: isiSoal, gambar_soal: urlGambarSoal,
        opsi_a: opsiA, gambar_a: urlGambarA, opsi_b: opsiB, gambar_b: urlGambarB,
        opsi_c: opsiC, gambar_c: urlGambarC, opsi_d: opsiD, gambar_d: urlGambarD,
        opsi_e: opsiE, gambar_e: urlGambarE, jawaban_benar: jawabanBenar
      };

      if (idSoalDiedit) {
        const { error } = await supabase.from('soal').update(payloadData).eq('id', idSoalDiedit);
        if (error) throw error;
        picuNotifikasi('🎉 Soal & Gambar Berhasil Diperbarui!');
      } else {
        const { error } = await supabase.from('soal').insert([payloadData]);
        if (error) throw error;
        picuNotifikasi('🎉 Soal Baru Berhasil Disimpan!');
      }

      bersihkanForm();
      setTampilkanFormManual(false); 
      muatDaftarSoal();
    } catch (error: any) { 
      picuNotifikasi(`❌ Gagal: ${error.message}`, 'gagal'); 
    } finally { 
      setLoading(false); 
    }
  };

  const aksiPilihEditSoal = (soal: Soal) => {
    setTampilkanFormManual(true); 
    setIdSoalDiedit(soal.id);
    setIsiSoal(soal.pertanyaan);
    setPreviewSoal(soal.gambar_soal || '');
    setOpsiA(soal.opsi_a); setPreviewA(soal.gambar_a || '');
    setOpsiB(soal.opsi_b); setPreviewB(soal.gambar_b || '');
    setOpsiC(soal.opsi_c); setPreviewC(soal.gambar_c || '');
    setOpsiD(soal.opsi_d); setPreviewD(soal.gambar_d || '');
    setOpsiE(soal.opsi_e || ''); setPreviewE(soal.gambar_e || '');
    setJawabanBenar(soal.jawaban_benar);
    
    setTimeout(() => {
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }, 100);
  };

  const aksiHapusSoal = async (id: string) => {
    const konfirmasi = confirm('Apakah Anda yakin ingin menghapus butir soal ini?');
    if (!konfirmasi) return;

    try {
      const { error } = await supabase.from('soal').delete().eq('id', id);
      if (error) throw error;
      picuNotifikasi('🗑️ Soal berhasil dihapus!');
      if (idSoalDiedit === id) bersihkanForm();
      muatDaftarSoal();
    } catch (error: any) {
      picuNotifikasi(`❌ Gagal: ${error.message}`, 'gagal');
    }
  };

  const aksiHapusSemuaSoal = async () => {
    if (listSoal.length === 0) {
      alert('Tidak ada data soal yang bisa dihapus pada filter ini.');
      return;
    }

    const konfirmasi1 = confirm(`⚠️ PERINGATAN: Anda akan menghapus ALL / SEMUA (${listSoal.length}) soal untuk mata pelajaran "${namaMapelAktif}" Kelas ${kelasTerpilih} - ${jurusanTerpilih}.\n\nApakah Anda yakin?`);
    if (!konfirmasi1) return;

    const konfirmasi2 = confirm('Tindakan ini tidak bisa dibatalkan! Ketik "OK" jika Anda benar-benar yakin ingin membersihkan data.');
    if (!konfirmasi2) return;

    setLoadingList(true);
    try {
      const { error } = await supabase
        .from('soal')
        .delete()
        .eq('id_mapel', mapelTerpilih)
        .eq('kelas_target', kelasTerpilih)
        .eq('jurusan_target', jurusanTerpilih.toUpperCase().trim());

      if (error) throw error;

      picuNotifikasi(`🗑️ Sukses menghapus ${listSoal.length} data soal!`);
      bersihkanForm();
      muatDaftarSoal();
    } catch (error: any) {
      picuNotifikasi(`❌ Gagal menghapus massal: ${error.message}`, 'gagal');
      setLoadingList(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 relative">
      
      {/* NOTIFIKASI BANNER */}
      {notif.tampilkan && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-xl flex items-center justify-between gap-4 max-w-sm border ${
          notif.tipe === 'sukses' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          <div className="text-xs font-bold">{notif.pesan}</div>
          <button onClick={() => setNotif((prev) => ({ ...prev, tampilkan: false }))} className="text-xs font-black opacity-50 px-1">✕</button>
        </div>
      )}
      
      {/* 1. FILTER */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h1 className="text-xl font-black text-gray-900">Pusat Bank Soal Guru</h1>
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-bold text-gray-800">
          <div>
            <label className="block text-xs text-blue-900 mb-1">Mata Pelajaran</label>
            {fetching ? <div className="text-xs text-gray-400">Loading...</div> : (
              <select value={mapelTerpilih} onChange={(e) => handleMapelChange(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white outline-none">
                {mapelOptions.map((m) => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
              </select>
            )}
          </div>
          <div><label className="block text-xs text-blue-900 mb-1">Target Kelas</label>
            <select value={kelasTerpilih} onChange={(e) => setKelasTerpilih(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white outline-none">
              <option value="X">Kelas X</option><option value="XI">Kelas XI</option><option value="XII">Kelas XII</option>
            </select>
          </div>
          <div><label className="block text-xs text-blue-900 mb-1">Target Jurusan</label>
            <input type="text" required value={jurusanTerpilih} onChange={(e) => setJurusanTerpilih(e.target.value)} className="w-full p-2.5 border rounded-xl bg-white outline-none uppercase" />
          </div>
        </div>
      </div>

      {/* 2. EXCEL */}
      <div className="bg-amber-50/40 p-6 rounded-2xl border border-amber-200/70 space-y-4">
        <h2 className="text-sm font-black text-amber-900 uppercase tracking-wider">📥 Metode A: Import Massal dari Excel</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handleUnduhTemplate} className="bg-white hover:bg-gray-50 text-gray-700 font-bold px-4 py-2.5 rounded-xl text-xs border border-gray-300 shadow-sm">📋 Unduh Template Excel</button>
          <div className="flex-1 relative flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-sm p-2.5 cursor-pointer">
            <span>{importing ? '⏳ Mengurai file...' : '🚀 Pilih & Import Excel'}</span>
            <input type="file" accept=".xlsx, .xls" disabled={importing} onChange={handleImportExcel} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
        </div>
      </div>

      {/* 3. FORM INPUT/EDIT MANUNGGAL */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="w-full p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/70 border-b border-gray-100 gap-3">
          <h2 className="text-sm font-black text-blue-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
            {idSoalDiedit ? '📝 MODE EDIT: Mengubah Soal' : '✍️ Metode B: Isian Manual'}
            {idSoalDiedit && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Lagi Mengedit</span>}
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {idSoalDiedit && (
              <button 
                type="button" 
                onClick={aksiPicuTambahManualBaru} 
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-sm transition"
              >
                ➕ Buat Soal Baru
              </button>
            )}
            <button 
              type="button"
              onClick={() => setTampilkanFormManual(!tampilkanFormManual)}
              className="text-sm font-bold text-gray-500 bg-white border px-3 py-1.5 rounded-xl shadow-sm hover:bg-gray-50"
            >
              {tampilkanFormManual ? '🔼 Sembunyikan' : '🔽 Buka Formulir'}
            </button>
          </div>
        </div>
        
        {tampilkanFormManual && (
          <form onSubmit={handleSimpanSoal} className="p-6 space-y-6 text-sm">
            <div className="flex justify-between items-center bg-blue-50/40 p-3 rounded-xl border border-blue-100">
              <span className="text-xs text-blue-800 font-bold">
                {idSoalDiedit ? 'Perubahan pada formulir ini akan memperbarui butir soal di database.' : 'Isi formulir ini untuk menambah satu butir soal baru.'}
              </span>
              {idSoalDiedit && (
                <button type="button" onClick={() => { bersihkanForm(); setTampilkanFormManual(false); }} className="text-xs bg-red-100 hover:bg-red-200 font-bold px-3 py-1 rounded-lg text-red-700">Batal / Tutup</button>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase">1. Lembar Isian Pertanyaan</label>
              <textarea rows={5} value={isiSoal} onChange={(e) => setIsiSoal(e.target.value)} className="w-full p-3 border rounded-xl outline-none text-base" placeholder="Tulis soal secara lengkap disini..." required />
              <div className="p-3 bg-gray-50 rounded-xl border flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-600">Upload Gambar Soal:</span>
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0], setGambarSoal, setPreviewSoal)} />
              </div>
              {previewSoal && <div className="p-2 border rounded-xl flex justify-center bg-gray-50 relative">
                <img src={previewSoal} className="h-48 object-contain" />
                <button type="button" onClick={() => setPreviewSoal('')} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-md text-[10px] font-bold">Hapus Gambar</button>
              </div>}
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase">2. Opsi Pilihan & Gambar (Maks 70KB)</label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opsi A */}
                <div className="p-3 bg-gray-50/50 border rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-blue-600">OPSI JAWABAN A</span><input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0], setGambarA, setPreviewA)} className="text-[10px] max-w-[150px]" /></div>
                    <input type="text" value={opsiA} onChange={(e) => setOpsiA(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white outline-none" required />
                  </div>
                  {previewA && <div className="relative inline-block mt-2"><img src={previewA} className="h-20 object-contain rounded border bg-white" /><button type="button" onClick={() => setPreviewA('')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded p-0.5 text-[8px]">X</button></div>}
                </div>

                {/* Opsi B */}
                <div className="p-3 bg-gray-50/50 border rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-blue-600">OPSI JAWABAN B</span><input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0], setGambarB, setPreviewB)} className="text-[10px] max-w-[150px]" /></div>
                    <input type="text" value={opsiB} onChange={(e) => setOpsiB(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white outline-none" required />
                  </div>
                  {previewB && <div className="relative inline-block mt-2"><img src={previewB} className="h-20 object-contain rounded border bg-white" /><button type="button" onClick={() => setPreviewB('')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded p-0.5 text-[8px]">X</button></div>}
                </div>

                {/* Opsi C */}
                <div className="p-3 bg-gray-50/50 border rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-blue-600">OPSI JAWABAN C</span><input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0], setGambarC, setPreviewC)} className="text-[10px] max-w-[150px]" /></div>
                    <input type="text" value={opsiC} onChange={(e) => setOpsiC(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white outline-none" required />
                  </div>
                  {previewC && <div className="relative inline-block mt-2"><img src={previewC} className="h-20 object-contain rounded border bg-white" /><button type="button" onClick={() => setPreviewC('')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded p-0.5 text-[8px]">X</button></div>}
                </div>

                {/* Opsi D */}
                <div className="p-3 bg-gray-50/50 border rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-blue-600">OPSI JAWABAN D</span><input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0], setGambarD, setPreviewD)} className="text-[10px] max-w-[150px]" /></div>
                    <input type="text" value={opsiD} onChange={(e) => setOpsiD(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white outline-none" required />
                  </div>
                  {previewD && <div className="relative inline-block mt-2"><img src={previewD} className="h-20 object-contain rounded border bg-white" /><button type="button" onClick={() => setPreviewD('')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded p-0.5 text-[8px]">X</button></div>}
                </div>

                {/* Opsi E */}
                <div className="p-3 bg-gray-50/50 border rounded-xl space-y-2 flex flex-col justify-between md:col-span-2">
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-blue-600">OPSI JAWABAN E</span><input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0], setGambarE, setPreviewE)} className="text-[10px] max-w-[150px]" /></div>
                    <input type="text" value={opsiE} onChange={(e) => setOpsiE(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white outline-none" required />
                  </div>
                  {previewE && <div className="relative inline-block mt-2"><img src={previewE} className="h-20 object-contain rounded border bg-white" /><button type="button" onClick={() => setPreviewE('')} className="absolute -top-1 -right-1 bg-red-600 text-white rounded p-0.5 text-[8px]">X</button></div>}
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border rounded-xl flex items-center justify-between">
              <span className="font-bold text-emerald-900 text-xs">3. KUNCI JAWABAN BENAR</span>
              <select value={jawabanBenar} onChange={(e) => setJawabanBenar(e.target.value)} className="p-2 border border-emerald-300 rounded-lg font-extrabold text-emerald-700 outline-none bg-white w-24 text-center">
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option>
              </select>
            </div>

            <div className="flex justify-end shadow-sm pt-2">
              <button 
                type="submit" 
                disabled={loading} 
                className={`w-full text-white px-10 py-3.5 rounded-xl font-bold text-sm uppercase shadow-md transition duration-200 ${
                  idSoalDiedit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {loading 
                  ? '⏳ Memproses & Mengompres Gambar...' 
                  : idSoalDiedit 
                    ? 'Simpan Pembaruan Soal' 
                    : 'Simpan Sebagai Soal Baru'
                }
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4. DAFTAR SOAL */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">📋 Daftar Soal Saat Ini</h2>
          
          {listSoal.length > 0 && (
            <button
              type="button"
              onClick={aksiHapusSemuaSoal}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition duration-200 flex items-center gap-1 shadow-sm"
            >
              🗑️ Kosongkan Semua Soal ({listSoal.length})
            </button>
          )}
        </div>

        {loadingList ? (
          <div className="text-center py-6 text-xs text-gray-400">Memuat butir soal...</div>
        ) : listSoal.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 border border-dashed rounded-xl bg-gray-50/50">Belum ada data soal pada filter pelajaran ini.</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto pr-2">
            {listSoal.map((soal, index) => (
              <div key={soal.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-6 text-sm">
                <div className="space-y-2 flex-1">
                  <div className="font-medium text-gray-900 leading-relaxed">
                    <span className="text-blue-600 font-bold mr-2">No. {listSoal.length - index}</span> 
                    {soal.pertanyaan}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${soal.gambar_soal ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400'}`}>
                      {soal.gambar_soal ? '🖼️ Ada Gambar Soal' : '❌ Tanpa Gambar Soal'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${soal.gambar_a || soal.gambar_b || soal.gambar_c || soal.gambar_d || soal.gambar_e ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-gray-100 text-gray-400'}`}>
                      {soal.gambar_a || soal.gambar_b || soal.gambar_c || soal.gambar_d || soal.gambar_e ? '🎨 Opsi Bergambar' : '📝 Opsi Polos'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                      Kunci: {soal.jawaban_benar}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 whitespace-nowrap">
                  <button type="button" onClick={() => aksiPilihEditSoal(soal)} className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold px-3 py-2 rounded-xl text-xs">⚙️ Edit</button>
                  <button type="button" onClick={() => aksiHapusSoal(soal.id)} className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 font-bold px-3 py-2 rounded-xl text-xs">🗑️ Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}