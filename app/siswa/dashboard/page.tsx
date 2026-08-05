'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface JadwalSiswa {
  id: string;
  tanggal_ujian: string;
  jam_mulai: string;
  durasi_menit: number;
  token_ujian: string;
  jumlah_soal_tampil: number;
  mapel: {
    nama_mapel: string;
    kelas: string | null;
    jurusan: string | null;
    status_mapel: string | null;
  } | null;
}

export default function DashboardSiswaPage() {
  const router = useRouter();
  const [namaSiswa, setNamaSiswa] = useState('');
  const [kelasSiswa, setKelasSiswa] = useState(''); 
  const [tingkatSiswa, setTingkatSiswa] = useState('');
  const [jurusanSiswa, setJurusanSiswa] = useState('');
  const [agamaSiswa, setAgamaSiswa] = useState('');
  const [mapelPilihanSiswa, setMapelPilihanSiswa] = useState('');
  
  // 🏫 State Pengaturan Global
  const [namaSekolah, setNamaSekolah] = useState('Ruang Ujian');
  
  const [ujianHariIni, setUjianHariIni] = useState<JadwalSiswa[]>([]);
  const [ujianSelesaiIds, setUjianSelesaiIds] = useState<string[]>([]); 
  const [fetchingUjian, setFetchingUjian] = useState(true);

  // 🕒 State pantau waktu real-time
  const [waktuSekarang, setWaktuSekarang] = useState(new Date());

  // 🔑 State Modal Token Internal
  const [selectedUjian, setSelectedUjian] = useState<JadwalSiswa | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [tokenError, setTokenError] = useState('');

  // 🚪 State Modal Logout
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // 📍 State Geolokasi
  const [isDiDalamKawasan, setIsDiDalamKawasan] = useState<boolean | null>(null); 
  const [errorLokasi, setErrorLokasi] = useState<string>('');
  const [jarakKeSekolah, setJarakKeSekolah] = useState<number | null>(null);
  const [checkingLokasi, setCheckingLokasi] = useState<boolean>(true);

  // 📏 FUNGSI HITUNG JARAK MATEMATIS (Haversine)
  const hitungJarakMeter = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; 
  };

  // 🛰️ VERIFIKASI SEBARAN GPS PERANGKAT SISWA
  const verifikasiLokasiSiswa = async () => {
    setCheckingLokasi(true);
    setErrorLokasi('');

    try {
      const { data: globalConfig, error: errorConfig } = await supabase
        .from('pengaturan_global')
        .select('nama_sekolah, latitude_sekolah, longitude_sekolah, radius_maksimal_meter')
        .maybeSingle();

      if (errorConfig) throw errorConfig;

      if (globalConfig?.nama_sekolah) {
        setNamaSekolah(globalConfig.nama_sekolah);
      }

      if (!globalConfig || globalConfig.latitude_sekolah === null || globalConfig.longitude_sekolah === null) {
        setErrorLokasi('Sistem gagal memuat konfigurasi geofencing sekolah. Hubungi admin.');
        setIsDiDalamKawasan(false);
        setCheckingLokasi(false);
        return;
      }

      const LATITUDE_SEKOLAH = Number(globalConfig.latitude_sekolah);
      const LONGITUDE_SEKOLAH = Number(globalConfig.longitude_sekolah);
      const RADIUS_MAKSIMAL_METER = Number(globalConfig.radius_maksimal_meter) || 100;

      if (!navigator.geolocation) {
        setErrorLokasi('Browser Anda tidak mendukung fitur deteksi lokasi (Geolokalasi).');
        setIsDiDalamKawasan(false);
        setCheckingLokasi(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const jarak = hitungJarakMeter(latitude, longitude, LATITUDE_SEKOLAH, LONGITUDE_SEKOLAH);
          
          setJarakKeSekolah(Math.round(jarak));

          if (jarak <= RADIUS_MAKSIMAL_METER) {
            setIsDiDalamKawasan(true);
          } else {
            setIsDiDalamKawasan(false);
            setErrorLokasi(`Anda berada di luar kawasan ujian (${Math.round(jarak)} meter dari sekolah).`);
          }
          setCheckingLokasi(false);
        },
        (error) => {
          setCheckingLokasi(false);
          setIsDiDalamKawasan(false);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setErrorLokasi('Akses ditolak. Mohon izinkan akses GPS / Lokasi pada browser Anda.');
              break;
            case error.POSITION_UNAVAILABLE:
              setErrorLokasi('Informasi koordinat tidak tersedia. Pastikan GPS perangkat aktif.');
              break;
            case error.TIMEOUT:
              setErrorLokasi('Waktu permintaan lokasi habis. Silakan muat ulang halaman.');
              break;
            default:
              setErrorLokasi('Gagal mendapatkan koordinat lokasi.');
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );

    } catch (err: any) {
      console.error('Error fetching global settings:', err.message);
      setErrorLokasi('Terjadi kesalahan sistem saat memuat data pengaturan wilayah.');
      setIsDiDalamKawasan(false);
      setCheckingLokasi(false);
    }
  };

  useEffect(() => {
    verifikasiLokasiSiswa();
  }, []);

  const formatNama = (text: string) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getTanggalHariIni = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
    return localISOTime;
  };

  const eksekusiLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const intervalWaktu = setInterval(() => {
      setWaktuSekarang(new Date());
    }, 5000);
    return () => clearInterval(intervalWaktu);
  }, []);

  useEffect(() => {
    const inisialisasiDashboard = async () => {
      if (typeof window === 'undefined') return;

      const id = localStorage.getItem('session_siswa_id');
      if (!id) {
        router.push('/');
        return;
      }

      // Ambil data profil lengkap (termasuk agama & mapel_pilihan) dari Supabase
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nama_lengkap, kelas, agama, mapel_pilihan')
        .eq('id', id)
        .maybeSingle();

      const nama = profileData?.nama_lengkap || localStorage.getItem('session_siswa_nama') || 'Siswa';
      const kelasLengkap = profileData?.kelas || localStorage.getItem('session_siswa_kelas_lengkap') || '-';
      const agama = profileData?.agama || '';
      const mapelPilihan = profileData?.mapel_pilihan || '';

      const bagianKelas = kelasLengkap.split(/\s+/);
      const tingkat = bagianKelas[0] || '';
      const jurusan = bagianKelas[1] || '';

      setNamaSiswa(formatNama(nama));
      setKelasSiswa(kelasLengkap);
      setTingkatSiswa(tingkat);
      setJurusanSiswa(jurusan);
      setAgamaSiswa(agama);
      setMapelPilihanSiswa(mapelPilihan);

      fetchDataDashboardLengkap(id, kelasLengkap, jurusan, agama, mapelPilihan);
    };

    inisialisasiDashboard();
  }, [router]);

  const fetchDataDashboardLengkap = async (
    siswaId: string, 
    kelasLengkapSiswa: string, 
    jurusanSiswa: string,
    agama: string,
    mapelPilihan: string
  ) => {
    setFetchingUjian(true);
    try {
      const tanggalHariIni = getTanggalHariIni();

      // 1. Ambil list ujian hari ini + status_mapel
      const { data: dataJadwal, error: errorJadwal } = await supabase
        .from('jadwal_ujian')
        .select('id, tanggal_ujian, jam_mulai, durasi_menit, token_ujian, jumlah_soal_tampil, mapel(nama_mapel, kelas, jurusan, status_mapel)')
        .eq('tanggal_ujian', tanggalHariIni)
        .order('jam_mulai', { ascending: true });

      if (errorJadwal) throw errorJadwal;

      // 2. Ambil riwayat ujian yang SUDAH DISUBMIT
      const { data: dataNilai, error: errorNilai } = await supabase
        .from('nilai_siswa')
        .select('id_jadwal')
        .eq('id_siswa', siswaId);

      if (errorNilai) throw errorNilai;

      if (dataNilai) {
        const listIdSelesai = dataNilai.map(item => item.id_jadwal);
        setUjianSelesaiIds(listIdSelesai);
      }

      if (dataJadwal) {
        const hasilFilter = (dataJadwal as unknown as JadwalSiswa[]).filter((jadwal) => {
          if (!jadwal.mapel) return false;

          const kelasMapelDb = (jadwal.mapel.kelas || '').trim().toUpperCase();
          const jurusanMapelDb = (jadwal.mapel.jurusan || '').trim().toUpperCase();
          const statusMapelDb = (jadwal.mapel.status_mapel || '').trim().toLowerCase();

          const kelasSiswaClean = kelasLengkapSiswa.trim().toUpperCase();
          const jurusanSiswaClean = jurusanSiswa.trim().toUpperCase();
          const tingkatSiswaClean = kelasSiswaClean.split(' ')[0] || '';
          
          const agamaClean = agama.trim().toLowerCase();
          const mapelPilihanClean = mapelPilihan.trim().toLowerCase();

          // 🚀 LOGIKA FILTER KELAS
          const cocokKelas = 
            kelasMapelDb === '' || 
            kelasMapelDb === 'SEMUA' || 
            kelasMapelDb === kelasSiswaClean || 
            kelasMapelDb === tingkatSiswaClean;

          // 🚀 LOGIKA FILTER JURUSAN
          const cocokJurusan = 
            jurusanMapelDb === '' || 
            jurusanMapelDb === 'UMUM' || 
            jurusanMapelDb === jurusanSiswaClean;

          // 🚀 LOGIKA FILTER STATUS MAPEL (AGAMA / MAPEL PILIHAN)
          let cocokStatusMapel = false;
          if (!statusMapelDb || statusMapelDb === 'umum' || statusMapelDb === 'semua') {
            cocokStatusMapel = true;
          } else {
            // Jika mapel memiliki status khusus, cocokkan dengan agama/mapel pilihan siswa
            cocokStatusMapel = (statusMapelDb === agamaClean) || (statusMapelDb === mapelPilihanClean);
          }

          return cocokKelas && cocokJurusan && cocokStatusMapel;
        });

        setUjianHariIni(hasilFilter);
      }
    } catch (err: any) {
      console.error('Gagal memuat data dashboard:', err.message);
    } finally {
      setFetchingUjian(false);
    }
  };

  const dapatkanStatusWaktuUjian = (tanggalUjian: string, jamMulai: string, durasiMenit: number) => {
    try {
      if (!tanggalUjian || !jamMulai) return 'habis';

      let jamClean = jamMulai.trim().replace(/\./g, ':');
      if (jamClean.split(':').length === 2) {
        jamClean = `${jamClean}:00`;
      }

      const stringWaktuMulai = `${tanggalUjian.trim()}T${jamClean}+07:00`;
      const targetWaktuMulai = new Date(stringWaktuMulai);
      const targetWaktuSelesai = new Date(targetWaktuMulai.getTime() + durasiMenit * 60000);

      if (isNaN(targetWaktuMulai.getTime())) return 'habis';

      const sekarangMs = waktuSekarang.getTime();

      if (sekarangMs < targetWaktuMulai.getTime()) {
        return 'belum_mulai';
      } else if (sekarangMs > targetWaktuSelesai.getTime()) {
        return 'habis';
      } else {
        return 'aktif';
      }
    } catch (e) {
      return 'habis';
    }
  };

  const handleVerifikasiTokenUjian = (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError('');

    if (!selectedUjian) return;

    if (!isDiDalamKawasan) {
      setTokenError('🚫 Akses ditolak. Anda terdeteksi berada di luar kawasan sekolah.');
      return;
    }

    const sudahDikerjakan = ujianSelesaiIds.includes(selectedUjian.id);
    if (sudahDikerjakan) {
      setTokenError('🚫 Anda sudah menyelesaikan ujian ini dan tidak dapat masuk kembali.');
      return;
    }

    const tokenBenar = selectedUjian.token_ujian.trim().toUpperCase();
    const tokenSiswa = inputToken.trim().toUpperCase();

    if (tokenSiswa !== tokenBenar) {
      setTokenError('❌ Token Ujian salah! Silakan tanyakan kepada pengawas ruang.');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('session_token_aktif', tokenSiswa);
    }

    const idJadwal = selectedUjian.id;
    setSelectedUjian(null);
    setInputToken('');
    router.push(`/siswa/ujian/${idJadwal}`);
  };

  return (
    <div className="space-y-6 relative">
      
      {/* BANNER SELAMAT DATANG */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-blue-700 via-indigo-600 to-violet-600 p-6 sm:p-7 rounded-2xl text-white shadow-lg shadow-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Background Blur Elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-fuchsia-500/20 rounded-full blur-2xl pointer-events-none" />
        
        {/* Teks Ucapan Selamat Datang */}
        <div className="relative z-10 space-y-1.5 max-w-xl">
          <h2 className="text-lg sm:text-xl font-black tracking-wide leading-tight">
            Selamat Datang <span className="text-yellow-300 drop-shadow-sm">{namaSiswa}</span> di {namaSekolah}! 👋
          </h2>
          <p className="text-xs text-indigo-100/90 font-medium flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Sistem Ujian Khusus Area Sekolah (Geofencing GPS) Aktif.</span>
          </p>
        </div>

        {/* Kontainer Kelas dan Logout (Selalu berada di dalam banner) */}
        <div className="relative z-10 flex flex-wrap items-center justify-start md:justify-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-white/10">
          <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-2 rounded-xl shadow-inner">
            <span className="text-base">🏫</span>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-200 leading-none">Kelas</div>
              <div className="text-xs font-mono font-black text-yellow-300 mt-0.5">{kelasSiswa}</div>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 hover:scale-[1.02] active:scale-[0.98] border border-red-400/30 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md"
          >
            <span>Logout</span> 🚪
          </button>
        </div>
      </div>

      {/* STATUS GEOLOKASI */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
        checkingLokasi ? 'bg-blue-50 border-blue-200 text-blue-800' :
        isDiDalamKawasan ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}>
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">{checkingLokasi ? '📡' : isDiDalamKawasan ? '📍' : '🚷'}</span>
          <div>
            <h4 className="font-black text-xs uppercase tracking-wide">Status Lokasi Perangkat</h4>
            <p className="text-xs opacity-90 mt-0.5">
              {checkingLokasi ? 'Menyelaraskan koordinat GPS Anda dengan satelit...' : 
               isDiDalamKawasan ? `Terverifikasi! Anda berada di area sekolah (Radius Anda: ${jarakKeSekolah}m dari pusat).` : errorLokasi}
            </p>
          </div>
        </div>
        <button 
          onClick={verifikasiLokasiSiswa} 
          disabled={checkingLokasi}
          className="w-full sm:w-auto bg-white/80 hover:bg-white text-gray-800 border font-bold px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50 shadow-sm shrink-0"
        >
          🔄 Update Lokasi
        </button>
      </div>

      {/* SECTION JADWAL UJIAN */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <span className="text-xl">📝</span>
          <div>
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide">Daftar Ujian Aktif Hari Ini</h3>
            <p className="text-xs text-gray-400">Daftar mata pelajaran yang diujiankan hari ini untuk kelas Anda.</p>
          </div>
        </div>

        {fetchingUjian ? (
          <div className="text-center py-8 text-xs text-gray-400 font-medium">
            ⏳ Memetakan jadwal ujian kelas Anda...
          </div>
        ) : ujianHariIni.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-4">
            <span className="text-2xl">☕</span>
            <p className="text-xs font-bold text-gray-600 mt-2">Tidak Ada Ujian Berlangsung</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Tidak ada jadwal mata pelajaran yang cocok untuk Anda hari ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {ujianHariIni.map((ujian) => {
              const statusWaktu = dapatkanStatusWaktuUjian(ujian.tanggal_ujian, ujian.jam_mulai, ujian.durasi_menit);
              const sudahDikerjakan = ujianSelesaiIds.includes(ujian.id); 

              return (
                <div 
                  key={ujian.id} 
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                    statusWaktu !== 'aktif' || sudahDikerjakan || !isDiDalamKawasan
                      ? 'border-gray-200 bg-gray-50/70 opacity-65 shadow-inner' 
                      : 'border-gray-100 bg-slate-50 hover:border-indigo-300 shadow-sm'
                  }`}
                >
                  <div className="space-y-1">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                      sudahDikerjakan
                        ? 'bg-gray-200 text-gray-600 border-gray-300'
                        : !isDiDalamKawasan
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : statusWaktu === 'belum_mulai'
                        ? 'bg-amber-100 text-amber-800 border-amber-200' 
                        : statusWaktu === 'habis'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    }`}>
                      {sudahDikerjakan && '✅ Selesai'}
                      {!sudahDikerjakan && !isDiDalamKawasan && '🚷 Luar Kawasan'}
                      {!sudahDikerjakan && isDiDalamKawasan && statusWaktu === 'belum_mulai' && '🔒 Belum Dimulai'}
                      {!sudahDikerjakan && isDiDalamKawasan && statusWaktu === 'habis' && '⏰ Waktu Habis'}
                      {!sudahDikerjakan && isDiDalamKawasan && statusWaktu === 'aktif' && 'Mata Pelajaran'}
                    </span>
                    <h4 className="font-bold text-gray-900 text-base">{ujian?.mapel?.nama_mapel || 'Mapel Tanpa Nama'}</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <p>🕒 Jam Mulai: <span className="font-semibold text-gray-700">{ujian.jam_mulai} WIB</span></p>
                      <p>⏳ Durasi: <span className="font-semibold text-gray-700">{ujian.durasi_menit} Menit</span></p>
                      <p>📊 Kuota: <span className="font-semibold text-gray-700">{ujian.jumlah_soal_tampil} Soal</span></p>
                    </div>
                  </div>
                  
                  {sudahDikerjakan ? (
                    <button 
                      disabled
                      className="w-full sm:w-auto bg-gray-200 text-gray-400 border border-gray-300 font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed shrink-0 select-none"
                    >
                      Sudah Dikerjakan 🚫
                    </button>
                  ) : !isDiDalamKawasan ? (
                    <button 
                      disabled
                      title="Tombol terkunci karena perangkat Anda berada di luar batas jarak sekolah"
                      className="w-full sm:w-auto bg-rose-100 text-rose-400 border border-rose-200 font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed shrink-0 select-none"
                    >
                      Luar Wilayah 🚷
                    </button>
                  ) : statusWaktu === 'belum_mulai' ? (
                    <button 
                      disabled
                      className="w-full sm:w-auto bg-gray-300 text-gray-500 font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed border border-gray-200 shrink-0 select-none"
                    >
                      Belum Mulai 🔒
                    </button>
                  ) : statusWaktu === 'habis' ? (
                    <button 
                      disabled
                      className="w-full sm:w-auto bg-red-100 text-red-400 border border-red-200 font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed shrink-0 select-none"
                    >
                      Waktu Habis ⏰
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setSelectedUjian(ujian);
                        setInputToken('');
                        setTokenError('');
                      }}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-sm transition shrink-0"
                    >
                      Mulai Kerja 🚀
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIWAYAT NILAI */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <span className="text-2xl">📊</span>
          <h3 className="font-black text-gray-900 mt-2 text-sm uppercase">Riwayat Nilai Ujian</h3>
          <p className="text-xs text-gray-400 mt-1">Periksa hasil lembar jawaban dan nilai dari ujian yang telah selesai.</p>
        </div>
        <button 
          onClick={() => router.push('/siswa/nilai')}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs uppercase transition"
        >
          Lihat Semua Nilai
        </button>
      </div>

      {/* FLOATING MODAL INPUT TOKEN */}
      {selectedUjian && isDiDalamKawasan && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-center">
              <span className="text-2xl">🔑</span>
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide mt-2">Konfirmasi Token Ujian</h3>
              <p className="text-xs text-gray-400 mt-0.5">Mata Pelajaran: <span className="font-bold text-gray-700">{selectedUjian.mapel?.nama_mapel}</span></p>
            </div>

            {tokenError && (
              <div className="p-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold text-center">
                {tokenError}
              </div>
            )}

            <form onSubmit={handleVerifikasiTokenUjian} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1 text-center">Masukkan 5 Digit Token</label>
                <input 
                  type="text"
                  required
                  maxLength={5}
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="X X X X X"
                  className="w-full bg-gray-50 border border-gray-300 p-3 rounded-xl outline-none text-center font-mono font-black text-lg tracking-widest text-indigo-600 focus:border-indigo-500 uppercase placeholder:tracking-normal placeholder:font-sans placeholder:text-xs"
                />
              </div>

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUjian(null);
                    setInputToken('');
                    setTokenError('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold p-3 rounded-xl hover:bg-gray-200 transition uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-700 transition uppercase tracking-wider shadow-sm"
                >
                  Validasi ➡️
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING MODAL LOGOUT */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div>
              <span className="text-3xl">🚪</span>
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide mt-3">Konfirmasi Keluar</h3>
              <p className="text-xs text-gray-400 mt-1.5">Apakah Anda yakin ingin keluar dari aplikasi {namaSekolah}?</p>
            </div>

            <div className="flex gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold p-3 rounded-xl hover:bg-gray-200 transition uppercase tracking-wider"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={eksekusiLogout}
                className="flex-1 bg-red-500 text-white font-bold p-3 rounded-xl hover:bg-red-600 transition uppercase tracking-wider shadow-sm"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}