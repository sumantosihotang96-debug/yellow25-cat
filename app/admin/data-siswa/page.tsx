'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx';

interface Siswa {
  id: string;
  nama_lengkap: string;
  nomor_induk: string; // NISN siswa
  kelas: string;
  email: string;
  password?: string; // Masukkan password ke dalam interface
  created_at: string;
}

export default function DataSiswaPage() {
  const [listSiswa, setListSiswa] = useState<Siswa[]>([]);
  
  // Opsi pilihan dinamis dari tabel mapel
  const [listTingkatKelas, setListTingkatKelas] = useState<string[]>([]);
  const [listJurusan, setListJurusan] = useState<string[]>([]);
  
  // State Input Form Utama
  const [namaLengkap, setNamaLengkap] = useState('');
  const [nisn, setNisn] = useState('');
  const [tingkatKelas, setTingkatKelas] = useState('');
  const [jurusan, setJurusan] = useState('');
  const [nomorKelas, setNomorKelas] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State untuk melacak data yang sedang diedit
  const [editId, setEditId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Fitur Intip Kata Sandi
  const [showPassword, setShowPassword] = useState(false);

  // State Manajemen Banner Notifikasi Layang
  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  // State untuk Pagination (Membatasi dan menggeser data)
  const [barisTampil, setBarisTampil] = useState<number>(10);
  const [halamanAktif, setHalamanAktif] = useState<number>(1);

  // Otomatis menghilangkan banner notifikasi dalam 3 detik
  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  // Reset ke halaman 1 jika user mengubah jumlah limit baris
  useEffect(() => {
    setHalamanAktif(1);
  }, [barisTampil]);

  // Ambil Data Pengguna Termasuk Kolom 'password'
  const fetchSiswa = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, nomor_induk, kelas, email, password, created_at')
      .eq('role', 'siswa')
      .order('kelas', { ascending: true })
      .order('nama_lengkap', { ascending: true });

    if (!error && data) {
      setListSiswa(data as Siswa[]);
    }
    setFetching(false);
  };

  // AMBIL KELAS & JURUSAN SEKALIGUS DARI TABEL MAPEL
  const fetchOpsiRombelDariMapel = async () => {
    try {
      const { data, error } = await supabase
        .from('mapel')
        .select('kelas, jurusan');

      if (!error && data) {
        // 1. Filter & dapatkan Kelas unik
        const semuaKelas = data
          .map((item) => item.kelas?.trim().toUpperCase())
          .filter((k): k is string => !!k);
        const kelasUnik = Array.from(new Set(semuaKelas)).sort();
        setListTingkatKelas(kelasUnik);

        // 2. Filter & dapatkan Jurusan unik
        const semuaJurusan = data
          .map((item) => item.jurusan?.trim().toUpperCase())
          .filter((j): j is string => !!j);
        const jurusanUnik = Array.from(new Set(semuaJurusan)).sort();
        setListJurusan(jurusanUnik);
      }
    } catch (err) {
      console.error('Gagal mengambil konfigurasi rombel dari mapel:', err);
    }
  };

  useEffect(() => {
    fetchSiswa();
    fetchOpsiRombelDariMapel();
  }, []);

  // Fungsi untuk Mengunduh Template Excel Otomatis
  const handleUnduhTemplate = () => {
    const strukturTemplate = [
      {
        nama: 'Budi Santoso',
        nisn: '0054321098',
        kelas: 'X TKJ 1', // Diperbarui menggunakan spasi di template agar sinkron
        email: 'budi@siswa.sch.id',
        password: '123'
      },
      {
        nama: 'Siti Aminah',
        nisn: '0065432109',
        kelas: 'XI RPL 2', // Diperbarui menggunakan spasi di template agar sinkron
        email: 'siti@siswa.sch.id',
        password: 'passwordku123'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(strukturTemplate);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');
    XLSX.writeFile(workbook, 'template_import_siswa.xlsx');
  };

  // Fungsi Simpan (Bisa Tambah Baru atau Perbarui Data yang Ada)
  const handleSimpanForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaLengkap || !nisn || !tingkatKelas || !jurusan || !nomorKelas || !email || !password) {
      setNotifikasi({ pesan: '⚠️ Mohon lengkapi seluruh field data termasuk kata sandi.', tipe: 'gagal' });
      return;
    }
    setLoading(true);

    // BARU: Menggabungkan komponen rombel menggunakan spasi ' ' bukan lagi '-'
    const kelasGabungan = `${tingkatKelas} ${jurusan.toUpperCase()} ${nomorKelas}`;

    try {
      if (editId) {
        const updateData: any = {
          nama_lengkap: namaLengkap,
          nomor_induk: nisn,
          kelas: kelasGabungan,
          email: email,
          password: password,
        };

        const { error: updateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', editId);

        if (updateError) throw updateError;
        setNotifikasi({ pesan: `🎉 Berhasil memperbarui data siswa ${namaLengkap}.`, tipe: 'sukses' });

      } else {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: crypto.randomUUID(),
              nama_lengkap: namaLengkap,
              nomor_induk: nisn,
              kelas: kelasGabungan,
              email: email,
              password: password,
              role: 'siswa',
            },
          ]);

        if (insertError) throw insertError;
        setNotifikasi({ pesan: `🎉 Sukses! Siswa bernama ${namaLengkap} berhasil disimpan.`, tipe: 'sukses' });
      }

      resetForm();
      fetchSiswa();
    } catch (error: any) {
      setNotifikasi({ pesan: '❌ Gagal menyimpan data: ' + error.message, tipe: 'gagal' });
    } finally {
      setLoading(false);
    }
  };

  // Masukkan data siswa ke dalam State saat Edit dipicu
  const pemicuEdit = async (siswa: Siswa) => {
    setEditId(siswa.id);
    setNamaLengkap(siswa.nama_lengkap);
    setNisn(siswa.nomor_induk);
    setEmail(siswa.email);
    setPassword(siswa.password || '');

    // BARU: Memecah string berdasarkan spasi untuk dikembalikan ke input pilihan form
    const bagianKelas = siswa.kelas.split(' ');
    if (bagianKelas.length === 3) {
      setTingkatKelas(bagianKelas[0].toUpperCase());
      setJurusan(bagianKelas[1].toUpperCase());
      setNomorKelas(bagianKelas[2]);
    } else {
      setTingkatKelas('');
      setJurusan(siswa.kelas.toUpperCase());
      setNomorKelas('');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fungsi hapus data siswa satuan
  const handleHapusSiswa = async (id: string, nama: string) => {
    const konfirmasi = window.confirm(`Apakah Anda yakin ingin menghapus permanen akun siswa: ${nama}?`);
    if (!konfirmasi) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifikasi({ pesan: `🗑️ Akun siswa bernama ${nama} berhasil dihapus dari sistem.`, tipe: 'sukses' });
      if (editId === id) resetForm();
      fetchSiswa();
    } catch (error: any) {
      setNotifikasi({ pesan: '❌ Gagal menghapus siswa: ' + error.message, tipe: 'gagal' });
    }
  };

  // BARU: Fungsi Hapus Semua Siswa Sekaligus (Reset Cepat)
  const handleHapusSemuaSiswa = async () => {
    if (listSiswa.length === 0) {
      setNotifikasi({ pesan: '⚠️ Tidak ada data siswa yang bisa dihapus.', tipe: 'gagal' });
      return;
    }

    const konfirmasi1 = window.confirm('❗ PERINGATAN KRITIS: Apakah Anda yakin ingin MENGHAPUS SEMUA DATA SISWA yang ada di database? Tindakan ini tidak bisa dibatalkan.');
    if (!konfirmasi1) return;

    const konfirmasi2 = window.confirm('Sekali lagi, ketuk OK jika Anda benar-benar ingin mengosongkan seluruh akun siswa saat ini.');
    if (!konfirmasi2) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('role', 'siswa'); // Mengunci guard agar data guru/admin tidak ikut terhapus

      if (error) throw error;

      setNotifikasi({ pesan: '💥 Sukses Besar! Seluruh data akun peserta ujian telah dibersihkan.', tipe: 'sukses' });
      resetForm();
      fetchSiswa();
    } catch (error: any) {
      setNotifikasi({ pesan: '❌ Gagal mengosongkan data siswa: ' + error.message, tipe: 'gagal' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setNamaLengkap('');
    setNisn('');
    setTingkatKelas('');
    setJurusan('');
    setNomorKelas('');
    setEmail('');
    setPassword('');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        if (rawData.length === 0) {
          setNotifikasi({ pesan: '⚠️ File Excel kosong atau format tidak sesuai.', tipe: 'gagal' });
          setUploading(false);
          return;
        }

        const dataBulkInsert = [];
        let gagalCount = 0;

        for (const baris of rawData) {
          const barisNormal: any = {};
          Object.keys(baris).forEach((key) => {
            barisNormal[key.toLowerCase().trim()] = baris[key];
          });

          const namaSiswa = barisNormal['nama'];
          const nisnSiswa = barisNormal['nisn'];
          const kelasSiswa = barisNormal['kelas'];
          const emailSiswa = barisNormal['email'];
          const passSiswa = barisNormal['password'];

          if (!namaSiswa || !nisnSiswa || !kelasSiswa || !emailSiswa || !passSiswa) {
            gagalCount++;
            continue;
          }

          dataBulkInsert.push({
            id: crypto.randomUUID(),
            nama_lengkap: String(namaSiswa).trim(),
            nomor_induk: String(nisnSiswa).trim(),
            kelas: String(kelasSiswa).trim().toUpperCase(), // Mengikuti format input excel user
            email: String(emailSiswa).trim(),
            password: String(passSiswa).trim(),
            role: 'siswa',
          });
        }

        if (dataBulkInsert.length > 0) {
          const { error: bulkError } = await supabase
            .from('profiles')
            .insert(dataBulkInsert);

          if (bulkError) throw bulkError;

          setNotifikasi({ 
            pesan: `📊 Impor Selesai! Berhasil menyimpan ${dataBulkInsert.length} siswa. (Gagal/Skip: ${gagalCount} baris).`, 
            tipe: 'sukses' 
          });
        } else {
          setNotifikasi({ pesan: '⚠️ Tidak ada data valid yang bisa diimpor. Cek format header template Anda.', tipe: 'gagal' });
        }

        fetchSiswa();
      } catch (error: any) {
        setNotifikasi({ pesan: '❌ Gagal memproses file Excel: ' + error.message, tipe: 'gagal' });
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // Hitung indeks pemotongan array listSiswa untuk Pagination
  const totalHalaman = Math.ceil(listSiswa.length / barisTampil) || 1;
  const indeksAwal = (halamanAktif - 1) * barisTampil;
  const indeksAkhir = indeksAwal + barisTampil;
  
  const siswaYangDitampilkan = listSiswa.slice(indeksAwal, indeksAkhir);

  return (
    <div className="space-y-8 relative">
      
      {notifikasi && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-lg border transition-all duration-300 max-w-md ${
          notifikasi.tipe === 'sukses' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="text-sm font-semibold">{notifikasi.pesan}</div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Master Siswa</h1>
        <p className="text-gray-500 text-sm">Kelola pendaftaran akun ujian siswa secara langsung ke database murni tanpa batasan sistem Auth.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-gray-800">
              {editId ? '📝 Edit Data Siswa' : 'Input Siswa Manual'}
            </h2>
            {editId && (
              <button 
                type="button" 
                onClick={resetForm} 
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-md font-medium"
              >
                Batal Edit
              </button>
            )}
          </div>
          
          <form onSubmit={handleSimpanForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Lengkap Siswa</label>
              <input type="text" value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium" placeholder="Budi Santoso" required />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">NISN (Nomor Induk Siswa Nasional)</label>
              <input type="text" value={nisn} onChange={(e) => setNisn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium" placeholder="0054321098" required />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Konfigurasi Rombel / Kelas & Jurusan</label>
              <div className="grid grid-cols-3 gap-2">
                
                <select 
                  value={tingkatKelas} 
                  onChange={(e) => setTingkatKelas(e.target.value)} 
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium uppercase"
                  required
                >
                  <option value="">Kelas</option>
                  {listTingkatKelas.length === 0 ? (
                    <option disabled className="italic text-gray-400">Memuat kelas...</option>
                  ) : (
                    listTingkatKelas.map((kItem) => (
                      <option key={kItem} value={kItem} className="text-gray-950">
                        {kItem}
                      </option>
                    ))
                  )}
                </select>

                <select
                  value={jurusan}
                  onChange={(e) => setJurusan(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium uppercase"
                  required
                >
                  <option value="">Jurusan</option>
                  {listJurusan.length === 0 ? (
                    <option disabled className="italic text-gray-400">Memuat jurusan...</option>
                  ) : (
                    listJurusan.map((juer) => (
                      <option key={juer} value={juer} className="text-gray-950">
                        {juer}
                      </option>
                    ))
                  )}
                </select>

                <input type="number" value={nomorKelas} onChange={(e) => setNomorKelas(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium" placeholder="Nomor Sub" min="1" required />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Siswa</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium" placeholder="budi@siswa.sch.id" required />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Kata Sandi Akun Siswa {editId && <span className="text-blue-600 text-[11px] font-bold">(Password lama ditampilkan, silakan edit jika ingin mengubah)</span>}
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 bg-white font-medium pr-10" 
                  placeholder="Masukkan kata sandi (contoh: 123)" 
                  required 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" disabled={loading} className={`text-white font-medium px-6 py-2 rounded-lg text-sm transition-all shadow-sm w-full md:w-auto ${editId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {loading ? 'Memproses...' : editId ? 'Perbarui Data Siswa' : 'Simpan Siswa Baru'}
              </button>
            </div>
          </form>
        </div>

        {/* Unggah Massal Excel */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-6 rounded-xl border border-gray-200/60 shadow-sm flex flex-col justify-between h-full min-h-[300px]">
          <div>
            <div className="flex justify-between items-start gap-2">
              <h2 className="text-base font-bold text-green-800 flex items-center gap-2">🟢 Unggah Massal (Excel)</h2>
              
              <button
                type="button"
                onClick={handleUnduhTemplate}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-all flex items-center gap-1 shrink-0 shadow-sm"
              >
                📥 Unduh Template
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Daftarkan ratusan siswa dalam hitungan detik. Pastikan file Excel Anda menggunakan header kolom persis berikut: <br />
              <strong className="text-gray-700 font-mono text-[11px]">nama | nisn | kelas | email | password</strong>
            </p>
          </div>
          
          <div className="mt-4">
            <label className={`w-full flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-center cursor-pointer hover:border-green-500 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-2xl mb-1">📊</span>
              <span className="text-xs font-bold text-gray-700">{uploading ? 'Sedang Memproses Excel...' : 'Pilih / Seret File Excel'}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">Format file .xlsx / .xls</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" disabled={uploading} />
            </label>
          </div>
        </div>
      </div>

      {/* TABEL DATA SISWA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        <div className="p-4 bg-gray-50/60 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3-wrap">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-gray-700">Daftar Akun Peserta Ujian</h3>
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md">
                Menampilkan {indeksAwal + 1}-{Math.min(indeksAkhir, listSiswa.length)} dari {listSiswa.length} Siswa
              </span>
            </div>
            
            {/* BARU: Tombol Reset / Hapus Semua Data Siswa Cepat */}
            {listSiswa.length > 0 && (
              <button
                type="button"
                disabled={loading || fetching}
                onClick={handleHapusSemuaSiswa}
                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 ml-2"
              >
                💥 Hapus Semua Data Siswa
              </button>
            )}
          </div>
          
          {/* Dropdown Pilihan Limit Data */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">Tampilkan data:</label>
            <select
              value={barisTampil}
              onChange={(e) => setBarisTampil(Number(e.target.value))}
              className="text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
            >
              <option value={10}>10 Baris</option>
              <option value={20}>20 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value={listSiswa.length || 500}>Semua Data</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm font-semibold">
                <th className="p-4 w-16">No.</th>
                <th className="p-4 w-28">Kelas</th>
                <th className="p-4">Nama Lengkap</th>
                <th className="p-4 w-36">NISN</th>
                <th className="p-4">Email Akun</th>
                <th className="p-4 w-40 text-center">Tindakan Admin</th>
              </tr>
            </thead>
            <tbody className="text-gray-950 text-sm divide-y divide-gray-50">
              {fetching ? (
                <tr><td colSpan={6} className="text-center p-8 text-gray-400">Sedang memuat data peserta...</td></tr>
              ) : listSiswa.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-gray-400">Belum ada data siswa. Gunakan form di atas untuk menambahkan.</td></tr>
              ) : (
                siswaYangDitampilkan.map((siswa, index) => (
                  <tr key={siswa.id || index} className={`hover:bg-gray-50/50 transition-colors ${editId === siswa.id ? 'bg-amber-50/40 hover:bg-amber-50/60' : ''}`}>
                    <td className="p-4 text-gray-500">{indeksAwal + index + 1}</td>
                    {/* Tampilan label kelas sekarang otomatis rapi menggunakan spasi dari DB */}
                    <td className="p-4"><span className="bg-gray-100 text-gray-800 font-mono font-bold text-xs px-2 py-0.5 rounded whitespace-nowrap">{siswa.kelas}</span></td>
                    <td className="p-4 font-semibold text-gray-900">{siswa.nama_lengkap}</td>
                    <td className="p-4 font-mono text-gray-700">{siswa.nomor_induk}</td>
                    <td className="p-4 text-gray-500">{siswa.email}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => pemicuEdit(siswa)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded px-2.5 py-1 text-xs font-semibold transition-all"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHapusSiswa(siswa.id, siswa.nama_lengkap)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded px-2.5 py-1 text-xs font-semibold transition-all"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Navigasi Tombol Menggeser Halaman (Pagination Kontrol) */}
        {listSiswa.length > 0 && (
          <div className="p-4 bg-gray-50/40 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              Halaman <strong className="text-gray-700">{halamanAktif}</strong> dari <strong className="text-gray-700">{totalHalaman}</strong>
            </span>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={halamanAktif === 1 || fetching}
                onClick={() => setHalamanAktif((prev) => prev - 1)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-sm"
              >
                ◀️ Sebelumnya
              </button>
              
              <button
                type="button"
                disabled={halamanAktif === totalHalaman || fetching}
                onClick={() => setHalamanAktif((prev) => prev + 1)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-sm"
              >
                Berikutnya ▶️
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}