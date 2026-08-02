'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface Soal {
  id: string;
  pertanyaan: string;
  gambar_soal?: string | null;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  opsi_e?: string | null;
  gambar_a?: string | null;
  gambar_b?: string | null;
  gambar_c?: string | null;
  gambar_d?: string | null;
  gambar_e?: string | null;
  jawaban_benar: string;
  created_at?: string;
}

interface DetailJadwal {
  id: string;
  mapel_id: string;
  tanggal_ujian: string;
  jam_mulai: string;
  durasi_menit: number;
  jumlah_soal_tampil: number;
  mapel: {
    nama_mapel: string;
    kelas: string | null;
    jurusan: string | null;
    acak_soal?: boolean;
  } | null;
}

// Helper Pengacakan Soal (Fisher-Yates)
const acakArray = <T,>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default function LembarUjianPage() {
  const router = useRouter();
  const params = useParams();
  
  // Mengambil [id] langsung dari rute dinamis URL
  const idJadwal = params?.id as string;

  const [namaSiswa, setNamaSiswa] = useState<string>('');
  const [detailJadwal, setDetailJadwal] = useState<DetailJadwal | null>(null);
  const [listSoalUjian, setListSoalUjian] = useState<Soal[]>([]);
  const [jawabanSiswa, setJawabanSiswa] = useState<{ [key: string]: string }>({});

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [nomorAktif, setNomorAktif] = useState(0);
  const [sisaDetik, setSisaDetik] = useState<number | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [maxPelanggaran, setMaxPelanggaran] = useState<number>(3);
  const [hasAgreedRules, setHasAgreedRules] = useState(false);

  // Status Pelanggaran
  const [pelanggaranCount, setPelanggaranCount] = useState<number>(0);

  const [isFullScreenRequired, setIsFullScreenRequired] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showPelanggaranPopup, setShowPelanggaranPopup] = useState(false);
  const [isForceSubmitted, setIsForceSubmitted] = useState(false);
  const [soalBelumDijawab, setSoalBelumDijawab] = useState<number[]>([]);

  const isInteractingRef = useRef(false);

  // 📈 EVALUASI SKOR AKHIR DAN SIMPAN
  const eksekusiKirimJawabanAkhir = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setShowConfirmSubmit(false);

    try {
      const uuidSiswaLogin = localStorage.getItem('session_siswa_id');
      if (!uuidSiswaLogin) {
        alert('Sesi Anda telah berakhir. Gagal menyimpan nilai.');
        router.push('/login-siswa');
        return;
      }

      let namaSiswaTerbaru = namaSiswa || localStorage.getItem('session_siswa_nama') || 'Siswa Tanpa Nama';
      let kelasSiswaTerbaru = localStorage.getItem('session_siswa_kelas_lengkap') || 'UMUM';

      const { data: profileDb } = await supabase
        .from('profiles')
        .select('nama_lengkap, kelas')
        .eq('id', uuidSiswaLogin)
        .maybeSingle();

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

      // Ambil jumlah pelanggaran dari state paling baru
      const currentPelanggaran = parseInt(localStorage.getItem(`pelanggaran_${idJadwal}`) || '0', 10);

      await supabase
        .from('nilai_siswa')
        .upsert({
          id_siswa: uuidSiswaLogin,
          id_jadwal: idJadwal,
          nama_siswa: namaSiswaTerbaru,
          kelas: kelasSiswaTerbaru,
          jumlah_benar: jumlahBenar,
          jumlah_salah: jumlahSalah,
          nilai: nilaiAkhir,
          jumlah_pelanggaran: currentPelanggaran,
          created_at: new Date().toISOString()
        }, { onConflict: 'id_siswa,id_jadwal' });

      localStorage.removeItem(`backup_jawaban_${idJadwal}`);
      localStorage.removeItem(`pelanggaran_${idJadwal}`);
      localStorage.removeItem(`urutan_soal_${idJadwal}_${uuidSiswaLogin}`);

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }

      router.push('/siswa/dashboard');
    } catch (err) {
      console.error('Terjadi kesalahan fatal saat submit:', err);
      router.push('/siswa/dashboard');
    } finally {
      setSubmitting(false);
    }
  }, [idJadwal, listSoalUjian, jawabanSiswa, namaSiswa, router, submitting]);

  // 1. Validasi Sesi & Fetch Data
  useEffect(() => {
    const inisialisasiSesiSiswa = async () => {
      if (typeof window === 'undefined' || !idJadwal) return;
      const siswaId = localStorage.getItem('session_siswa_id');
      if (!siswaId) {
        router.replace('/login-siswa');
        return;
      }

      try {
        const { data: config } = await supabase
          .from('pengaturan_global')
          .select('maksimal_pelanggaran')
          .maybeSingle();

        if (config?.maksimal_pelanggaran) {
          setMaxPelanggaran(config.maksimal_pelanggaran);
        }

        // Cek riwayat nilai / pelanggaran yang sudah ada di Supabase
        const { data: sudahAdaNilai } = await supabase
          .from('nilai_siswa')
          .select('id, jumlah_pelanggaran, nilai')
          .eq('id_siswa', siswaId)
          .eq('id_jadwal', idJadwal)
          .maybeSingle();

        if (sudahAdaNilai && sudahAdaNilai.nilai !== null && sudahAdaNilai.nilai !== undefined) {
          setErrorMsg('🚫 Anda sudah menyelesaikan ujian ini dan tidak diperbolehkan masuk kembali.');
          setLoading(false);
          setTimeout(() => router.replace('/siswa/dashboard'), 3000);
          return;
        }

        // Sinkronkan riwayat pelanggaran dari Supabase / LocalStorage
        let initialPelanggaran = 0;
        if (sudahAdaNilai?.jumlah_pelanggaran) {
          initialPelanggaran = sudahAdaNilai.jumlah_pelanggaran;
        } else {
          const savedLocal = localStorage.getItem(`pelanggaran_${idJadwal}`);
          if (savedLocal) initialPelanggaran = parseInt(savedLocal, 10);
        }
        setPelanggaranCount(initialPelanggaran);
        localStorage.setItem(`pelanggaran_${idJadwal}`, initialPelanggaran.toString());

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
            localStorage.setItem('session_siswa_kelas_lengkap', kelasUtuhSiswa);

            const bagianKelas = kelasUtuhSiswa.split(/\s+/);
            tingkatKelas = bagianKelas[0] ? bagianKelas[0].trim() : '';
            jurusanTarget = bagianKelas[1] ? bagianKelas[1].trim() : '';
          }
        }

        const { data: dataJadwal, error: errorJadwal } = await supabase
          .from('jadwal_ujian')
          .select('id, mapel_id, tanggal_ujian, jam_mulai, durasi_menit, jumlah_soal_tampil, mapel(nama_mapel, kelas, jurusan, acak_soal)')
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
          setErrorMsg(`⚠️ Tidak ditemukan butir soal yang cocok untuk kriteria kelas Anda (${kelasUtuhSiswa}).`);
          return;
        }

        const localBackup = localStorage.getItem(`backup_jawaban_${idJadwal}`);
        let mappingJawaban: { [key: string]: string } = localBackup ? JSON.parse(localBackup) : {};

        const { data: riwayatLama } = await supabase
          .from('jawaban_siswa')
          .select('id_soal, jawaban_terpilih')
          .eq('id_siswa', siswaId)
          .eq('id_jadwal', idJadwal);

        if (riwayatLama && riwayatLama.length > 0) {
          riwayatLama.forEach((row) => {
            mappingJawaban[row.id_soal] = row.jawaban_terpilih;
          });
        }

        setJawabanSiswa(mappingJawaban);

        // LOGIKA URUTAN / ACAK SOAL KONSISTEN PER SISWA
        let finalSoalList: Soal[] = [];
        const storageKeyUrutan = `urutan_soal_${idJadwal}_${siswaId}`;
        const savedOrderJson = localStorage.getItem(storageKeyUrutan);

        if (jadwal.mapel?.acak_soal) {
          if (savedOrderJson) {
            const savedOrderIds: string[] = JSON.parse(savedOrderJson);
            const soalMap = new Map<string, Soal>(dataSoal.map((s) => [s.id, s]));
            
            finalSoalList = savedOrderIds
              .map((id) => soalMap.get(id))
              .filter((s): s is Soal => s !== undefined);

            if (finalSoalList.length < dataSoal.length) {
              const missingSoal = dataSoal.filter((s) => !savedOrderIds.includes(s.id));
              finalSoalList = [...finalSoalList, ...missingSoal];
            }
          } else {
            const randomized = acakArray(dataSoal);
            const limitedRandom = randomized.slice(0, jadwal.jumlah_soal_tampil);
            const orderIds = limitedRandom.map((s) => s.id);
            localStorage.setItem(storageKeyUrutan, JSON.stringify(orderIds));
            finalSoalList = limitedRandom;
          }
        } else {
          finalSoalList = [...dataSoal].sort((a, b) => a.id.localeCompare(b.id));
        }

        setListSoalUjian(finalSoalList.slice(0, jadwal.jumlah_soal_tampil));
      } catch (err) {
        console.error(err);
        setErrorMsg('Gagal terhubung dengan server database.');
      } finally {
        setLoading(false);
      }
    };

    inisialisasiSesiSiswa();
  }, [idJadwal, router]);

  const handleMulaiUjianUlasan = async () => {
    isInteractingRef.current = true;
    setHasAgreedRules(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      console.log('Fullscreen dipicu manual.');
    }
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 500);
  };

  // 2. Timer Hitung Mundur
  useEffect(() => {
    if (!detailJadwal || !hasAgreedRules) return;

    const hitungMundurWaktuAktual = () => {
      try {
        let formatJamClean = detailJadwal.jam_mulai.trim().replace(/\./g, ':');
        if (formatJamClean.split(':').length === 2) formatJamClean = `${formatJamClean}:00`;

        const targetString = `${detailJadwal.tanggal_ujian.trim()}T${formatJamClean}`;
        const waktuSelesaiEpoch = new Date(targetString).getTime() + (detailJadwal.durasi_menit * 60000);
        const selisihDetikReal = Math.floor((waktuSelesaiEpoch - Date.now()) / 1000);

        if (selisihDetikReal <= 0) {
          setSisaDetik(0);
          eksekusiKirimJawabanAkhir();
        } else {
          setSisaDetik(selisihDetikReal);
        }
      } catch (error) {
        console.error('Error parsing datetime:', error);
      }
    };

    hitungMundurWaktuAktual();
    const intervalId = setInterval(hitungMundurWaktuAktual, 1000);
    return () => clearInterval(intervalId);
  }, [detailJadwal, hasAgreedRules, eksekusiKirimJawabanAkhir]);

  // 🔄 FUNGSI UPDATE PELANGGARAN KE DB SECARA REAL-TIME
  const simpanPelanggaranKeDb = async (count: number) => {
    try {
      const siswaId = localStorage.getItem('session_siswa_id');
      if (!siswaId || !idJadwal) return;

      const namaSiswaTerbaru = namaSiswa || localStorage.getItem('session_siswa_nama') || 'Siswa';
      const kelasSiswaTerbaru = localStorage.getItem('session_siswa_kelas_lengkap') || 'UMUM';

      await supabase.from('nilai_siswa').upsert({
        id_siswa: siswaId,
        id_jadwal: idJadwal,
        nama_siswa: namaSiswaTerbaru,
        kelas: kelasSiswaTerbaru,
        jumlah_pelanggaran: count,
      }, { onConflict: 'id_siswa,id_jadwal' });
    } catch (err) {
      console.error('Gagal update pelanggaran ke DB:', err);
    }
  };

  // 3. Anti-Cheat Guard (Ditingkatkan)
  useEffect(() => {
    if (loading || errorMsg || isForceSubmitted || !hasAgreedRules) return;

    const tanganiPelanggaranLayar = () => {
      if (isInteractingRef.current) return;

      setPelanggaranCount((prev) => {
        const updateNilai = prev + 1;
        localStorage.setItem(`pelanggaran_${idJadwal}`, updateNilai.toString());

        // Simpan langsung jumlah pelanggaran ke Supabase
        simpanPelanggaranKeDb(updateNilai);

        if (updateNilai >= maxPelanggaran) {
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

    const handleWindowBlur = () => tanganiPelanggaranLayar();
    const handleVisibilityChange = () => {
      if (document.hidden) tanganiPelanggaranLayar();
    };

    const handleKeydownBanned = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'a', 'v', 'f', 'p', 's'].includes(e.key.toLowerCase())) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeydownBanned);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeydownBanned);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [loading, errorMsg, isForceSubmitted, hasAgreedRules, maxPelanggaran, idJadwal, eksekusiKirimJawabanAkhir]);

  const handlePemicuSubmitPopUp = () => {
    isInteractingRef.current = true;
    const terlewat: number[] = [];
    listSoalUjian.forEach((soal, index) => {
      if (!jawabanSiswa[soal.id]) {
        terlewat.push(index + 1);
      }
    });
    setSoalBelumDijawab(terlewat);
    setShowConfirmSubmit(true);
    setTimeout(() => { isInteractingRef.current = false; }, 500);
  };

  const handlePilihJawaban = async (idSoal: string, hurufOpsi: string) => {
    const updatedJawaban = { ...jawabanSiswa, [idSoal]: hurufOpsi };
    setJawabanSiswa(updatedJawaban);
    localStorage.setItem(`backup_jawaban_${idJadwal}`, JSON.stringify(updatedJawaban));

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
      console.error('Gagal sinkronisasi jawaban ke Supabase:', dbErr);
    }
  };

  const paksaKembaliFullScreen = async () => {
    isInteractingRef.current = true;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullScreenRequired(false);
      setShowPelanggaranPopup(false);
    } catch {}
    setTimeout(() => { isInteractingRef.current = false; }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400 tracking-widest uppercase animate-pulse">
        ⏳ Menyiapkan Lembar Berkas...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-red-500 text-center p-4">
        {errorMsg}
      </div>
    );
  }

  const soalSaatIni = listSoalUjian[nomorAktif];
  const jam = Math.floor((sisaDetik || 0) / 3600).toString().padStart(2, '0');
  const menit = Math.floor(((sisaDetik || 0) % 3600) / 60).toString().padStart(2, '0');
  const detik = ((sisaDetik || 0) % 60).toString().padStart(2, '0');

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800 pb-28 select-none relative">
      
      {/* POP-UP ATURAN UJIAN */}
      {!hasAgreedRules && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl max-w-lg w-full space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <span className="text-4xl block">🛡️</span>
              <h2 className="text-lg font-black text-slate-900 tracking-wide">
                PETUNJUK & ATURAN UJIAN
              </h2>
              <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">
                Mata Pelajaran: {detailJadwal?.mapel?.nama_mapel || 'Ujian Online'}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3 leading-relaxed text-slate-700">
              <p className="font-bold text-slate-900">Harap diperhatikan aturan keamanan berikut:</p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
                <li>Layar akan dikunci dalam mode <strong className="text-slate-800">Layar Penuh (Fullscreen)</strong>.</li>
                <li><strong className="text-red-600">Dilarang</strong> berpindah tab, membuka aplikasi lain, atau memperkecil browser.</li>
                <li>Fitur <strong className="text-red-600">Copy-Paste</strong> dan klik kanan telah dinonaktifkan.</li>
                <li>Batas toleransi pelanggaran adalah <strong className="text-red-600">{maxPelanggaran} Kali</strong>.</li>
                <li>Jika melanggar {maxPelanggaran} kali, sistem akan <strong className="text-red-600">MEMAKSA MENGUMPULKAN</strong> seluruh jawaban Anda secara otomatis.</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 font-medium">
              💡 Pastikan koneksi internet Anda stabil dan tidak ada notifikasi aplikasi lain yang mengganggu.
            </div>

            <button
              onClick={handleMulaiUjianUlasan}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl text-xs uppercase tracking-widest shadow-lg transition duration-200"
            >
              Saya Mengerti & Mulai Ujian 🚀
            </button>
          </div>
        </div>
      )}

      {/* INDIKATOR PELANGGARAN */}
      {pelanggaranCount > 0 && (
        <div className="max-w-5xl mx-auto mb-3 bg-red-50 border border-red-200 text-red-600 text-xs py-2.5 px-4 rounded-xl font-bold flex justify-between items-center shadow-sm">
          <span>⚠️ Terdeteksi keluar dari fokus area lembar pengerjaan!</span>
          <span>Pelanggaran: {pelanggaranCount} / {maxPelanggaran}</span>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header Informasi */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center text-xs">
          <div>
            <p className="font-black text-indigo-600 uppercase tracking-wider text-sm">
              {detailJadwal?.mapel ? detailJadwal.mapel.nama_mapel : 'Mata Pelajaran'}
            </p>
            <p className="text-slate-400 mt-0.5">Siswa: {namaSiswa || 'Siswa'}</p>
          </div>
          <div className="font-mono font-black px-4 py-2 bg-slate-900 border border-slate-900 text-amber-400 rounded-xl text-sm tracking-wider shadow-sm">
            ⏱️ {`${jam}:${menit}:${detik}`}
          </div>
        </div>

        {/* Kotak Soal */}
        {soalSaatIni && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-3">
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-1 rounded border border-indigo-100 uppercase tracking-wider">
                Soal {nomorAktif + 1} dari {listSoalUjian.length}
              </span>
              <p className="text-sm md:text-base font-semibold text-slate-800 leading-relaxed">
                {soalSaatIni.pertanyaan}
              </p>

              {soalSaatIni.gambar_soal && (
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                  <img src={soalSaatIni.gambar_soal} alt="Gambar Soal" className="max-h-60 object-contain rounded pointer-events-none" />
                </div>
              )}
            </div>

            {/* Opsi Jawaban */}
            <div className="grid grid-cols-1 gap-3 text-xs">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
                const textKey = `opsi_${letter.toLowerCase()}` as keyof Soal;
                const imgKey = `gambar_${letter.toLowerCase()}` as keyof Soal;

                const textOpsi = soalSaatIni[textKey] as string | undefined;
                const imgOpsi = soalSaatIni[imgKey] as string | undefined;

                if (!textOpsi && !imgOpsi) return null;
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
                      <span className={`w-7 h-7 flex items-center justify-center rounded-lg font-black text-xs shrink-0 ${
                        terpilih ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-400'
                      }`}>
                        {letter}
                      </span>
                      <span className="text-sm font-medium">{textOpsi || '-'}</span>
                    </div>

                    {imgOpsi && (
                      <div className="mt-1 ml-10 p-1.5 bg-white rounded-lg border border-slate-200 inline-block max-w-xs overflow-hidden">
                        <img src={imgOpsi} alt={`Opsi ${letter}`} className="max-h-32 object-contain rounded-md pointer-events-none" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Navigasi Soal */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                disabled={nomorAktif === 0}
                onClick={() => setNomorAktif((p) => p - 1)}
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
                  onClick={() => setNomorAktif((p) => p + 1)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm"
                >
                  Berikutnya ➡️
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Navigasi Nomor Soal */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {isNavOpen && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xl mb-4 w-64 grid grid-cols-5 gap-2 transition-all duration-200 max-h-80 overflow-y-auto">
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

      {/* MODAL: KONFIRMASI SUBMIT */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-md w-full space-y-5 shadow-2xl text-center">
            <span className="text-4xl block">📋</span>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 tracking-wide">Kumpulkan Lembar Jawaban?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pastikan seluruh butir pertanyaan telah Anda periksa kembali dengan teliti sebelum mengirim berkas.
              </p>
            </div>

            {soalBelumDijawab.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left space-y-1.5">
                <span className="text-xs font-bold text-amber-800 block">⚠️ Perhatian! Ada {soalBelumDijawab.length} soal belum dijawab:</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                  {soalBelumDijawab.map((no) => (
                    <span
                      key={no}
                      onClick={() => {
                        setNomorAktif(no - 1);
                        setShowConfirmSubmit(false);
                      }}
                      className="bg-white border border-amber-300 text-amber-700 font-mono font-bold text-[11px] px-2 py-0.5 rounded-md cursor-pointer hover:bg-amber-100 transition"
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

      {/* MODAL: PELANGGARAN FOKUS */}
      {showPelanggaranPopup && !isFullScreenRequired && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <span className="text-3xl block">⚠️</span>
            <h3 className="text-sm font-black text-red-600 uppercase tracking-wider">Deteksi Pelanggaran Fokus</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Sistem mencatat Anda meninggalkan jendela ujian.</p>
            <div className="bg-red-50 text-red-600 font-bold p-3 rounded-xl text-xs border border-red-200">
              Total Pelanggaran: {pelanggaranCount} / {maxPelanggaran}
            </div>
            <button
              onClick={() => {
                isInteractingRef.current = true;
                setShowPelanggaranPopup(false);
                setTimeout(() => { isInteractingRef.current = false; }, 500);
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-widest shadow-md transition"
            >
              Saya Mengerti, Lanjutkan
            </button>
          </div>
        </div>
      )}

      {/* MODAL: FULLSCREEN REQUIRED */}
      {isFullScreenRequired && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <span className="text-3xl block">🚨</span>
            <h3 className="text-sm font-black text-red-600 uppercase tracking-wider">Aturan Layar Penuh</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Anda tidak diizinkan memperkecil browser selama ujian berlangsung.</p>
            <div className="bg-red-50 text-red-600 font-bold p-2.5 rounded-xl text-xs border border-red-200 font-mono">
              Pelanggaran: {pelanggaranCount} / {maxPelanggaran}
            </div>
            <button
              onClick={paksaKembaliFullScreen}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-widest shadow-md transition"
            >
              Kembalikan Layar Penuh 🔐
            </button>
          </div>
        </div>
      )}
    </div>
  );
}