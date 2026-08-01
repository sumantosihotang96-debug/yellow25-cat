'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface Soal {
  id: string;
  pertanyaan: string;
  gambar_soal?: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  opsi_e?: string;
  gambar_a?: string;
  gambar_b?: string;
  gambar_c?: string;
  gambar_d?: string;
  gambar_e?: string;
  jawaban_benar: string;
}

interface DetailJadwal {
  id: string;
  mapel: {
    nama_mapel: string;
  } | null;
}

export default function ReviewJawabanPage() {
  const router = useRouter();
  const params = useParams();
  const idJadwal = params.id as string;

  const [detailJadwal, setDetailJadwal] = useState<DetailJadwal | null>(null);
  const [listSoal, setListSoal] = useState<Soal[]>([]);
  const [jawabanSiswa, setJawabanSiswa] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchReviewData = async () => {
      if (typeof window === 'undefined') return;
      const siswaId = localStorage.getItem('session_siswa_id');
      
      if (!siswaId) {
        router.replace('/login-siswa');
        return;
      }

      try {
        // 1. Ambil Detail Jadwal
        const { data: dataJadwal, error: errJadwal } = await supabase
          .from('jadwal_ujian')
          .select('id, mapel_id, mapel(nama_mapel)')
          .eq('id', idJadwal)
          .maybeSingle();

        if (errJadwal || !dataJadwal) {
          setErrorMsg('Detail jadwal tidak ditemukan.');
          return;
        }

        setDetailJadwal(dataJadwal as unknown as DetailJadwal);

        // 2. Ambil Semua Soal untuk Mapel ini
        const { data: dataSoal, error: errSoal } = await supabase
          .from('soal')
          .select('*')
          .eq('id_mapel', dataJadwal.mapel_id);

        if (errSoal || !dataSoal) {
          setErrorMsg('Gagal mengambil daftar soal.');
          return;
        }

        // 3. Ambil Jawaban yang Pernah Disimpan oleh Siswa
        const { data: dataJawaban } = await supabase
          .from('jawaban_siswa')
          .select('id_soal, jawaban_terpilih')
          .eq('id_siswa', siswaId)
          .eq('id_jadwal', idJadwal);

        const mapJawaban: { [key: string]: string } = {};
        if (dataJawaban) {
          dataJawaban.forEach((item) => {
            mapJawaban[item.id_soal] = item.jawaban_terpilih;
          });
        }

        setListSoal(dataSoal);
        setJawabanSiswa(mapJawaban);
      } catch (err) {
        console.error(err);
        setErrorMsg('Terjadi kesalahan saat memuat rekam jawaban.');
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();
  }, [idJadwal, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400 tracking-widest uppercase animate-pulse">
        ⏳ Memuat Pembahasan Ujian...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-red-500 p-4">
        {errorMsg}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Pembahasan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
              Pembahasan & Rekam Jawaban
            </span>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">
              {detailJadwal?.mapel?.nama_mapel || 'Ujian'}
            </h1>
          </div>
          <button
            onClick={() => router.back()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs"
          >
            ⬅️ Kembali
          </button>
        </div>

        {/* Daftar Soal & Jawaban */}
        <div className="space-y-6">
          {listSoal.map((soal, idx) => {
            const jawabanPilihanSiswa = jawabanSiswa[soal.id] || '-';
            const kunciJawaban = (soal.jawaban_benar || '').trim().toUpperCase();
            const isBenar = jawabanPilihanSiswa.toUpperCase() === kunciJawaban;

            return (
              <div
                key={soal.id}
                className={`bg-white p-6 rounded-2xl border shadow-sm space-y-4 ${
                  isBenar ? 'border-emerald-200' : 'border-rose-200'
                }`}
              >
                {/* Status Badge Soal */}
                <div className="flex justify-between items-center">
                  <span className="bg-slate-100 text-slate-700 text-xs font-black px-3 py-1 rounded-lg">
                    Soal No. {idx + 1}
                  </span>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-lg ${
                      isBenar
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}
                  >
                    {isBenar ? '✅ Jawaban Benar' : '❌ Jawaban Salah / Tidak Diisi'}
                  </span>
                </div>

                {/* Pertanyaan */}
                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                  {soal.pertanyaan}
                </p>

                {/* Gambar Soal jika ada */}
                {soal.gambar_soal && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                    <img
                      src={soal.gambar_soal}
                      alt="Gambar Soal"
                      className="max-h-52 object-contain rounded"
                    />
                  </div>
                )}

                {/* Opsi Pilihan Jawaban */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                    const textOpsi = (soal as any)[`opsi_${letter.toLowerCase()}`];
                    const imgOpsi = (soal as any)[`gambar_${letter.toLowerCase()}`];
                    if (!textOpsi) return null;

                    const isDipilihSiswa = jawabanPilihanSiswa.toUpperCase() === letter;
                    const isKunci = kunciJawaban === letter;

                    let styleOpsi = 'bg-slate-50 border-slate-200 text-slate-600';
                    if (isKunci) {
                      // Opsi yang merupakan kunci jawaban diberi warna hijau
                      styleOpsi = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
                    } else if (isDipilihSiswa && !isBenar) {
                      // Opsi yang dipilih siswa tetapi SALAH diberi warna merah
                      styleOpsi = 'bg-rose-50 border-rose-500 text-rose-900 font-bold';
                    }

                    return (
                      <div
                        key={letter}
                        className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 ${styleOpsi}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-6 h-6 flex items-center justify-center rounded-md font-bold text-xs shrink-0 ${
                                isKunci
                                  ? 'bg-emerald-600 text-white'
                                  : isDipilihSiswa
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white border text-slate-500'
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="text-sm">{textOpsi}</span>
                          </div>

                          {/* Tag penanda */}
                          <div className="flex gap-1.5 text-[10px] font-black uppercase">
                            {isDipilihSiswa && (
                              <span className="bg-slate-900 text-white px-2 py-0.5 rounded">
                                Pilihan Anda
                              </span>
                            )}
                            {isKunci && (
                              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded">
                                Kunci Jawaban
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Gambar opsi jika ada */}
                        {imgOpsi && (
                          <div className="ml-9 p-1 bg-white rounded border border-slate-200 inline-block max-w-xs">
                            <img
                              src={imgOpsi}
                              alt={`Opsi ${letter}`}
                              className="max-h-24 object-contain"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}