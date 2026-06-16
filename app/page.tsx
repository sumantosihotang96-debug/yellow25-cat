'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (email === 'admin@cbt.com' && password === 'admin123') {
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('user_name', 'Bapak Admin Utama');
      router.push('/admin');
      return;
    }

    alert('Akun Uji Coba: Gunakan email "admin@cbt.com" dan password "admin123"');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      
      {/* Ornamen Latar Belakang (Efek Cahaya Pendar/Glow) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Kartu Utama Login */}
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl space-y-6 relative z-10">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 text-white">
            ⚙️
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black text-white tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              CBT NASIONAL ENGINE
            </h1>
            <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest">
              Developer Bypass Mode
            </p>
          </div>
        </div>

        {/* Form Login Admin */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Alamat Email Resmi
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@cbt.com" 
              className="w-full px-4 py-3 border border-slate-800 rounded-xl text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100 placeholder:text-slate-600"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Kata Sandi Akun
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="w-full px-4 py-3 border border-slate-800 rounded-xl text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100 placeholder:text-slate-600"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Membuka Akses Dasbor...' : 'Masuk Sebagai Developer'}
          </button>
        </form>

        {/* Info Akun Admin (Dibuat Elegan dan Senada) */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 leading-relaxed font-mono">
          <div className="text-amber-400 font-bold mb-1 uppercase tracking-wide text-[10px]">
            🔑 Sandbox Credentials:
          </div>
          <div>• User: <span className="text-slate-200">admin@cbt.com</span></div>
          <div>• Pass: <span className="text-slate-200">admin123</span></div>
        </div>

        {/* Pembatas / Separator */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-slate-600 text-[10px] font-black tracking-widest">OR</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {/* Tombol Navigasi Menuju Portal Utama */}
        <button
          type="button"
          onClick={() => router.push('/login')} 
          className="w-full bg-slate-950 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all text-center block active:scale-[0.99]"
        >
          👨‍🏫 Masuk ke Portal Guru ➔
        </button>

      </div>
    </div>
  );
}