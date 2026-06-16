'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function DebugLoginGuruPage() {
  const router = useRouter();
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    console.log('=== Memulai Proses Login Guru ===');
    console.log('Input NIP:', nip);
    console.log('Input Password:', password);

    try {
      // Cek apakah koneksi Supabase terdefinisi
      if (!supabase) {
        console.error('❌ ERROR: Inisialisasi Supabase gagal. Cek file @/utils/supabase');
        setErrorMsg('Supabase tidak terhubung.');
        return;
      }

      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, nomor_induk, password, nama_lengkap, role')
        .eq('nomor_induk', nip.trim())
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.error('❌ ERROR DARI SUPABASE PROFILES:', error.message);
        console.error('Detail Eror:', error);
        setErrorMsg(`Database Eror: ${error.message}`);
        return;
      }

      console.log('Hasil pencarian user di database:', user);

      if (!user) {
        console.warn('⚠️ WARNING: Akun tidak ditemukan di tabel profiles dengan kredensial tersebut.');
        setErrorMsg('❌ NIP atau Kata Sandi salah.');
        return;
      }

      if (user.role !== 'guru') {
        console.warn(`⚠️ WARNING: Akun ditemukan tetapi role-nya adalah "${user.role}", bukan "guru".`);
        setErrorMsg('⚠️ Akses Ditolak! Anda bukan Guru.');
        return;
      }

      console.log('✅ Login Sukses! Menyimpan data ke localStorage...');
      if (typeof window !== 'undefined') {
        localStorage.setItem('session_guru_id', user.id);
        localStorage.setItem('session_guru_nip', user.nomor_induk);
        localStorage.setItem('session_guru_nama', user.nama_lengkap);
        console.log('localStorage berhasil diisi:', {
          id: localStorage.getItem('session_guru_id'),
          nip: localStorage.getItem('session_guru_nip'),
        });
      }

      console.log('Mengalihkan halaman ke /guru ...');
      router.push('/guru');

    } catch (err: any) {
      console.error('💥 CRASH PADA FUNGSI LOGIN:', err.message);
      setErrorMsg('Terjadi crash sistem pada fungsi login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-white">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full border border-gray-700 shadow-2xl space-y-4">
        <h2 className="text-center font-bold text-lg">DEBUG PORTAL GURU</h2>
        <p className="text-xs text-yellow-400 text-center italic">Tekan F12 pada browser untuk melihat proses log</p>
        
        {errorMsg && (
          <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 text-xs rounded-lg text-center font-mono">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLoginGuru} className="space-y-3 text-sm text-gray-300">
          <div>
            <label className="block text-xs mb-1">NIP</label>
            <input type="text" required value={nip} onChange={(e) => setNip(e.target.value)} className="w-full p-2 rounded bg-gray-950 border border-gray-700" />
          </div>
          <div>
            <label className="block text-xs mb-1">PASSWORD</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 rounded bg-gray-950 border border-gray-700" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 p-2 rounded font-bold text-xs uppercase">
            {loading ? 'Memeriksa...' : 'Masuk & Debug'}
          </button>
        </form>
      </div>
    </div>
  );
}