'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function LoginGuruPage() {
  const router = useRouter();
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // Ambil data berdasarkan nomor_induk dan password dari tabel profiles
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, nomor_induk, password, nama_lengkap, role')
        .eq('nomor_induk', nip.trim())
        .eq('password', password)
        .maybeSingle();

      if (error) throw error;

      if (!user) {
        setErrorMsg('❌ NIP atau Kata Sandi salah.');
        setLoading(false);
        return;
      }

      if (user.role !== 'guru') {
        setErrorMsg('⚠️ Akses Ditolak! Akun Anda bukan akun Guru.');
        setLoading(false);
        return;
      }

      // Kunci data sesi guru ke dalam browser
      if (typeof window !== 'undefined') {
        localStorage.setItem('session_guru_id', user.id);
        localStorage.setItem('session_guru_nip', user.nomor_induk);
        localStorage.setItem('session_guru_nama', user.nama_lengkap);
      }

      router.push('/guru');

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan koneksi ke database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-sm w-full shadow-2xl space-y-6">
        <h2 className="text-center font-black tracking-wider text-sm uppercase">Portal Masuk Guru</h2>
        {errorMsg && <div className="p-3 bg-red-950/50 text-red-400 text-xs rounded-xl border border-red-900 text-center">{errorMsg}</div>}
        <form onSubmit={handleLogin} className="space-y-4 text-sm text-gray-300">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-gray-400">NIP Guru</label>
            <input type="text" required value={nip} onChange={(e) => setNip(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl outline-none text-white focus:border-blue-500" placeholder="Masukkan NIP..." />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-gray-400">Kata Sandi</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl outline-none text-white focus:border-blue-500" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 font-bold p-3 rounded-xl text-xs uppercase tracking-wider text-white hover:bg-blue-700 transition-all">
            {loading ? '⏳ Memeriksa Akun...' : 'Masuk Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}