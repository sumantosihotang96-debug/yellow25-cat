'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function LoginSiswaPage() {
  const router = useRouter();
  const [nisn, setNisn] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginSiswa = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Ambil data secara spesifik: pastikan nomor_induk cocok DAN rolenya wajib 'siswa'
      // Langkah ini mencegah eror "multiple rows" jika ada NISN sama namun beda role di database
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, nomor_induk, password, nama_lengkap, role, kelas, email')
        .eq('nomor_induk', nisn.trim())
        .eq('password', password)
        .eq('role', 'siswa') // 🔑 KUNCI: Filter role siswa langsung dari query database
        .maybeSingle();

      if (userError) throw userError;

      // 2. Cek apakah user ditemukan
      if (!user) {
        setErrorMsg('❌ NISN atau Kata Sandi salah.');
        setLoading(false);
        return;
      }

      // 3. Memecah data kelas gabungan (Contoh: XI-RPL-2) untuk disimpan ke sesi
      let tingkatKelas = 'X';
      let namaJurusan = 'UMUM';
      
      if (user.kelas) {
        const komponenKelas = user.kelas.split('-');
        if (komponenKelas.length >= 2) {
          tingkatKelas = komponenKelas[0]; // "XI"
          namaJurusan = komponenKelas[1];  // "RPL"
        } else {
          tingkatKelas = user.kelas;
        }
      }

      // 4. Simpan informasi sesi siswa ke localStorage
      if (typeof window !== 'undefined') {
        localStorage.clear(); // Bersihkan sisa login lain agar tidak bentrok
        localStorage.setItem('session_siswa_id', user.id);
        localStorage.setItem('session_siswa_nisn', user.nomor_induk);
        localStorage.setItem('session_siswa_nama', user.nama_lengkap);
        localStorage.setItem('session_siswa_kelas_lengkap', user.kelas || ''); 
        localStorage.setItem('session_siswa_tingkat', tingkatKelas);            
        localStorage.setItem('session_siswa_jurusan', namaJurusan);            
      }

      // 5. Alihkan langsung ke halaman Dashboard Utama Siswa
      router.push(`/siswa/dashboard`);

    } catch (err: any) {
      console.error("Detail Eror Login:", err?.message || err);

      if (err?.message?.includes('Fetch') || !navigator.onLine) {
        setErrorMsg('❌ Gagal terhubung ke server. Periksa kembali koneksi internet Anda.');
      } else {
        setErrorMsg(err?.message || '❌ Terjadi kesalahan sistem saat mencoba masuk.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-sm w-full shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <span className="text-3xl">👨‍🎓</span>
          <h2 className="font-black tracking-wider text-sm uppercase text-white mt-2">Portal Masuk Siswa</h2>
          <p className="text-[11px] text-slate-400">Silakan masuk menggunakan nomor induk dan kata sandi Anda</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/50 text-red-400 text-xs rounded-xl border border-red-900 text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLoginSiswa} className="space-y-4 text-sm text-slate-300">
          {/* INPUT NISN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">NISN Siswa</label>
            <input 
              type="text" 
              required 
              disabled={loading}
              value={nisn} 
              onChange={(e) => setNisn(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl outline-none text-white focus:border-indigo-500 text-xs transition-all" 
              placeholder="Contoh: 0054321098" 
            />
          </div>

          {/* INPUT KATA SANDI */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">Kata Sandi</label>
            <div className="relative flex items-center">
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                disabled={loading}
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 p-3 pr-12 rounded-xl outline-none text-white focus:border-indigo-500 text-xs transition-all" 
                placeholder="••••••••" 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-xs text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* TOMBOL LOGIN */}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-indigo-600 font-bold p-3 rounded-xl text-xs uppercase tracking-wider text-white hover:bg-indigo-700 transition-all shadow-md pt-3.5 pb-3.5 disabled:opacity-50"
          >
            {loading ? '⏳ Memvalidasi Akun...' : 'Masuk ke Portal Siswa ➡️'}
          </button>
        </form>
      </div>
    </div>
  );
}