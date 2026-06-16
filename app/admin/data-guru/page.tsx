'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase';

interface Guru {
  id: string;
  nama_lengkap: string;
  nomor_induk: string;
  email: string;
  password?: string;
  mapel_diampu_ids: string[];
  mapel_diampu: string[];
}

interface Mapel {
  id: string;
  nama_mapel: string;
  kelas: string;
  jurusan: string;
}

export default function DataGuruPage() {
  const [listGuru, setListGuru] = useState<Guru[]>([]);
  const [listMapel, setListMapel] = useState<Mapel[]>([]);
  
  const [namaLengkap, setNamaLengkap] = useState('');
  const [nomorInduk, setNomorInduk] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mapelTerpilih, setMapelTerpilih] = useState<string[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editGuruId, setEditGuruId] = useState('');

  const [lihatSandi, setLihatSandi] = useState(false);

  const [dropdownTerbuka, setDropdownTerbuka] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [notifikasi, setNotifikasi] = useState<{ pesan: string; tipe: 'sukses' | 'gagal' } | null>(null);

  const toCapitalCase = (str: string) => {
    return str
      .trim()
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    if (notifikasi) {
      const timer = setTimeout(() => setNotifikasi(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notifikasi]);

  useEffect(() => {
    function clickLuar(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownTerbuka(false);
      }
    }
    document.addEventListener('mousedown', clickLuar);
    return () => document.removeEventListener('mousedown', clickLuar);
  }, []);

  const fetchGuru = async () => {
    setFetching(true);
    try {
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id, nama_lengkap, nomor_induk, email, password')
        .eq('role', 'guru')
        .order('nama_lengkap', { ascending: true });

      if (profileErr) throw profileErr;

      if (profiles) {
        const guruWithMapel = await Promise.all(
          profiles.map(async (guru) => {
            const { data: relasi } = await supabase
              .from('guru_mapel')
              .select('mapel_id, mapel(nama_mapel, kelas, jurusan)')
              .eq('guru_id', guru.id);
            
            const mapelIds = relasi ? relasi.map((r: any) => r.mapel_id) : [];
            
            const namaMapelArr = relasi 
              ? relasi.map((r: any) => {
                  if (!r.mapel) return null;
                  return `${r.mapel.nama_mapel} (${r.mapel.kelas || 'All'} - ${r.mapel.jurusan || 'UMUM'})`;
                }).filter(Boolean) 
              : [];
            
            return {
              ...guru,
              mapel_diampu_ids: mapelIds,
              mapel_diampu: namaMapelArr,
            };
          })
        );
        setListGuru(guruWithMapel as Guru[]);
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setFetching(false);
    }
  };

  const fetchMapelOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('mapel')
        .select('id, nama_mapel, kelas, jurusan')
        .order('nama_mapel', { ascending: true });

      if (error) throw error;

      if (data) {
        setListMapel(data as Mapel[]);
      }
    } catch (err: any) {
      console.error("Gagal memuat opsi dropdown mapel:", err.message);
    }
  };

  useEffect(() => {
    fetchGuru();
    fetchMapelOptions();
  }, []);

  const handleCheckboxMapel = (id: string) => {
    if (mapelTerpilih.includes(id)) {
      setMapelTerpilih(mapelTerpilih.filter(item => item !== id));
    } else {
      setMapelTerpilih([...mapelTerpilih, id]);
    }
  };

  const handlePicuEditGuru = (guru: Guru) => {
    setIsEditing(true);
    setEditGuruId(guru.id);
    setNamaLengkap(guru.nama_lengkap);
    setNomorInduk(guru.nomor_induk);
    setEmail(guru.email);
    setPassword(guru.password || '');
    setMapelTerpilih(guru.mapel_diampu_ids);
    setDropdownTerbuka(false);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetForm = () => {
    setIsEditing(false);
    setEditGuruId('');
    setNamaLengkap('');
    setNomorInduk('');
    setEmail('');
    setPassword('');
    setMapelTerpilih([]);
    setDropdownTerbuka(false);
  };

  const handleSimpanForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaLengkap || !nomorInduk || !email || !password) return;
    if (mapelTerpilih.length === 0) {
      setNotifikasi({ pesan: '⚠️ Silakan pilih minimal 1 mata pelajaran!', tipe: 'gagal' });
      return;
    }
    setLoading(true);

    try {
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            nama_lengkap: toCapitalCase(namaLengkap), 
            nomor_induk: nomorInduk.trim(),
            email: email.trim().toLowerCase(),
            password: password.trim(),
          })
          .eq('id', editGuruId);

        if (updateError) throw updateError;

        await supabase.from('guru_mapel').delete().eq('guru_id', editGuruId);

        const dataRelasiBaru = mapelTerpilih.map((mapelId) => ({
          guru_id: editGuruId,
          mapel_id: mapelId,
        }));
        await supabase.from('guru_mapel').insert(dataRelasiBaru);

        setNotifikasi({ pesan: '🎉 Perubahan akun guru berhasil diperbarui.', tipe: 'sukses' });
      } else {
        const uniqueId = crypto.randomUUID();

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: uniqueId,
              nama_lengkap: toCapitalCase(namaLengkap), 
              nomor_induk: nomorInduk.trim(),
              email: email.trim().toLowerCase(),
              password: password.trim(),
              role: 'guru',
            },
          ]);

        if (profileError) throw profileError;

        const dataRelasi = mapelTerpilih.map((mapelId) => ({
          guru_id: uniqueId,
          mapel_id: mapelId,
        }));
        await supabase.from('guru_mapel').insert(dataRelasi);

        setNotifikasi({ pesan: '🎉 Akun Guru baru sukses disimpan ke database.', tipe: 'sukses' });
      }

      handleResetForm();
      fetchGuru();

    } catch (error: any) {
      setNotifikasi({ pesan: '❌ Gagal memproses data: ' + error.message, tipe: 'gagal' });
    } finally {
      setLoading(false);
    }
  };

  const handleHapusGuru = async (id: string, nama: string) => {
    const konfirmasi = confirm(`⚠️ PERINGATAN PERMANEN:\nApakah Anda yakin ingin menghapus akun guru "${nama}"?`);
    if (!konfirmasi) return;

    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (!error) {
      setNotifikasi({ pesan: '🗑️ Akun guru berhasil dihapus dari database.', tipe: 'sukses' });
      if (isEditing && editGuruId === id) handleResetForm();
      fetchGuru();
    } else {
      setNotifikasi({ pesan: '❌ Gagal menghapus akun guru.', tipe: 'gagal' });
    }
  };

  return (
    <div className="space-y-8 relative p-4 max-w-5xl mx-auto">
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
        <h1 className="text-2xl font-bold text-gray-900">Data Guru Pembina MGMP</h1>
        <p className="text-gray-500 text-sm">Registrasikan, edit penugasan kurikulum, atau hapus akun otentikasi guru pembina secara real-time.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-base font-bold text-gray-800 mb-4">
          {isEditing ? '✏️ Ubah Data Guru Terpilih' : '➕ Daftar Akun Guru & Mapel Baru'}
        </h2>
        <form onSubmit={handleSimpanForm} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Lengkap (Beserta Gelar)</label>
            <input 
              type="text" 
              value={namaLengkap} 
              onChange={(e) => setNamaLengkap(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-950 font-medium"
              placeholder="Drs. Ahmad Subarjo, M.Pd"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">NIP / Nomor Induk Guru</label>
            <input 
              type="text" 
              value={nomorInduk} 
              onChange={(e) => setNomorInduk(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-950 font-medium"
              placeholder="198203112009021003"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Resmi Guru</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-950 font-medium"
              placeholder="ahmad.subarjo@sekolah.sch.id"
              required 
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Kata Sandi Default Panel</label>
            <div className="relative w-full">
              <input 
                type={lihatSandi ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-950 font-medium"
                placeholder="******"
                required 
              />
              <button
                type="button"
                onClick={() => setLihatSandi(!lihatSandi)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm focus:outline-none select-none"
              >
                {lihatSandi ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
          </div>
          
          <div className="md:col-span-2 relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mata Pelajaran Yang Diampu</label>
            <button
              type="button"
              onClick={() => setDropdownTerbuka(!dropdownTerbuka)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white text-gray-950 font-medium flex justify-between items-center shadow-sm"
            >
              <span className="truncate">
                {mapelTerpilih.length === 0 
                  ? '--- Klik untuk Memilih Mapel ---' 
                  : `Terpilih (${mapelTerpilih.length} Mata Pelajaran)`}
              </span>
              <span className="text-gray-400 text-xs">{dropdownTerbuka ? '▲' : '▼'}</span>
            </button>

            {dropdownTerbuka && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto p-2 space-y-1">
                {listMapel.length === 0 ? (
                  <div className="text-xs text-gray-400 p-2 italic text-center">Belum ada data mapel di database. Silakan isi tabel mapel terlebih dahulu.</div>
                ) : (
                  listMapel.map((mapel) => {
                    const isChecked = mapelTerpilih.includes(mapel.id);
                    return (
                      <label 
                        key={mapel.id} 
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-gray-950 font-medium ${isChecked ? 'bg-blue-50/70' : 'hover:bg-gray-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxMapel(mapel.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white"
                        />
                        <span>{mapel.nama_mapel} <span className="text-xs text-blue-600 font-bold">({mapel.kelas || 'All'} - {mapel.jurusan || 'UMUM'})</span></span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            {isEditing && (
              <button 
                type="button"
                onClick={handleResetForm}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2 rounded-lg text-sm transition-all"
              >
                Batal
              </button>
            )}
            <button 
              type="submit" 
              disabled={loading}
              className={`${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium px-6 py-2 rounded-lg text-sm transition-all shadow-sm w-full md:w-auto`}
            >
              {loading ? 'Memproses...' : isEditing ? 'Simpan Perubahan' : 'Daftarkan Akun Guru'}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Daftar Guru */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600 text-sm font-semibold">
              <th className="p-4 w-16">No.</th>
              <th className="p-4">Nama Guru</th>
              <th className="p-4 w-40">NIP / No. Induk</th>
              <th className="p-4">Email</th>
              <th className="p-4">Mapel yang Diampu</th>
              <th className="p-4 text-center w-48">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-gray-950 text-sm divide-y">
            {fetching ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-gray-400">Memuat data guru...</td>
              </tr>
            ) : listGuru.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-gray-400">Belum ada akun guru terdaftar.</td>
              </tr>
            ) : (
              listGuru.map((guru, index) => (
                <tr key={guru.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 text-gray-500">{index + 1}</td>
                  <td className="p-4 font-semibold text-gray-900">{guru.nama_lengkap}</td>
                  <td className="p-4 font-mono text-gray-700">{guru.nomor_induk}</td>
                  <td className="p-4 text-gray-700">{guru.email}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {guru.mapel_diampu.length > 0 ? (
                        guru.mapel_diampu.map((m, idx) => (
                          <span key={idx} className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-blue-100">
                            {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-xs">Belum diatur</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handlePicuEditGuru(guru)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHapusGuru(guru.id, guru.nama_lengkap)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold"
                    >
                      🗑️ Hapus
                    </button>
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