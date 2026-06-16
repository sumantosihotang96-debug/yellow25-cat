'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface SidebarProps {
  role: 'admin' | 'guru' | 'siswa';
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [namaSekolah, setNamaSekolah] = useState('CBT National System');
  const [userNama, setUserNama] = useState('');
  const [loadingAkun, setLoadingAkun] = useState(true); // State baru pengunci loading akun
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // 1. Ambil Informasi Pengaturan Nama Sekolah & Profil Pengguna dari Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingAkun(true);

        // Ambil nama sekolah dari pengaturan global
        const { data: dataSekolah } = await supabase
          .from('pengaturan_global')
          .select('nama_sekolah')
          .maybeSingle(); // Aman jika tabel kosong, tidak bikin crash
        
        if (dataSekolah?.nama_sekolah) {
          setNamaSekolah(dataSekolah.nama_sekolah);
        }

        // Ambil profil pengguna yang sedang login
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nama_lengkap')
            .eq('id', user.id)
            .maybeSingle(); // Aman jika record profile murni belum dibuat
          
          if (profile?.nama_lengkap) {
            setUserNama(profile.nama_lengkap);
          } else {
            // Cadangan jika nama_lengkap kosong, gunakan email user auth
            setUserNama(user.email?.split('@')[0] || 'User CBT');
          }
        } else {
          setUserNama('Sumanto Sihotang');
        }
      } catch (error) {
        console.error('Gagal memuat data di sidebar:', error);
        setUserNama('User CBT');
      } finally {
        // MATIKAN LOADING: Apa pun hasilnya, paksa "Memuat Akun..." menghilang!
        setLoadingAkun(false);
      }
    };

    fetchData();
  }, []);

  // 2. Fungsi Keluar (Logout) Aplikasi CBT
  const handleLogout = async () => {
    const konfirmasi = confirm('Apakah Anda yakin ingin keluar dari aplikasi CBT?');
    if (!konfirmasi) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  // 3. Fungsi Buka-Tutup Menu Dropdown Lipat Admin
  const toggleDropdown = (menuName: string) => {
    setOpenDropdown(openDropdown === menuName ? null : menuName);
  };

  // 4. Dekorasi Warna Label Berdasarkan Hak Akses
  const roleBadges = {
    admin: 'bg-red-600 text-white',
    guru: 'bg-amber-500 text-gray-950',
    siswa: 'bg-green-600 text-white',
  };

  return (
    /* PERUBAHAN DI SINI: Ditambahkan kelas `sticky top-0 h-screen` menggantikan `min-h-screen` */
    <div className="w-64 h-screen sticky top-0 bg-gray-900 text-gray-300 flex flex-col justify-between shadow-2xl border-r border-gray-800 shrink-0 z-30">
      <div className="flex flex-col flex-1 min-h-0">
        {/* ================= HEADER BRANDING ================= */}
        <div className="p-5 border-b border-gray-800 text-center bg-gray-950/40 shrink-0">
          <h2 className="text-lg font-bold text-white tracking-wide truncate" title={namaSekolah}>
            {namaSekolah}
          </h2>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full mt-1.5 inline-block uppercase font-bold tracking-wider ${roleBadges[role]}`}>
            {role} Panel
          </span>
        </div>

        {/* ================= IDENTITAS LOGIN ================= */}
        <div className="px-5 py-3 border-b border-gray-800/60 bg-gray-950/20 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-sm capitalize shrink-0">
            {loadingAkun ? '?' : (userNama ? userNama.charAt(0) : '?')}
          </div>
          <div className="truncate">
            <p className="text-xs text-gray-400">Selamat datang,</p>
            <p className="text-sm font-semibold text-gray-200 truncate">
              {loadingAkun ? (
                <span className="text-gray-500 text-xs italic animate-pulse">Memuat Akun...</span>
              ) : (
                userNama
              )}
            </p>
          </div>
        </div>

        {/* ================= DAFTAR MENU UTAMA ================= */}
        {/* Menggunakan `flex-1 overflow-y-auto` agar jika menu melebihi tinggi layar, area ini saja yang bisa di-scroll */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* ---------------- MENUS KHUSUS: ADMIN ---------------- */}
          {role === 'admin' && (
            <>
              <button onClick={() => router.push('/admin')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/admin' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-800 hover:text-white'}`}>
                🏠 Dashboard Admin
              </button>

              {/* Dropdown Menu Data Master */}
              <div>
                <button onClick={() => toggleDropdown('master')} className="w-full flex justify-between items-center px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-all">
                  <span>📂 Data Master Sekolah</span>
                  <span className="text-xs">{openDropdown === 'master' ? '▲' : '▼'}</span>
                </button>
                {openDropdown === 'master' && (
                  <div className="pl-4 mt-1 space-y-1 bg-gray-950/40 py-1.5 rounded-lg border border-gray-800">
                    <button onClick={() => router.push('/admin/data-mapel')} className={`w-full text-left px-4 py-2 rounded-md text-xs font-medium ${pathname === '/admin/data-mapel' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                      • Kelola Mata Pelajaran
                    </button>
                    <button onClick={() => router.push('/admin/data-guru')} className={`w-full text-left px-4 py-2 rounded-md text-xs font-medium ${pathname === '/admin/data-guru' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                      • Data Guru (MGMP)
                    </button>
                    <button onClick={() => router.push('/admin/data-siswa')} className={`w-full text-left px-4 py-2 rounded-md text-xs font-medium ${pathname === '/admin/data-siswa' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                      • Data Siswa (Excel/Manual)
                    </button>
                  </div>
                )}
              </div>

              {/* Dropdown Menu Pelaksanaan */}
              <div>
                <button onClick={() => toggleDropdown('jadwal')} className="w-full flex justify-between items-center px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-all">
                  <span>🗓️ Pelaksanaan Ujian</span>
                  <span className="text-xs">{openDropdown === 'jadwal' ? '▲' : '▼'}</span>
                </button>
                {openDropdown === 'jadwal' && (
                  <div className="pl-4 mt-1 space-y-1 bg-gray-950/40 py-1.5 rounded-lg border border-gray-800">
                    <button onClick={() => router.push('/admin/kelola-jadwal')} className={`w-full text-left px-4 py-2 rounded-md text-xs font-medium ${pathname === '/admin/kelola-jadwal' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                      • Rilis Jadwal & Jumlah Soal
                    </button>
                    <button onClick={() => router.push('/admin/pantau-ujian')} className={`w-full text-left px-4 py-2 rounded-md text-xs font-medium ${pathname === '/admin/pantau-ujian' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                      • Pantau Live (Reset Sesi/Time)
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => router.push('/admin/rekap-nilai')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/admin/rekap-nilai' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'}`}>
                📊 Rekap Nilai Global
              </button>
              <button onClick={() => router.push('/admin/mode-darurat')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/admin/mode-darurat' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'}`}>
                🚨 Mode Penyisipan Gambar
              </button>
              <button onClick={() => router.push('/admin/pengaturan')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/admin/pengaturan' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'}`}>
                ⚙️ Pengaturan Sistem
              </button>
            </>
          )}

          {/* ---------------- MENUS KHUSUS: GURU ---------------- */}
          {role === 'guru' && (
            <>
              <button onClick={() => router.push('/guru')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/guru' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-800 hover:text-white'}`}>
                🏠 Dashboard Guru
              </button>
              
              {/* Dropdown Menu Bank Soal Guru */}
              <div>
                <button onClick={() => toggleDropdown('soalGuru')} className="w-full flex justify-between items-center px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-all">
                  <span>📝 Kelola Bank Soal</span>
                  <span className="text-xs">{openDropdown === 'soalGuru' ? '▲' : '▼'}</span>
                </button>
                {openDropdown === 'soalGuru' && (
                  <div className="pl-4 mt-1 space-y-1 bg-gray-950/40 py-1.5 rounded-lg border border-gray-800">
                    <button onClick={() => router.push('/guru/bank-soal')} className={`w-full text-left px-4 py-2 rounded-md text-xs font-medium ${pathname === '/guru/bank-soal' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                      • Daftar Bank Soal (Excel)
                    </button>
                    <button onClick={() => router.push('/guru/bank-soal/tambah')} className={`w-full text-left px-4 py-2 rounded-md text-xs font-medium ${pathname === '/guru/bank-soal/tambah' ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                      • Buat Soal Manual (IMG)
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => router.push('/guru/pantau-ujian')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/guru/pantau-ujian' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-800 hover:text-white'}`}>
                👁️‍🗨️ Monitor Live Siswa
              </button>
              <button onClick={() => router.push('/guru/rekap-nilai')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/guru/rekap-nilai' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-800 hover:text-white'}`}>
                📊 Rekap Koreksi Esai
              </button>
            </>
          )}

          {/* ---------------- MENUS KHUSUS: SISWA ---------------- */}
          {role === 'siswa' && (
            <>
              <button onClick={() => router.push('/siswa')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/siswa' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-800 hover:text-white'}`}>
                ✍️ Ruang Ujian Hari Ini
              </button>
              <button onClick={() => router.push('/siswa/riwayat-nilai')} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/siswa/riwayat-nilai' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-800 hover:text-white'}`}>
                📜 Riwayat Hasil Ujian
              </button>
            </>
          )}

        </nav>
      </div>

      {/* ================= TOMBOL KELUAR APLIKASI ================= */}
      <div className="p-4 border-t border-gray-800 bg-gray-950/30 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full bg-red-700/80 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs tracking-wide transition-all duration-200 shadow-md uppercase"
        >
          Keluar Dari CBT
        </button>
      </div>
    </div>
  );
}