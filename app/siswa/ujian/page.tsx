'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface ExamSchedule {
  id: string;
  tanggal_ujian: string;
  jam_mulai: string;
  durasi_menit: number;
  jumlah_soal_tampil: number;
  mapel: {
    nama_mapel: string;
    kelas: string | null;
    jurusan: string | null;
    status_mapel: string | null;
  } | null;
}

const normalize = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isUniversal = (value: string) => ['', 'umum', 'semua', 'all'].includes(value);

const matchesClass = (studentClass: string, targetClass?: string | null) => {
  const studentTokens = normalize(studentClass).split(' ').filter(Boolean);
  const targetTokens = normalize(targetClass).split(' ').filter(Boolean);

  if (!targetTokens.length || isUniversal(targetTokens.join(' '))) return true;
  if (!studentTokens.length) return false;

  // Grade-only targets (X/XI/XII) match the grade token, not arbitrary substrings.
  if (targetTokens.length === 1) return studentTokens[0] === targetTokens[0];
  return targetTokens.every((token) => studentTokens.includes(token));
};

const getToday = () => {
  const offset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - offset).toISOString().slice(0, 10);
};

export default function UjianPage() {
  const router = useRouter();
  const [studentName, setStudentName] = useState('Siswa');
  const [studentClass, setStudentClass] = useState('');
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const studentId = localStorage.getItem('session_siswa_id');
      if (!studentId || ['null', 'undefined'].includes(studentId)) {
        router.replace('/login-siswa');
        return;
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('nama_lengkap, kelas, agama, mapel_pilihan')
          .eq('id', studentId)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error('Profil siswa tidak ditemukan.');

        const fullClass = profile.kelas || localStorage.getItem('session_siswa_kelas_lengkap') || '';
        const classTokens = normalize(fullClass).split(' ').filter(Boolean);
        const studentMajor = normalize(localStorage.getItem('session_siswa_jurusan')) || classTokens[1] || '';
        const religion = normalize(profile.agama);
        const elective = normalize(profile.mapel_pilihan);

        const { data, error: scheduleError } = await supabase
          .from('jadwal_ujian')
          .select('id, tanggal_ujian, jam_mulai, durasi_menit, jumlah_soal_tampil, mapel(nama_mapel, kelas, jurusan, status_mapel)')
          .eq('tanggal_ujian', getToday())
          .order('jam_mulai', { ascending: true });

        if (scheduleError) throw scheduleError;

        const matching = ((data ?? []) as unknown as ExamSchedule[]).filter((item) => {
          const subject = item.mapel;
          if (!subject || !matchesClass(fullClass, subject.kelas)) return false;

          const targetMajor = normalize(subject.jurusan);
          if (!isUniversal(targetMajor)) {
            const majorMatches = !!studentMajor && (
              studentMajor === targetMajor || classTokens.includes(targetMajor)
            );
            if (!majorMatches) return false;
          }

          const subjectStatus = normalize(subject.status_mapel);
          return isUniversal(subjectStatus) || subjectStatus === religion || subjectStatus === elective;
        });

        if (!cancelled) {
          setStudentName(profile.nama_lengkap || localStorage.getItem('session_siswa_nama') || 'Siswa');
          setStudentClass(fullClass || 'Belum diatur');
          setSchedules(matching);
        }
      } catch (loadError) {
        console.error('Gagal memuat jadwal ujian:', loadError);
        if (!cancelled) setError('Jadwal ujian gagal dimuat. Silakan coba muat ulang halaman.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-sky-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-600">Portal siswa</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Jadwal Ujian</h1>
            <p className="mt-1 text-sm text-slate-500">{studentName} · {studentClass || 'Memuat kelas...'}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-white/80 px-4 py-2 text-center shadow-sm backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Hari ini</p>
            <p className="text-lg font-black text-indigo-600">{schedules.length}</p>
          </div>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-white bg-white/80 p-10 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-4 text-sm font-bold text-slate-600">Memuat jadwal dari server...</p>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
        ) : schedules.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-8 text-center shadow-sm">
            <div className="text-3xl">📚</div>
            <h2 className="mt-3 text-lg font-black text-slate-800">Belum ada ujian yang sesuai hari ini</h2>
            <p className="mt-2 text-sm text-slate-500">Jadwal untuk kelas, jurusan, atau mata pelajaran Anda belum tersedia.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((exam) => (
              <article key={exam.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.6)] backdrop-blur-sm">
                <div className="h-2 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" />
                <div className="p-4 md:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Ujian terjadwal</p>
                      <h2 className="mt-2 text-xl font-black text-slate-900 md:text-2xl">{exam.mapel?.nama_mapel || 'Mata Pelajaran'}</h2>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">Terjadwal</span>
                  </div>

                  <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tanggal</p><p className="mt-1 text-sm font-bold text-slate-800">{exam.tanggal_ujian}</p></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Jam mulai</p><p className="mt-1 text-sm font-bold text-slate-800">{exam.jam_mulai} WIB</p></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Durasi</p><p className="mt-1 text-sm font-bold text-slate-800">{exam.durasi_menit} menit</p></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Jumlah soal</p><p className="mt-1 text-sm font-bold text-slate-800">{exam.jumlah_soal_tampil} soal</p></div>
                  </div>

                  <button
                    onClick={() => router.push('/siswa/dashboard')}
                    className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg transition hover:from-indigo-700 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                  >
                    Buka dashboard untuk token dan verifikasi lokasi
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
