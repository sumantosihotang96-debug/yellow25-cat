'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface Question {
  id: string;
  group_id?: string | null;
  pertanyaan: string;
  gambar_soal?: string | null;
  opsi_a?: string | null;
  opsi_b?: string | null;
  opsi_c?: string | null;
  opsi_d?: string | null;
  opsi_e?: string | null;
  gambar_a?: string | null;
  gambar_b?: string | null;
  gambar_c?: string | null;
  gambar_d?: string | null;
  gambar_e?: string | null;
  jawaban_benar: string;
  status_khusus?: string | null;
  kelas_target?: string | null;
  jurusan_target?: string | null;
  created_at?: string | null;
}

interface ExamSchedule {
  id: string;
  mapel_id: string;
  tanggal_ujian: string;
  jam_mulai: string;
  durasi_menit: number;
  jumlah_soal_tampil: number;
  token_ujian: string;
  mapel: {
    id: string;
    nama_mapel: string;
    kelas: string | null;
    jurusan: string | null;
    status_mapel?: string | null;
    acak_soal?: boolean;
  } | null;
}

const normalize = (value?: string | null) =>
  (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const isUniversal = (value: string) => ['', 'umum', 'semua', 'all'].includes(value);

function classMatches(studentClass: string, targetClass?: string | null) {
  const student = normalize(studentClass).split(' ').filter(Boolean);
  const target = normalize(targetClass).split(' ').filter(Boolean);
  if (!target.length || isUniversal(target.join(' '))) return true;
  if (!student.length) return false;
  // Class targets in the question bank are commonly grade-only (X/XI/XII).
  if (target.length === 1) return student[0] === target[0] || student.includes(target[0]);
  return target.every((part) => student.includes(part));
}

function majorMatches(studentMajor: string, studentClass: string, targetMajor?: string | null) {
  const target = normalize(targetMajor);
  if (isUniversal(target)) return true;
  const major = normalize(studentMajor);
  const classTokens = normalize(studentClass).split(' ').filter(Boolean);
  return !!target && (major === target || classTokens.includes(target));
}

function questionMatchesStudent(question: Question, studentClass: string, studentMajor: string) {
  return classMatches(studentClass, question.kelas_target) &&
    majorMatches(studentMajor, studentClass, question.jurusan_target);
}

function groupQuestions(questions: Question[]): Question[][] {
  const groups = new Map<string, Question[]>();
  for (const question of questions) {
    const groupKey = question.group_id?.trim() ? `group:${question.group_id.trim()}` : `single:${question.id}`;
    const group = groups.get(groupKey) ?? [];
    group.push(question);
    groups.set(groupKey, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => {
      if (a.created_at && b.created_at) return a.created_at.localeCompare(b.created_at);
      return a.id.localeCompare(b.id);
    });
  }
  return [...groups.values()];
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

// Keep related question groups intact instead of cutting a stimulus group at the quota boundary.
function selectWholeGroups(groups: Question[][], quota: number): Question[] {
  const result: Question[] = [];
  for (const group of groups) {
    if (result.length >= quota) break;
    result.push(...group);
  }
  return result;
}

function getExamTimes(exam: ExamSchedule) {
  const time = exam.jam_mulai.trim().replace(/\./g, ':');
  const normalizedTime = time.split(':').length === 2 ? `${time}:00` : time;
  const start = new Date(`${exam.tanggal_ujian.trim()}T${normalizedTime}+07:00`).getTime();
  return { start, end: start + Number(exam.durasi_menit) * 60_000 };
}

function readJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function LembarUjianPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const scheduleId = params?.id;

  const [studentName, setStudentName] = useState('Siswa');
  const [exam, setExam] = useState<ExamSchedule | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [unanswered, setUnanswered] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [maxViolations, setMaxViolations] = useState(3);
  const [violations, setViolations] = useState(0);
  const [violationOpen, setViolationOpen] = useState(false);

  const answersRef = useRef<Record<string, string>>({});
  const questionsRef = useRef<Question[]>([]);
  const studentNameRef = useRef(studentName);
  const submittingRef = useRef(false);
  const interactionRef = useRef(false);
  const violationCountRef = useRef(0);
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const storageKey = (studentId: string) => `backup_jawaban_${scheduleId}_${studentId}`;
  const orderKey = (studentId: string) => `urutan_soal_${scheduleId}_${studentId}`;

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { studentNameRef.current = studentName; }, [studentName]);
  useEffect(() => { violationCountRef.current = violations; }, [violations]);

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return;
    try {
      await wakeLockRef.current.release();
    } catch (releaseError) {
      console.warn('Tidak dapat melepas wake lock:', releaseError);
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (wakeError) {
      console.info('Wake lock tidak tersedia pada perangkat ini:', wakeError);
    }
  }, []);

  const syncAnswer = useCallback(async (studentId: string, questionId: string, answer: string) => {
    const { error: syncError } = await supabase.from('jawaban_siswa').upsert({
      id_siswa: studentId,
      id_jadwal: scheduleId,
      id_soal: questionId,
      jawaban_terpilih: answer,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id_siswa,id_jadwal,id_soal' });
    if (syncError) throw syncError;
  }, [scheduleId]);

  const submitExam = useCallback(async () => {
    if (submittingRef.current || !exam || questionsRef.current.length === 0) return;

    const studentId = localStorage.getItem('session_siswa_id');
    if (!studentId) {
      router.replace('/login-siswa');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSaveError('');
    setSubmitOpen(false);

    try {
      // Flush pending debounce writes and persist all answers before saving the score.
      for (const timer of debounceTimersRef.current.values()) clearTimeout(timer);
      debounceTimersRef.current.clear();

      const answerMap = answersRef.current;
      const answerRows = questionsRef.current
        .filter((question) => answerMap[question.id])
        .map((question) => ({
          id_siswa: studentId,
          id_jadwal: scheduleId,
          id_soal: question.id,
          jawaban_terpilih: answerMap[question.id],
          updated_at: new Date().toISOString(),
        }));

      if (answerRows.length) {
        const { error: answerError } = await supabase.from('jawaban_siswa').upsert(answerRows, {
          onConflict: 'id_siswa,id_jadwal,id_soal',
        });
        if (answerError) throw answerError;
      }

      let correct = 0;
      for (const question of questionsRef.current) {
        const selected = answerMap[question.id]?.trim().toUpperCase();
        if (selected && selected === question.jawaban_benar?.trim().toUpperCase()) correct++;
      }

      const { error: scoreError } = await supabase.from('nilai_siswa').upsert({
        id_siswa: studentId,
        id_jadwal: scheduleId,
        nama_siswa: studentNameRef.current || localStorage.getItem('session_siswa_nama') || 'Siswa',
        kelas: localStorage.getItem('session_siswa_kelas_lengkap') || 'UMUM',
        jumlah_benar: correct,
        jumlah_salah: questionsRef.current.length - correct,
        nilai: Math.round((correct / questionsRef.current.length) * 100),
        jumlah_pelanggaran: violationCountRef.current,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id_siswa,id_jadwal' });
      if (scoreError) throw scoreError;

      localStorage.removeItem(storageKey(studentId));
      localStorage.removeItem(`pelanggaran_${scheduleId}_${studentId}`);
      localStorage.removeItem(orderKey(studentId));
      localStorage.removeItem('session_token_aktif');
      await releaseWakeLock();
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      router.replace('/siswa/dashboard');
    } catch (submitError) {
      console.error('Gagal mengirim jawaban ujian:', submitError);
      setSaveError('Jawaban belum berhasil tersimpan. Periksa koneksi, lalu coba kirim lagi. Jawaban lokal tetap dipertahankan.');
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [exam, scheduleId, router, releaseWakeLock, storageKey, orderKey]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      if (!scheduleId) {
        setError('ID jadwal ujian tidak valid.');
        setLoading(false);
        return;
      }

      const studentId = localStorage.getItem('session_siswa_id');
      if (!studentId || ['null', 'undefined'].includes(studentId)) {
        router.replace('/login-siswa');
        return;
      }

      try {
        const [profileResult, scheduleResult, configResult, scoreResult] = await Promise.all([
          supabase.from('profiles').select('nama_lengkap, kelas, agama, mapel_pilihan').eq('id', studentId).maybeSingle(),
          supabase.from('jadwal_ujian').select(`id, mapel_id, tanggal_ujian, jam_mulai, durasi_menit, jumlah_soal_tampil, token_ujian, mapel(id, nama_mapel, kelas, jurusan, status_mapel, acak_soal)`).eq('id', scheduleId).maybeSingle(),
          supabase.from('pengaturan_global').select('maksimal_pelanggaran').maybeSingle(),
          supabase.from('nilai_siswa').select('id, jumlah_pelanggaran, nilai').eq('id_siswa', studentId).eq('id_jadwal', scheduleId).maybeSingle(),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (scheduleResult.error) throw scheduleResult.error;
        if (scoreResult.error) throw scoreResult.error;
        if (!profileResult.data) throw new Error('Profil siswa tidak ditemukan.');
        if (!scheduleResult.data) throw new Error('Jadwal ujian tidak ditemukan.');
        if (scoreResult.data?.nilai !== null && scoreResult.data?.nilai !== undefined) throw new Error('Anda sudah menyelesaikan ujian ini.');

        const profile = profileResult.data;
        const rawSchedule = scheduleResult.data;
        const subject = Array.isArray(rawSchedule.mapel) ? rawSchedule.mapel[0] : rawSchedule.mapel;
        if (!subject) throw new Error('Mata pelajaran pada jadwal ini tidak ditemukan.');

        const normalizedExam = { ...rawSchedule, mapel: subject } as unknown as ExamSchedule;
        const studentClass = profile.kelas || localStorage.getItem('session_siswa_kelas_lengkap') || '';
        if (!studentClass) throw new Error('Kelas siswa belum diatur pada profil. Hubungi admin sekolah.');

        // The dashboard checks token and geofence. Require the issued token again here so a direct URL
        // cannot accidentally bypass that flow. This is not a substitute for server-side authorization.
        const issuedToken = localStorage.getItem('session_token_aktif')?.trim().toUpperCase();
        if (!issuedToken || issuedToken !== String(normalizedExam.token_ujian ?? '').trim().toUpperCase()) {
          throw new Error('Token ujian belum diverifikasi. Kembali ke dashboard dan masukkan token ujian.');
        }

        const { start, end } = getExamTimes(normalizedExam);
        const now = Date.now();
        if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Tanggal atau waktu jadwal ujian tidak valid.');
        if (now < start || now > end) throw new Error('Ujian belum dimulai atau waktu pengerjaan sudah berakhir.');

        const studentClassTokens = normalize(studentClass).split(' ').filter(Boolean);
        const studentMajor = normalize(localStorage.getItem('session_siswa_jurusan')) || studentClassTokens[1] || '';
        if (!classMatches(studentClass, subject.kelas) || !majorMatches(studentMajor, studentClass, subject.jurusan)) {
          throw new Error('Jadwal ujian ini tidak sesuai dengan kelas atau jurusan Anda.');
        }

        const examStatus = normalize(subject.status_mapel);
        const religion = normalize(profile.agama);
        const elective = normalize(profile.mapel_pilihan);
        if (!isUniversal(examStatus) && examStatus !== religion && examStatus !== elective) {
          throw new Error('Jadwal ujian ini tidak sesuai dengan mata pelajaran khusus pada profil Anda.');
        }

        if (cancelled) return;
        setExam(normalizedExam);
        setStudentName(profile.nama_lengkap || 'Siswa');
        if (configResult.data?.maksimal_pelanggaran) setMaxViolations(Number(configResult.data.maksimal_pelanggaran));

        const localViolation = Number.parseInt(localStorage.getItem(`pelanggaran_${scheduleId}_${studentId}`) || '0', 10);
        const initialViolations = Number(scoreResult.data?.jumlah_pelanggaran) || localViolation || 0;
        setViolations(initialViolations);
        violationCountRef.current = initialViolations;
        localStorage.setItem(`pelanggaran_${scheduleId}_${studentId}`, String(initialViolations));
        localStorage.setItem('session_siswa_kelas_lengkap', studentClass);

        // Supabase's configured row limit can silently omit the rest of a large question bank;
        // explicitly fetch in pages and stop only when the final short page is received.
        const pageSize = 500;
        const allQuestions: Question[] = [];
        for (let offset = 0; ; offset += pageSize) {
          const { data: page, error: questionError } = await supabase
            .from('soal')
            .select('*')
            .eq('id_mapel', String(normalizedExam.mapel_id).trim())
            .range(offset, offset + pageSize - 1);
          if (questionError) throw questionError;
          allQuestions.push(...((page ?? []) as Question[]));
          if (!page || page.length < pageSize) break;
        }

        const studentQuestions = allQuestions.filter((question) =>
          questionMatchesStudent(question, studentClass, studentMajor)
        );
        const eligibleQuestions = studentQuestions.filter((question) => {
          const specialQuestionStatus = normalize(question.status_khusus);
          if (isUniversal(specialQuestionStatus)) return true;
          if (isUniversal(examStatus)) return false;
          return specialQuestionStatus === examStatus && (examStatus === religion || examStatus === elective);
        });

        if (!eligibleQuestions.length) {
          throw new Error(`Belum ada soal yang cocok untuk kelas, jurusan, dan mata pelajaran Anda (${studentClass}). Minta guru/admin memeriksa target soal.`);
        }

        const quota = Math.max(1, Number(normalizedExam.jumlah_soal_tampil) || eligibleQuestions.length);
        const studentOrderKey = orderKey(studentId);
        const savedOrder = readJson<unknown>(localStorage.getItem(studentOrderKey), []);
        let orderedQuestions: Question[];

        if (normalizedExam.mapel?.acak_soal) {
          const questionMap = new Map(eligibleQuestions.map((question) => [question.id, question]));
          const savedIds = Array.isArray(savedOrder) ? savedOrder.filter((id): id is string => typeof id === 'string') : [];
          const resumed = savedIds.map((id) => questionMap.get(id)).filter((question): question is Question => !!question);
          const existingIds = new Set(resumed.map((question) => question.id));
          const remaining = eligibleQuestions.filter((question) => !existingIds.has(question.id));
          const groups = groupQuestions([...resumed, ...shuffle(remaining)]);
          // If resuming, keep saved sequence as much as possible; group order may be reassembled to avoid splitting groups.
          orderedQuestions = selectWholeGroups(groups, quota);
          if (!savedIds.length || orderedQuestions.length !== resumed.length) {
            localStorage.setItem(studentOrderKey, JSON.stringify(orderedQuestions.map((question) => question.id)));
          }
        } else {
          orderedQuestions = selectWholeGroups(groupQuestions(eligibleQuestions), quota);
        }

        if (!orderedQuestions.length) throw new Error('Tidak ada soal yang dapat ditampilkan untuk jadwal ini.');
        if (cancelled) return;

        const backup = readJson<Record<string, string>>(localStorage.getItem(storageKey(studentId)), {});
        const validQuestionIds = new Set(orderedQuestions.map((question) => question.id));
        const restoredAnswers: Record<string, string> = {};
        for (const [questionId, answer] of Object.entries(backup)) {
          if (validQuestionIds.has(questionId) && /^[A-E]$/i.test(answer)) restoredAnswers[questionId] = answer.toUpperCase();
        }

        const { data: savedAnswers, error: savedAnswerError } = await supabase
          .from('jawaban_siswa')
          .select('id_soal, jawaban_terpilih')
          .eq('id_siswa', studentId)
          .eq('id_jadwal', scheduleId);
        if (savedAnswerError) throw savedAnswerError;
        for (const row of savedAnswers ?? []) {
          if (validQuestionIds.has(row.id_soal) && !restoredAnswers[row.id_soal] && /^[A-E]$/i.test(row.jawaban_terpilih ?? '')) {
            restoredAnswers[row.id_soal] = row.jawaban_terpilih.toUpperCase();
          }
        }

        setAnswers(restoredAnswers);
        answersRef.current = restoredAnswers;
        setQuestions(orderedQuestions);
        questionsRef.current = orderedQuestions;
      } catch (initializeError) {
        console.error('Gagal menyiapkan ujian:', initializeError);
        if (!cancelled) setError(initializeError instanceof Error ? initializeError.message : 'Gagal memuat ujian. Silakan coba lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initialize();
    return () => {
      cancelled = true;
      for (const timer of debounceTimersRef.current.values()) clearTimeout(timer);
      debounceTimersRef.current.clear();
      void releaseWakeLock();
    };
  }, [scheduleId, router, orderKey, storageKey, releaseWakeLock]);

  useEffect(() => {
    if (!exam || !agreed) return;
    const tick = () => {
      const { end } = getExamTimes(exam);
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) void submitExam();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [exam, agreed, submitExam]);

  useEffect(() => {
    if (!agreed) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [agreed, requestWakeLock]);

  useEffect(() => {
    if (!agreed || submitting) return;
    const reportViolation = () => {
      if (interactionRef.current || document.visibilityState === 'hidden') return;
      setViolations((previous) => {
        const next = previous + 1;
        violationCountRef.current = next;
        const studentId = localStorage.getItem('session_siswa_id');
        if (studentId) localStorage.setItem(`pelanggaran_${scheduleId}_${studentId}`, String(next));
        if (next >= maxViolations) {
          setViolationOpen(false);
          void submitExam();
        } else {
          setViolationOpen(true);
        }
        return next;
      });
    };
    const onFullscreen = () => { if (!document.fullscreenElement) reportViolation(); };
    const onBlur = () => { if (document.visibilityState === 'visible') reportViolation(); };
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('blur', onBlur);
    };
  }, [agreed, submitting, maxViolations, scheduleId, submitExam]);

  const chooseAnswer = (questionId: string, answer: string) => {
    const updated = { ...answersRef.current, [questionId]: answer };
    answersRef.current = updated;
    setAnswers(updated);
    const studentId = localStorage.getItem('session_siswa_id');
    if (!studentId) return;

    localStorage.setItem(storageKey(studentId), JSON.stringify(updated));
    const previousTimer = debounceTimersRef.current.get(questionId);
    if (previousTimer) clearTimeout(previousTimer);
    const timer = setTimeout(async () => {
      setSyncing(true);
      setSaveError('');
      try {
        await syncAnswer(studentId, questionId, answer);
      } catch (syncError) {
        console.error('Jawaban belum tersinkron:', syncError);
        setSaveError('Koneksi terputus; jawaban tersimpan sementara di perangkat dan akan dikirim saat ujian dikumpulkan.');
      } finally {
        debounceTimersRef.current.delete(questionId);
        setSyncing(debounceTimersRef.current.size > 0);
      }
    }, 1000);
    debounceTimersRef.current.set(questionId, timer);
  };

  const beginExam = async () => {
    interactionRef.current = true;
    setAgreed(true);
    await requestWakeLock();
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (fullscreenError) {
      console.info('Fullscreen tidak tersedia; ujian tetap dapat dilanjutkan.', fullscreenError);
    } finally {
      setTimeout(() => { interactionRef.current = false; }, 500);
    }
  };

  const requestSubmit = () => {
    interactionRef.current = true;
    setUnanswered(questions.map((question, index) => answersRef.current[question.id] ? -1 : index + 1).filter((number) => number > 0));
    setSubmitOpen(true);
    setTimeout(() => { interactionRef.current = false; }, 500);
  };

  const returnToFullscreen = async () => {
    interactionRef.current = true;
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      setViolationOpen(false);
      await requestWakeLock();
    } catch (fullscreenError) {
      console.info('Perangkat tidak mendukung fullscreen.', fullscreenError);
    } finally {
      setTimeout(() => { interactionRef.current = false; }, 500);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-sky-50 p-6 text-center">
        <div><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /><p className="mt-4 text-sm font-bold text-slate-700">Menyiapkan ujian...</p></div>
      </main>
    );
  }

  if (error || !exam || !questions.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-lg">
          <div className="text-3xl">⚠️</div>
          <h1 className="mt-3 text-lg font-black text-slate-900">Ujian belum dapat dibuka</h1>
          <p role="alert" className="mt-2 text-sm leading-relaxed text-rose-700">{error || 'Tidak ada soal untuk ujian ini.'}</p>
          <button onClick={() => router.replace('/siswa/dashboard')} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Kembali ke dashboard</button>
        </section>
      </main>
    );
  }

  const currentQuestion = questions[activeIndex];
  const totalSeconds = secondsLeft ?? 0;
  const clock = [Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60]
    .map((part) => String(part).padStart(2, '0')).join(':');

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-sky-50 px-3 py-4 pb-28 text-slate-800 sm:px-5 md:p-6 md:pb-10">
      {!agreed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <section className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
            <div className="text-center">
              <span className="text-4xl">🛡️</span>
              <h1 className="mt-2 text-lg font-black text-slate-900">Petunjuk dan aturan ujian</h1>
              <p className="mt-1 text-xs font-bold uppercase text-indigo-600">{exam.mapel?.nama_mapel || 'Ujian'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              Waktu ujian dihitung sesuai jadwal. Jawaban disimpan pada perangkat dan disinkronkan ke server. Pastikan koneksi internet tetap tersedia.
            </div>
            <button onClick={beginExam} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 p-3.5 text-sm font-black text-white shadow-lg">Saya mengerti, mulai ujian</button>
          </section>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-4">
        <header className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-lg backdrop-blur-xl sm:p-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase tracking-wide text-indigo-600">{exam.mapel?.nama_mapel}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{studentName} · {questions.length} soal</p>
          </div>
          <div className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 font-mono text-sm font-black text-amber-300" aria-live="polite">⏱ {clock}</div>
        </header>

        {violations > 0 && (
          <div className="flex justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            <span>Perhatian: keluar dari layar ujian terdeteksi.</span><span>{violations}/{maxViolations}</span>
          </div>
        )}
        {(syncing || saveError) && (
          <p role="status" className={`rounded-xl px-4 py-2 text-xs font-semibold ${saveError ? 'bg-amber-50 text-amber-800' : 'bg-white text-slate-500'}`}>
            {saveError || 'Menyinkronkan jawaban...'}
          </p>
        )}

        <section className="rounded-[26px] border border-slate-200/80 bg-white/95 p-4 shadow-xl sm:p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">Soal {activeIndex + 1} dari {questions.length}</span>
            <span className="text-xs font-semibold text-slate-500">{Object.keys(answers).filter((id) => questions.some((question) => question.id === id)).length} dijawab</span>
          </div>
          <div className="space-y-4">
            <p className="whitespace-pre-wrap break-words text-base font-semibold leading-relaxed text-slate-800">{currentQuestion.pertanyaan}</p>
            {currentQuestion.gambar_soal?.trim() && <img src={currentQuestion.gambar_soal} alt="Gambar soal" className="max-h-72 max-w-full rounded-xl border border-slate-200 object-contain" />}
          </div>

          <div className="mt-6 grid gap-3">
            {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
              const text = currentQuestion[`opsi_${letter.toLowerCase()}` as keyof Question];
              const image = currentQuestion[`gambar_${letter.toLowerCase()}` as keyof Question];
              const optionText = typeof text === 'string' ? text.trim() : '';
              const optionImage = typeof image === 'string' ? image.trim() : '';
              if (!optionText && !optionImage) return null;
              const selected = answers[currentQuestion.id] === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseAnswer(currentQuestion.id, letter)}
                  className={`flex min-h-14 w-full items-start gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-indigo-100 ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${selected ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>{letter}</span>
                  <span className="min-w-0 flex-1 break-words pt-1 text-sm font-medium">{optionText}</span>
                  {optionImage && <img src={optionImage} alt={`Gambar opsi ${letter}`} className="ml-auto max-h-24 max-w-28 shrink-0 rounded-lg object-contain" />}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-40">← Sebelumnya</button>
            {activeIndex === questions.length - 1 ? (
              <button type="button" disabled={submitting} onClick={requestSubmit} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Selesai & kirim</button>
            ) : (
              <button type="button" onClick={() => setActiveIndex((index) => Math.min(questions.length - 1, index + 1))} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Berikutnya →</button>
            )}
          </div>
        </section>
      </div>

      <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {navOpen && (
          <div className="grid max-h-64 w-[min(18rem,calc(100vw-2rem))] grid-cols-5 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl">
            {questions.map((question, index) => (
              <button key={question.id} type="button" aria-label={`Buka soal ${index + 1}`} onClick={() => { setActiveIndex(index); setNavOpen(false); }} className={`aspect-square rounded-xl border text-sm font-black ${index === activeIndex ? 'border-indigo-600 bg-indigo-600 text-white' : answers[question.id] ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{index + 1}</button>
            ))}
          </div>
        )}
        <button type="button" aria-expanded={navOpen} aria-label={navOpen ? 'Tutup navigasi soal' : 'Buka navigasi soal'} onClick={() => setNavOpen((open) => !open)} className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-black text-white shadow-xl">{navOpen ? '×' : '☰'}</button>
      </div>

      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h2 className="text-lg font-black text-slate-900">Kumpulkan jawaban?</h2>
            {unanswered.length > 0 ? (
              <div className="rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-900">
                <p className="font-bold">Ada {unanswered.length} soal belum dijawab.</p>
                <div className="mt-2 flex flex-wrap gap-2">{unanswered.map((number) => <button key={number} type="button" onClick={() => { setActiveIndex(number - 1); setSubmitOpen(false); }} className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-bold">No. {number}</button>)}</div>
              </div>
            ) : <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">Semua soal sudah dijawab.</p>}
            {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
            <div className="flex gap-3">
              <button type="button" disabled={submitting} onClick={() => setSubmitOpen(false)} className="flex-1 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-700">Periksa lagi</button>
              <button type="button" disabled={submitting} onClick={() => void submitExam()} className="flex-1 rounded-xl bg-emerald-600 p-3 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'Mengirim...' : 'Kirim sekarang'}</button>
            </div>
          </section>
        </div>
      )}

      {violationOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4">
          <section className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center shadow-2xl">
            <span className="text-3xl">⚠️</span>
            <h2 className="font-black text-rose-700">Peringatan ujian</h2>
            <p className="text-sm text-slate-600">Sistem mendeteksi layar ujian tidak aktif. Kembali ke ujian untuk melanjutkan.</p>
            <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">Pelanggaran: {violations}/{maxViolations}</p>
            <button type="button" onClick={() => void returnToFullscreen()} className="w-full rounded-xl bg-indigo-600 p-3 text-sm font-bold text-white">Kembali ke ujian</button>
          </section>
        </div>
      )}
    </main>
  );
}
