'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface MapelDiampu {
  id: string;
  nama_mapel: string;
  kelas: string;
  jurusan: string;
}

export default function BankSoalGuruPage() {
  const router = useRouter();
  const [mapelOptions, setMapelOptions] = useState<MapelDiampu[]>([]);
  const [mapelTerpilih, setMapelTerpilih] = useState('');
  const [isiSoal, setIsiSoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const ambilMapelOtomatis = async () => {
      try {
        if (typeof window !== 'undefined') {
          const idGuru = localStorage.getItem('session_guru_id');

          // Jika sesi tidak ada, arahkan kembali ke halaman login (sesuaikan rute jika folder Anda /login)
          if (!idGuru) {
            router.push('/login');
            return;
          }

          // INTEGRASI: Mengambil data mapel yang dialokasikan Admin dari tabel guru_mapel
          const { data, error } = await supabase
            .from('guru_mapel')
            .select('mapel_id, mapel(id, nama_mapel, kelas, jurusan)')
            .eq('guru_id', idGuru);

          if (error) throw error;

          if (data) {
            const listFormatted = data.map((item: any) => ({
              id: item.mapel.id,
              nama_mapel: item.mapel.nama_mapel,
              kelas: item.mapel.kelas,
              jurusan: item.mapel.jurusan,
            }));
            
            setMapelOptions(listFormatted);
            
            // Otomatis memilih mapel pertama sebagai default select option
            if (listFormatted.length > 0) {
              setMapelTerpilih(listFormatted[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Gagal menyinkronkan data mapel dari admin:', err);
      } finally {
        setFetching(false);
      }
    };

    ambilMapelOtomatis();
  }, [router]);

  const handleSimpanSoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapelTerpilih || !isiSoal) return;
    setLoading(true);

    try {
      // Menyimpan butir soal baru dengan mengunci id_mapel murni dari data Admin
      const { error } = await supabase
        .from('soal')
        .insert([
          {
            id_mapel: mapelTerpilih, 
            pertanyaan: isiSoal,
          }
        ]);

      if (error) throw error;

      alert('🎉 Butir soal berhasil disimpan ke Bank Soal Kurikulum!');
      setIsiSoal('');
    } catch (error: any) {
      alert(`❌ Gagal menyimpan soal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Input Bank Soal Baru</h1>
        <p className="text-gray-500 text-xs mt-1">
          Daftar pilihan mata pelajaran di bawah ini dikelola langsung secara terintegrasi oleh Admin Utama.
        </p>
        
        <form onSubmit={handleSimpanSoal} className="space-y-4 mt-6 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mata Pelajaran (Otomatis Sesuai Tugas Anda)</label>
            
            {fetching ? (
              <div className="text-xs text-gray-400 animate-pulse py-2">Menyinkronkan data kompetensi dari database...</div>
            ) : mapelOptions.length === 0 ? (
              <div className="p-3 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold border border-amber-200">
                ⚠️ Anda belum ditugaskan untuk mengampu mapel apa pun oleh Admin. Silakan hubungi Admin untuk diselaraskan.
              </div>
            ) : (
              <select
                value={mapelTerpilih}
                onChange={(e) => setMapelTerpilih(e.target.value)}
                className="w-full p-2.5 border rounded-lg bg-white text-gray-950 font-medium shadow-sm outline-none focus:border-blue-500"
              >
                {mapelOptions.map((mapel) => (
                  <option key={mapel.id} value={mapel.id}>
                    {mapel.nama_mapel} — Kelas {mapel.kelas} ({mapel.jurusan})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Isi/Teks Pertanyaan Soal</label>
            <textarea
              rows={5}
              required
              value={isiSoal}
              onChange={(e) => setIsiSoal(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white text-gray-950 font-medium placeholder-gray-400 focus:border-blue-500 outline-none"
              placeholder="Ketikkan materi soal ujian di sini..."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || mapelOptions.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-all shadow-md"
            >
              {loading ? 'Memproses...' : 'Simpan ke Bank Soal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}