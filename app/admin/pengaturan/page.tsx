'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

export default function PengaturanPage() {
  const [namaSekolah, setNamaSekolah] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100'); // Default 100 meter
  
  // State: Toggle Visibilitas Pembahasan/Jawaban
  const [tampilkanJawaban, setTampilkanJawaban] = useState<boolean>(false);

  // State Baru: Toleransi Pelanggaran
  const [maksimalPelanggaran, setMaksimalPelanggaran] = useState<string>('3');

  const [loading, setLoading] = useState(false);
  const [loadingGPS, setLoadingGPS] = useState(false);

  // Ambil data pengaturan awal dari Supabase
  useEffect(() => {
    const loadPengaturan = async () => {
      const { data } = await supabase
        .from('pengaturan_global')
        .select('nama_sekolah, latitude_sekolah, longitude_sekolah, radius_maksimal_meter, tampilkan_jawaban, maksimal_pelanggaran')
        .maybeSingle();
      
      if (data) {
        setNamaSekolah(data.nama_sekolah || '');
        setLatitude(data.latitude_sekolah ? String(data.latitude_sekolah) : '');
        setLongitude(data.longitude_sekolah ? String(data.longitude_sekolah) : '');
        setRadius(data.radius_maksimal_meter ? String(data.radius_maksimal_meter) : '100');
        setTampilkanJawaban(Boolean(data.tampilkan_jawaban));
        setMaksimalPelanggaran(data.maksimal_pelanggaran ? String(data.maksimal_pelanggaran) : '3');
      }
    };
    loadPengaturan();
  }, []);

  // Fungsi pembantu untuk mengambil lokasi Admin saat ini secara otomatis (Auto-Pinpoint)
  const handleAmbilLokasiSaatIni = () => {
    setLoadingGPS(true);
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung fitur deteksi lokasi.');
      setLoadingGPS(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLoadingGPS(false);
        alert('🎯 Koordinat lokasi Anda saat ini berhasil disinkronkan ke form!');
      },
      (error) => {
        setLoadingGPS(false);
        alert('Gagal mengambil lokasi. Pastikan izin GPS aktif di browser Anda.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSimpanPengaturan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaSekolah || !latitude || !longitude || !radius || !maksimalPelanggaran) {
      alert('Mohon lengkapi semua data pengaturan.');
      return;
    }
    
    setLoading(true);

    const { error } = await supabase
      .from('pengaturan_global')
      .upsert({ 
        id: 1, 
        nama_sekolah: namaSekolah,
        latitude_sekolah: parseFloat(latitude),
        longitude_sekolah: parseFloat(longitude),
        radius_maksimal_meter: parseInt(radius, 10),
        tampilkan_jawaban: tampilkanJawaban,
        maksimal_pelanggaran: parseInt(maksimalPelanggaran, 10)
      });

    if (!error) {
      alert('⚙️ Semua pengaturan sistem, zonasi wilayah, batas pelanggaran, dan hak akses berhasil diperbarui!');
      window.location.reload();
    } else {
      alert('Gagal memperbarui pengaturan: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Sistem Sekolah</h1>
        <p className="text-gray-500 text-sm">Sesuaikan branding instansi, zonasi geofencing GPS, keamanan ujian, serta visibilitas lembar jawaban siswa.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-xl">
        <h2 className="text-base font-bold text-gray-700 mb-4">Konfigurasi CBT & Lokasi Pusat</h2>
        
        <form onSubmit={handleSimpanPengaturan} className="space-y-5">
          {/* NAMA SEKOLAH */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Instansi / Sekolah</label>
            <input 
              type="text" 
              value={namaSekolah} 
              onChange={(e) => setNamaSekolah(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
              placeholder="SMK Negeri 1 Jakarta"
              required 
            />
          </div>

          {/* KEAMANAN & TOLERANSI PELANGGARAN */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-rose-600">
              Toleransi Keamanan & Anti-Kecurangan Ujian
            </label>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Batas Toleransi Pelanggaran (Peringatan)
              </label>
              <div className="relative flex items-center">
                <input 
                  type="number" 
                  value={maksimalPelanggaran} 
                  onChange={(e) => setMaksimalPelanggaran(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500 text-gray-900 font-medium pr-16"
                  placeholder="3"
                  min="1"
                  max="10"
                  required 
                />
                <span className="absolute right-3 text-xs font-bold text-gray-400 pointer-events-none">Kali</span>
              </div>
              <p className="text-gray-400 text-[10px] mt-1">
                Jika siswa keluar dari layar ujian/pindah tab sebanyak <b>{maksimalPelanggaran || 3} kali</b>, sistem akan otomatis menghentikan dan mengumpulkan lembar ujian secara paksa.
              </p>
            </div>
          </div>

          {/* VISIBILITAS PEMBAHASAN / JAWABAN */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-600">
              Akses Tampilan Pembahasan Ujian
            </label>
            
            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-bold text-gray-800 block">
                  Tampilkan Lembar & Kunci Jawaban ke Siswa
                </span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  {tampilkanJawaban 
                    ? '🔓 Siswa BISA melihat rincian soal, pilihan mereka, dan kunci jawaban setelah selesai.' 
                    : '🔒 Siswa HANYA BISA melihat skor/nilai akhir (jawaban disembunyikan).'}
                </p>
              </div>

              {/* Sakelar / Toggle Switch */}
              <button
                type="button"
                onClick={() => setTampilkanJawaban(!tampilkanJawaban)}
                className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  tampilkanJawaban ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tampilkanJawaban ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ZONASI GEOFENCING GPS */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600">Zonasi Lokasi Ujian (Geofencing)</label>
              <button
                type="button"
                onClick={handleAmbilLokasiSaatIni}
                disabled={loadingGPS}
                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 transition disabled:opacity-50"
              >
                {loadingGPS ? '⏳ Mencari Satelit...' : '🎯 Gunakan Lokasi Saya Sekarang'}
              </button>
            </div>
            
            <p className="text-gray-400 text-[11px] leading-relaxed">
              Tentukan titik tengah area sekolah Anda. Siswa hanya dapat menekan tombol ujian jika berada di dalam radius jangkauan yang ditentukan.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* LATITUDE */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Latitude (Garis Lintang)</label>
                <input 
                  type="number"
                  step="any"
                  value={latitude} 
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono"
                  placeholder="-6.230481"
                  required 
                />
              </div>

              {/* LONGITUDE */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Longitude (Garis Bujur)</label>
                <input 
                  type="number"
                  step="any"
                  value={longitude} 
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono"
                  placeholder="106.824294"
                  required 
                />
              </div>
            </div>

            {/* RADIUS JARAK */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Radius Toleransi Jarak Jangkauan (Meter)</label>
              <div className="relative flex items-center">
                <input 
                  type="number" 
                  value={radius} 
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium pr-14"
                  placeholder="100"
                  min="10"
                  required 
                />
                <span className="absolute right-3 text-xs font-bold text-gray-400 pointer-events-none">Meter</span>
              </div>
              <p className="text-gray-400 text-[10px] mt-1">Direkomendasikan <b>100 Meter</b> untuk menutupi seluruh gedung sekolah dan mengantisipasi deviasi akurasi GPS pada gawai siswa.</p>
            </div>
          </div>

          {/* SIMPAN */}
          <div className="flex justify-end pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Perubahan Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}