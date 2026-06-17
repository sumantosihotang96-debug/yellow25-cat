'use client';

import { useEffect, useState, useCallback } from 'react';
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
  mapel_id: string;
  token_ujian: string;
  tanggal_ujian: string; 
  jam_mulai: string;      
  durasi_menit: number;
  jumlah_soal_tampil: number;
  mapel: {
    nama_mapel: string;
    kelas: string | null;
    jurusan: string | null;
  } | null;
}

export default function LembarUjianPage() {
  const router = useRouter();
  const params = useParams();
  const idJadwal = params.id as string;

  const [namaSiswa, setNamaSiswa] = useState<string>(''); 
  const [kelasSiswa, setKelasSiswa] = useState<string>(''); 
  
  const [detailJadwal, setDetailJadwal] = useState<DetailJadwal | null>(null);
  const [listSoalUjian, setListSoalUjian] = useState<Soal[]>([]);
  const [jawabanSiswa, setJawabanSiswa] = useState<{ [key: string]: string }>({});
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [nomorAktif, setNomorAktif] = useState(0);
  const [sisaDetik, setSisaDetik] = useState<number | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pelanggaranCount, setPelanggaranCount] = useState(0);
  const [isFullScreenRequired, setIsFullScreenRequired] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showPelanggaranPopup, setShowPelanggaranPopup] = useState(false);
  const [isForceSubmitted, setIsForceSubmitted] = useState(false);
  const [soalBelumDijawab, setSoalBelumDijawab] = useState<number[]>([]);

  // 📈 EVALUASI SKOR AKHIR DAN SIMPAN
  const eksekusiKirimJawabanAkhir = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setShowConfirmSubmit(false);
    
    try {
      const uuidSiswaLogin = localStorage.getItem('session_siswa_id');
      const namaSiswaLocal = localStorage.getItem('session_siswa_nama');
      const kelasLocal = localStorage.getItem('session_siswa_kelas_lengkap');
      
      if (!uuidSiswaLogin) {
        alert('Sesi Anda telah berakhir. Gagal menyimpan nilai.');
        router.push('/login-siswa');
        return;
      }

      let namaSiswaTerbaru = namaSiswa || namaSiswaLocal || 'Siswa Tanpa Nama';
      let kelasSiswaTerbaru = kelasSiswa || (kelasLocal ? kelasLocal.trim().toUpperCase() : 'UMUM');

      const { data: profileDb, error: errorProfile } = await supabase
        .from('profiles')
        .select('nama_lengkap, kelas')
        .eq('id', uuidSiswaLogin)
        .maybeSingle();

      if (errorProfile) {
        console.error('Gagal mengambil data terbaru dari tabel profiles:', errorProfile);
      }

      if (profileDb) {
        if (profileDb.nama_lengkap) namaSiswaTerbaru = profileDb.nama_lengkap;
        if (profileDb.kelas) {
          kelasSiswaTerbaru = profileDb.kelas.trim().toUpperCase();
          localStorage.setItem('session_siswa_kelas_lengkap', kelasSiswaTerbaru);
        }
      }

      let jumlahBenar = 0;
      let jumlahSalah = 0;

      listSoalUjian.forEach((soal) => {
        const jawabanSiswaTerpilih = jawabanSiswa[soal.id];
        if (
          jawabanSiswaTerpilih && 
          soal.jawaban_benar && 
          jawabanSiswaTerpilih.toUpperCase() === soal.jawaban_benar.trim().toUpperCase()
        ) {
          jumlahBenar++;
        } else {
          jumlahSalah++;
        }
      });

      const totalSoal = listSoalUjian.length;
      const nilaiAkhir = totalSoal > 0 ? Math.round((jumlahBenar / totalSoal) * 100) : 0;

      const { error: errorUpsert } = await supabase
        .from('nilai_siswa')
        .upsert({
          id_siswa: uuidSiswaLogin,      
          id_jadwal: idJadwal,
          nama_siswa: namaSiswaTerbaru,  
          kelas: kelasSiswaTerbaru, 
          jumlah_benar: jumlahBenar,
          jumlah_salah: jumlahSalah,
          nilai: nilaiAkhir,
          created_at: new Date().toISOString()
        }, { onConflict: 'id_siswa,id_jadwal' });

      if (errorUpsert) {
        console.error('Gagal melakukan upsert ke nilai_siswa:', errorUpsert);
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      
      router.push('/siswa/dashboard');
    } catch (err) {
      console.error('Terjadi kesalahan fatal:', err);
      router.push('/siswa/dashboard');
    } finally {
      setSubmitting(false);
    }
  }, [idJadwal, listSoalUjian, jawabanSiswa, namaSiswa, kelasSiswa, router, submitting]);

  // 1. Validasi Sesi Pengguna & Ambil Soal
  useEffect(() => {
    const inisialisasiSesiSiswa = async () => {
      if (typeof window === 'undefined') return;
      const siswaId = localStorage.getItem('session_siswa_id');
      if (!siswaId) {
        router.replace('/login-siswa');
        return;
      }

      try {
        const { data: sudahAdaNilai } = await supabase
          .from('nilai_siswa')
          .select('id')
          .eq('id_siswa', siswaId)
          .eq('id_jadwal', idJadwal)
          .maybeSingle();

        if (sudahAdaNilai) {
          setErrorMsg('🚫 Anda sudah menyelesaikan ujian ini dan tidak diperbolehkan masuk kembali.');
          setLoading(false);
          setTimeout(() => router.replace('/siswa/dashboard'), 3000);
          return;
        }

        const { data: dataProfil } = await supabase
          .from('profiles') 
          .select('nama_lengkap, kelas')
          .eq('id', siswaId)
          .maybeSingle();

        let kelasUtuhSiswa = 'UMUM';
        let tingkatKelas = '';
        let jurusanTarget = '';

        if (dataProfil) {
          setNamaSiswa(dataProfil.nama_lengkap || 'Siswa Tanpa Nama');
          
          if (dataProfil.kelas) {
            kelasUtuhSiswa = dataProfil.kelas.trim().toUpperCase();
            setKelasSiswa(kelasUtuhSiswa);
            localStorage.setItem('session_siswa_kelas_lengkap', kelasUtuhSiswa);

            const bagianKelas = kelasUtuhSiswa.split(/\s+/);
            tingkatKelas = bagianKelas[0] ? bagianKelas[0].trim() : ''; 
            jurusanTarget = bagianKelas[1] ? bagianKelas[1].trim() : ''; 
          } else {
            setKelasSiswa('UMUM');
          }
        }

        if (idJadwal) {
          const { data: dataJadwal, error: errorJadwal } = await supabase
            .from('jadwal_ujian')
            .select('id, mapel_id, token_ujian, tanggal_ujian, jam_mulai, durasi_menit, jumlah_soal_tampil, mapel(nama_mapel, kelas, jurusan)')
            .eq('id', idJadwal)
            .maybeSingle();

          if (errorJadwal || !dataJadwal) {
            setErrorMsg('❌ Jadwal ujian tidak ditemukan.');
            return;
          }

          const jadwal = dataJadwal as unknown as DetailJadwal;
          setDetailJadwal(jadwal);

          const mapelIdString = String(jadwal.mapel_id).trim();

          let querySoal = supabase
            .from('soal')
            .select('*')
            .eq('id_mapel', mapelIdString);

          if (tingkatKelas) {
            querySoal = querySoal.or(`kelas_target.eq."${tingkatKelas}",kelas_target.eq."${kelasUtuhSiswa}",kelas_target.eq.UMUM,kelas_target.is.null`);
          }

          if (jurusanTarget) {
            querySoal = querySoal.or(`jurusan_target.eq."${jurusanTarget}",jurusan_target.eq.UMUM,jurusan_target.is.null`);
          }

          const { data: dataSoal, error: errorSoal } = await querySoal;

          if (errorSoal || !dataSoal || dataSoal.length === 0) {
            setErrorMsg(`⚠️ Tidak ditemukan butir soal yang cocok untuk mata pelajaran ini pada kriteria kelas/jurusan Anda (${kelasUtuhSiswa}).`);
            return;
          }

          const { data: riwayatLama } = await supabase
            .from('jawaban_siswa')
            .select('id_soal, jawaban_terpilih')
            .eq('id_siswa', siswaId)
            .eq('id_jadwal', idJadwal);

          if (riwayatLama && riwayatLama.length > 0) {
            const mappingJawaban: { [key: string]: string } = {};
            riwayatLama.forEach(row => { mappingJawaban[row.id_soal] = row.jawaban_terpilih; });
            setJawabanSiswa(mappingJawaban);
          }

          setListSoalUjian(dataSoal.slice(0, jadwal.jumlah_soal_tampil));
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Gagal terhubung dengan server database.');
      } finally {
        setLoading(false);
      }
    };

    inisialisasiSesiSiswa();
  }, [idJadwal, router]);

  // Trigger otomatis mengunci layar penuh
  useEffect(() => {
    if (!loading && !errorMsg && typeof window !== 'undefined') {
      const lockInitialFullscreen = async () => {
        try {
          const elem = document.documentElement;
          if (elem.requestFullscreen && !document.fullscreenElement) {
            await elem.requestFullscreen();
          }
        } catch {
          console.log("Gagal mengunci fullscreen otomatis awal.");
        }
      };
      lockInitialFullscreen();
    }
  }, [loading, errorMsg]);

  // 2. Timer Hitung Mundur Realtime
  useEffect(() => {
    if (!detailJadwal) return;

    const hitungMundurWaktuAktual = () => {
      try {
        let formatJamClean = detailJadwal.jam_mulai.trim().replace(/\./g, ':');
        if (formatJamClean.split(':').length === 2) formatJamClean = `${formatJamClean}:00`;

        const targetString = `${detailJadwal.tanggal_ujian.trim()}T${formatJamClean}`;
        const waktuSelesaiEpoch = new Date(targetString).getTime() + (detailJadwal.durasi_menit * 60000);
        const selisihDetikReal = Math.floor((waktuSelesaiEpoch - new Date().getTime()) / 1000);

        if (selisihDetikReal <= 0) {
          setSisaDetik(0);
          eksekusiKirimJawabanAkhir();
        } else {
          setSisaDetik(selisihDetikReal);
        }
      } catch (error) {
        console.error('Error parsing datetime scheduler:', error);
      }
    };

    hitungMundurWaktuAktual();
    const intervalId = setInterval(hitungMundurWaktuAktual, 1000);
    return () => clearInterval(intervalId);
  }, [detailJadwal, eksekusiKirimJawabanAkhir]);

  // 3. Sistem Proteksi Jendela browser
  useEffect(() => {
    if (loading || errorMsg || isForceSubmitted) return;

    const tanganiPelanggaranLayar = () => {
      setPelanggaranCount((prev) => {
        const updateNilai = prev + 1;
        if (updateNilai >= 3) {
          setIsForceSubmitted(true);
          setShowPelanggaranPopup(false);
          eksekusiKirimJawabanAkhir();
        } else {
          setShowPelanggaranPopup(true);
        }
        return updateNilai;
      });
    };

    const handleFullScreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreenRequired(true);
        tanganiPelanggaranLayar();
      } else {
        setIsFullScreenRequired(false);
      }
    };

    const handleWindowBlur = () => {
      if (document.fullscreenElement) {
        tanganiPelanggaranLayar();
      }
    };

    const handleKeydownBanned = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'a', 'v', 'f', 'p'].includes(e.key.toLowerCase())) || 
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeydownBanned);
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeydownBanned);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [loading, errorMsg, isForceSubmitted, eksekusiKirimJawabanAkhir]);

  const handlePemicuSubmitPopUp = () => {
    const terlewat: number[] = [];
    listSoalUjian.forEach((soal, index) => {
      if (!jawabanSiswa[soal.id]) {
        terlewat.push(index + 1);
      }
    });
    setSoalBelumDijawab(terlewat);
    setShowConfirmSubmit(true);
  };

  const handlePilihJawaban = async (idSoal: string, hurufOpsi: string) => {
    setJawabanSiswa(prev => ({ ...prev, [idSoal]: hurufOpsi }));
    try {
      const siswaId = localStorage.getItem('session_siswa_id');
      if (!siswaId) return;

      await supabase.from('jawaban_siswa').upsert({
        id_siswa: siswaId,
        id_jadwal: idJadwal,
        id_soal: idSoal,
        jawaban_terpilih: hurufOpsi,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id_siswa,id_jadwal,id_soal' });
    } catch (dbErr) {
      console.error(dbErr);
    }
  };

  const paksaKembaliFullScreen = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) await element.requestFullscreen();
      setIsFullScreenRequired(false);
      setShowPelanggaranPopup(false);
    } catch {}
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400 tracking-widest uppercase animate-pulse">⏳ Menyiapkan Lembar Berkas...</div>;
  if (errorMsg) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-red-500 text-center p-4">{errorMsg}</div>;

  const soalSaatIni = listSoalUjian[nomorAktif];
  const jam = Math.floor((sisaDetik || 0) / 3600).toString().padStart(2, '0');
  const menit = Math.floor(((sisaDetik || 0) % 3600) / 60).toString().padStart(2, '0');
  const detik = ((sisaDetik || 0) % 60).toString().padStart(2, '0');

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800 pb-28 select-none relative unselectable">
      
      {pelanggaranCount > 0 && (
        <div className="max-w-5xl mx-auto mb-3 bg-red-50 border border-red-200 text-red-600 text-xs py-2.5 px-4 rounded-xl font-bold flex justify-between items-center shadow-sm">
          <span>⚠️ Terdeteksi keluar dari fokus area lembar pengerjaan!</span>
          <span>Pelanggaran: {pelanggaranCount} / 3</span>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center text-xs">
          <div>
            <p className="font-black text-indigo-600 uppercase tracking-wider text-sm">
              {detailJadwal?.mapel ? detailJadwal.mapel.nama_mapel : 'Mata Pelajaran'}
            </p>
            <p className="text-slate-400 mt-0.5">Siswa: {namaSiswa} ({kelasSiswa})</p>
          </div>
          <div className="font-mono font-black px-4 py-2 bg-slate-900 border border-slate-900 text-amber-400 rounded-xl text-sm tracking-wider shadow-sm">
            ⏱️ {`${jam}:${menit}:${detik}`}
          </div>
        </div>

        {soalSaatIni && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-3">
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-1 rounded border border-indigo-100 uppercase tracking-wider">
                Soal {nomorAktif + 1} dari {listSoalUjian.length}
              </span>
              <p className="text-sm md:text-base font-semibold text-slate-800 leading-relaxed user-select-none">{soalSaatIni.pertanyaan}</p>
              
              {soalSaatIni.gambar_soal && (
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                  <img src={soalSaatIni.gambar_soal} alt="soal" className="max-h-60 object-contain rounded pointer-events-none" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs">
              {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                const textOpsi = (soalSaatIni as any)[`opsi_${letter.toLowerCase()}`];
                const imgOpsi = (soalSaatIni as any)[`gambar_${letter.toLowerCase()}`];
                
                if (!textOpsi) return null;
                const terpilih = jawabanSiswa[soalSaatIni.id] === letter;

                return (
                  <button
                    key={letter}
                    onClick={() => handlePilihJawaban(soalSaatIni.id, letter)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-3 items-start ${
                      terpilih 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-sm' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-lg font-black text-xs shrink-0 ${terpilih ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-400'}`}>
                        {letter}
                      </span>
                      <span className="text-sm font-medium">{textOpsi}</span>
                    </div>

                    {imgOpsi && (
                      <div className="mt-1 ml-10 p-1.5 bg-white rounded-lg border border-slate-200 inline-block max-w-xs overflow-hidden shadow-xs">
                        <img src={imgOpsi} alt={`Pilihan ${letter}`} className="max-h-32 object-contain rounded-md pointer-events-none" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                disabled={nomorAktif === 0}
                onClick={() => setNomorAktif(p => p - 1)}
                className="bg-white border border-slate-200 text-slate-600 font-bold px-4 py-2.5 rounded-xl text-xs disabled:opacity-20 transition hover:bg-slate-50 shadow-sm"
              >
                ⬅️ Sebelumnya
              </button>

              {nomorAktif === listSoalUjian.length - 1 ? (
                <button 
                  disabled={submitting}
                  onClick={handlePemicuSubmitPopUp} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-sm"
                >
                  🏁 Selesai & Kirim
                </button>
              ) : (
                <button 
                  onClick={() => setNomorAktif(p => p + 1)} 
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm"
                >
                  Berikutnya ➡️
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FLOATING ACTION GRID */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {isNavOpen && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xl mb-4 w-64 grid grid-cols-5 gap-2 transition-all duration-200">
            {listSoalUjian.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setNomorAktif(idx)}
                className={`w-full aspect-square flex items-center justify-center rounded-xl text-xs font-black font-mono border transition-all ${
                  idx === nomorAktif 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : jawabanSiswa[s.id] 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        )}
        <button 
          onClick={() => setIsNavOpen(!isNavOpen)} 
          className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center shadow-lg text-lg"
        >
          {isNavOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* POP-UP MODAL: KONFIRMASI KIRIM */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-md w-full space-y-5 shadow-2xl text-center">
            <span className="text-4xl block">📋</span>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 tracking-wide">Kumpulkan Lembar Jawaban?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Pastikan seluruh butir pertanyaan telah Anda periksa kembali dengan teliti sebelum mengirim berkas.</p>
            </div>

            {soalBelumDijawab.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left space-y-1.5">
                <span className="text-xs font-bold text-amber-800 block">⚠️ Perhatian! Ada {soalBelumDijawab.length} soal belum dijawab:</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                  {soalBelumDijawab.map((no) => (
                    <span 
                      key={no} 
                      onClick={() => { setNomorAktif(no - 1); setShowConfirmSubmit(false); }}
                      className="bg-white border border-amber-300 text-amber-700 font-mono font-bold text-[11px] px-2 py-0.5 rounded-md cursor-pointer hover:bg-amber-100 transition shadow-xs"
                    >
                      No. {no}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-emerald-700 text-xs font-bold">
                🎉 Semua soal sudah terisi dengan baik!
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowConfirmSubmit(false)}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-3 rounded-xl text-xs transition"
              >
                Periksa Kembali
              </button>
              <button 
                onClick={eksekusiKirimJawabanAkhir}
                disabled={submitting}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition"
              >
                {submitting ? 'Mengirim...' : 'Ya, Kirim Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL: DETEKSI PELANGGARAN */}
      {showPelanggaranPopup && !isFullScreenRequired && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <span className="text-3xl block">⚠️</span>
            <h3 className="text-sm font-black text-red-600 uppercase tracking-wider">Deteksi Pelanggaran Fokus</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Sistem mencatat Anda meninggalkan jendela ujian.</p>
            <div className="bg-red-50 text-red-600 font-bold p-3 rounded-xl text-xs border border-red-200">
              Total Pelanggaran: {pelanggaranCount} / 3
            </div>
            <button 
              onClick={() => setShowPelanggaranPopup(false)} 
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-widest shadow-md transition"
            >
              Saya Mengerti, Lanjutkan
            </button>
          </div>
        </div>
      )}

      {/* POP-UP MODAL: LOCK FULLSCREEN */}
      {isFullScreenRequired && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <span className="text-3xl block">🚨</span>
            <h3 className="text-sm font-black text-red-600 uppercase tracking-wider">Aturan Layar Penuh</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Anda tidak diizinkan memperkecil browser selama ujian berlangsung.</p>
            <div className="bg-red-50 text-red-600 font-bold p-2.5 rounded-xl text-xs border border-red-200 font-mono">
              Pelanggaran: {pelanggaranCount} / 3
            </div>
            <button onClick={paksaKembaliFullScreen} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-widest shadow-md transition">
              Kembalikan Layar Penuh 🔐
            </button>
          </div>
        </div>
      )}
    </div>
  );
}