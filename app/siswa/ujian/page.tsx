const mockJadwal = [
  {
    id: 'UJ-101',
    mapel: 'Matematika',
    kelas: 'XI RPL 2',
    tanggal: '17 Nov 2026',
    jam: '08:00',
    durasi: '90 Menit',
    status: 'Siap',
    color: 'from-indigo-500 to-blue-600',
    detail: 'Ujian Tengah Semester',
  },
  {
    id: 'UJ-102',
    mapel: 'Bahasa Indonesia',
    kelas: 'XI RPL 2',
    tanggal: '18 Nov 2026',
    jam: '09:30',
    durasi: '60 Menit',
    status: 'Menunggu',
    color: 'from-emerald-500 to-teal-600',
    detail: 'Latihan Soal',
  },
  {
    id: 'UJ-103',
    mapel: 'Produk Kreatif',
    kelas: 'XI RPL 2',
    tanggal: '19 Nov 2026',
    jam: '07:30',
    durasi: '120 Menit',
    status: 'Segera',
    color: 'from-violet-500 to-purple-600',
    detail: 'Praktik & Teori',
  },
];

const statusStyles: Record<string, string> = {
  Siap: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Menunggu: 'bg-amber-100 text-amber-700 border border-amber-200',
  Segera: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
};

export default function UjianPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-sky-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Siswa</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Jadwal Ujian
            </h1>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Total</p>
            <p className="text-lg font-black text-indigo-600">{mockJadwal.length}</p>
          </div>
        </header>

        <div className="mb-6 rounded-3xl border border-indigo-100 bg-white/80 p-4 shadow-[0_24px_60px_-28px_rgba(79,70,229,0.6)] backdrop-blur-sm md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ringkasan</p>
              <p className="mt-2 text-lg font-black text-slate-900">Halo, Siswa</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-right text-white shadow-lg">
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-100">Hari ini</p>
              <p className="text-sm font-bold">1 ujian</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {mockJadwal.map((jadwal) => (
            <article
              key={jadwal.id}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.6)] backdrop-blur-sm"
            >
              <div className={`h-2 w-full bg-gradient-to-r ${jadwal.color}`} />

              <div className="p-4 md:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      {jadwal.id}
                    </p>
                    <h2 className="mt-2 text-xl font-black text-slate-900 md:text-2xl">{jadwal.mapel}</h2>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[jadwal.status]}`}>
                    {jadwal.status}
                  </span>
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Kelas</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{jadwal.kelas}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tanggal</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{jadwal.tanggal}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Jam</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{jadwal.jam}</p>
                  </div>
                </div>

                <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Durasi</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{jadwal.durasi}</p>
                  </div>
                  <p className="text-xs text-slate-500">{jadwal.detail}</p>
                </div>

                <button
                  className={`w-full rounded-2xl bg-gradient-to-r ${jadwal.color} px-4 py-3 text-sm font-black uppercase tracking-[0.15em] text-white shadow-lg transition hover:opacity-95`}
                >
                  {jadwal.status === 'Siap' ? 'Mulai Ujian' : 'Lihat Detail'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
