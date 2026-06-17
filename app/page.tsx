'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

// Tipe Peran Login
type Role = 'siswa' | 'guru' | 'admin';

// 🔑 TAMBAHAN TERKUNCI: Definisi struktur objek tabel profiles untuk standarisasi Vercel Build
interface ProfileUser {
  id: string;
  nomor_induk: string;
  password?: string;
  nama_lengkap: string;
  role: string;
  kelas?: string | null;
  email?: string | null;
}

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('siswa'); // Bawaan awal: siswa
  
  // State Input Form
  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Fungsi mengubah tab peran login
  const handleSwitchRole = (selectedRole: Role) => {
    setRole(selectedRole);
    setIdentifier('');
    setPassword('');
    setErrorMsg('');
  };

  const handleLoginProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.clear(); // Bersihkan sisa session login lain agar tidak bentrok
      }

      // 🛠️ 1. JALUR LOGIN ADMIN
      if (role === 'admin') {
        if (identifier.trim().toLowerCase() === 'admin@cbt.com' && password === 'admin123') {
          if (typeof window !== 'undefined') {
            localStorage.setItem('user_role', 'admin');
            localStorage.setItem('user_name', 'Bapak Admin Utama');
          }
          router.push('/admin');
          return;
        } else {
          setErrorMsg('❌ Kredensial Admin tidak valid!');
          setLoading(false);
          return;
        }
      }

      // 👨‍🏫 & 🎓 2. JALUR LOGIN GURU & SISWA (Menggunakan tabel 'profiles' terpusat)
      const { data, error: userError } = await supabase
        .from('profiles')
        .select('id, nomor_induk, password, nama_lengkap, role, kelas, email')
        .eq('nomor_induk', identifier.trim())
        .eq('password', password)
        .eq('role', role) // 🔑 Memfilter dinamis sesuai tab aktif: 'guru' atau 'siswa'
        .maybeSingle();

      if (userError) throw userError;

      // Cek apakah user ditemukan
      if (!data) {
        setErrorMsg(`❌ ${role === 'siswa' ? 'NISN' : 'NIP'} atau Kata Sandi salah.`);
        setLoading(false);
        return;
      }

      // 🔑 PENYELARASAN: Konversi tipe data agar Vercel mendeteksi isi properti dengan jelas
      const user = data as ProfileUser;

      // Proses penyimpanan session ke localStorage sesuai peran masing-masing
      if (typeof window !== 'undefined') {
        
        if (role === 'siswa') {
          // 3. Memecah data kelas gabungan (Contoh: XI-RPL-2) khusus siswa
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

          localStorage.setItem('session_siswa_id', user.id);
          localStorage.setItem('session_siswa_nisn', user.nomor_induk);
          localStorage.setItem('session_siswa_nama', user.nama_lengkap);
          localStorage.setItem('session_siswa_kelas_lengkap', user.kelas || ''); 
          localStorage.setItem('session_siswa_tingkat', tingkatKelas);            
          localStorage.setItem('session_siswa_jurusan', namaJurusan);            
          localStorage.setItem('user_role', 'siswa');

          // Alihkan ke dashboard siswa sesuai kode referensi Bapak
          router.push('/siswa/dashboard');
        } else if (role === 'guru') {
          localStorage.setItem('session_guru_id', user.id);
          localStorage.setItem('session_guru_nip', user.nomor_induk); // Menyimpan NIP agar terbaca di Dashboard Guru
          localStorage.setItem('session_guru_nama', user.nama_lengkap);
          localStorage.setItem('user_role', 'guru');

          // 🔑 FIX REDIRECT: Dialihkan langsung ke panel root guru '/guru' agar selaras dengan file pengaman
          router.push('/guru');
        }
      }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-100 to-indigo-100 flex items-center justify-center p-4 antialiased font-sans">
      
      {/* PANEL CONTAINER UTAMA */}
      <div className="bg-white rounded-[24px] shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row min-h-[560px] border border-gray-100">
        
        {/* ================= SISI KIRI (GRADASI SETENGAH) ================= */}
        <div className="md:w-[45%] bg-gradient-to-b from-blue-600 via-blue-700/50 to-slate-900 p-8 flex flex-col justify-between text-white relative">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-lg border border-white/20">
              🎓
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider">CBT Sekolah</h3>
              <p className="text-[10px] text-blue-200">Ujian Online Berbasis Komputer</p>
            </div>
          </div>

          {/* Slogan Tengah */}
          <div className="my-6 space-y-3">
            <h1 className="text-2xl md:text-3xl font-black leading-tight tracking-tight">
              Selamat Datang di <br />Sistem CBT Sekolah
            </h1>
            <p className="text-[11px] text-blue-100/80 leading-relaxed max-w-xs">
              Platform pelaksanaan ujian sekolah yang mandiri, aman, real-time, dan terproteksi sistem geofencing wilayah.
            </p>
          </div>

          {/* Footer Kiri */}
          <div className="text-[10px] text-blue-300 font-mono tracking-wider pt-3 border-t border-white/10">
            Portal Utama Aplikasi CBT
          </div>
        </div>

        {/* ================= SISI KANAN (FORM LOGIN UTAMA) ================= */}
        <div className="md:w-[55%] p-8 flex flex-col justify-between bg-white">
          
          {/* 📍 KANAN ATAS: TOMBOL FILTER/SWITCH ROLE PORTAL */}
          <div className="flex justify-end items-center gap-2 text-[11px] self-end bg-gray-50 p-1.5 rounded-full border border-gray-100 shadow-sm font-bold">
            <button 
              type="button"
              onClick={() => handleSwitchRole('siswa')}
              className={`px-3 py-1 rounded-full transition-all ${role === 'siswa' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-blue-600'}`}
            >
              🎓 Siswa
            </button>
            <button 
              type="button"
              onClick={() => handleSwitchRole('guru')}
              className={`px-3 py-1 rounded-full transition-all ${role === 'guru' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-indigo-600'}`}
            >
              👨‍🏫 Guru
            </button>
            <button 
              type="button"
              onClick={() => handleSwitchRole('admin')}
              className={`px-3 py-1 rounded-full transition-all ${role === 'admin' ? 'bg-slate-800 text-white shadow-sm' : 'text-gray-400 hover:text-slate-800'}`}
            >
              🛠️ Admin
            </button>
          </div>

          {/* AREA FORM UTAMA */}
          <div className="my-auto max-w-sm w-full mx-auto space-y-5 pt-4">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-blue-600">Masuk Ke Sistem</span>
              
              <h2 className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">
                Login {role === 'siswa' ? 'Siswa' : role === 'guru' ? 'Guru' : 'Admin'}
              </h2>
              
              <p className="text-xs text-gray-400 mt-0.5">
                {role === 'siswa' && 'Silakan masukkan nomor NISN Anda untuk memulai ujian harian'}
                {role === 'guru' && 'Gunakan Nomor Induk Pegawai untuk mengelola bank soal'}
                {role === 'admin' && 'Akses pembuka kendali manajemen sistem engine CBT'}
              </p>
            </div>

            {/* Notifikasi Info Error */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 font-bold text-xs rounded-xl text-center">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLoginProcess} className="space-y-4">
              
              {/* INPUT IDENTITAS */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                  {role === 'siswa' && 'Nomor Induk Siswa Nasional (NISN)'}
                  {role === 'guru' && 'Nomor Induk Pegawai / Guru (NIP)'}
                  {role === 'admin' && 'Email Resmi Admin'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-xs">
                    {role === 'admin' ? '✉️' : '🆔'}
                  </span>
                  <input
                    type={role === 'admin' ? 'email' : 'text'}
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      role === 'siswa' ? 'Contoh: 004829xxxx' : 
                      role === 'guru' ? 'Contoh: 198203xxxx' : 'Masukkan email admin'
                    }
                    className="w-full bg-gray-50/70 border border-gray-200 pl-10 pr-4 py-3 rounded-xl text-xs font-medium outline-none text-gray-700 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* INPUT PASSWORD */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Kata Sandi</label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-xs">
                    🔒
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun"
                    className="w-full bg-gray-50/70 border border-gray-200 pl-10 pr-10 py-3 rounded-xl text-xs font-medium outline-none text-gray-700 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 text-xs hover:text-gray-600"
                  >
                    {showPassword ? '👁' : '🙈'}
                  </button>
                </div>
              </div>

              {/* ACTION BUTTON SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 mt-2 shadow-md ${
                  role === 'siswa' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10' :
                  role === 'guru' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10' :
                  'bg-slate-800 hover:bg-slate-900 shadow-slate-800/10'
                }`}
              >
                {loading ? 'Memvalidasi Akses...' : `Login ${role === 'siswa' ? 'Siswa' : role === 'guru' ? 'Guru' : 'Admin'} ➡️`}
              </button>
            </form>
          </div>

          {/* Ornamen Garis Penutup */}
          <div className="text-center text-gray-200 text-xs tracking-widest select-none pointer-events-none font-light">
            ✦ ━━━━━━ ❖ ━━━━━━ ✦
          </div>

        </div>
      </div>

    </div>
  );
}