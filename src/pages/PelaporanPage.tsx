import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  AlurVerifikasi,
  AksiVerifikasi,
  JenisLaporan,
  KewajibanLapor,
  LaporanPeriodik,
  PosisiVerifikasi,
  RingkasanKepatuhan,
  StatusLaporan,
  TahapAlur,
  UserRole,
} from '../types';
import { ItemCard } from '../components/ui/ItemCard';
import {
  LABEL_JENIS,
  LABEL_STATUS,
  labelPeriode,
} from '../services/laporan/periode';
import { LABEL_PERAN } from '../services/laporan/alur';

interface PelaporanPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
  /** Peran pengguna aktif — menentukan tahap verifikasi mana yang bisa diselesaikan. */
  peran?: UserRole;
}

/** Laporan + posisi verifikasinya (dihitung server). */
type LaporanDenganPosisi = LaporanPeriodik & { posisiVerifikasi?: PosisiVerifikasi };

/** Warna aksen per status agar konsisten di seluruh halaman. */
const WARNA_STATUS: Record<StatusLaporan, string> = {
  belum: 'var(--color-ink-3, #94a3b8)',
  draf: 'var(--color-brand)',
  terkirim: 'var(--color-warn)',
  terverifikasi: 'var(--color-pos)',
  revisi: 'var(--color-neg)',
};

const KELAS_STATUS: Record<StatusLaporan, string> = {
  belum: 'bg-surface-2 text-ink-2 border-line',
  draf: 'bg-brand/15 text-brand-ink border-brand/30',
  terkirim: 'bg-warn/15 text-warn border-warn/30',
  terverifikasi: 'bg-pos/15 text-pos border-pos/30',
  revisi: 'bg-neg/15 text-neg border-neg/30',
};

export const PelaporanPage: React.FC<PelaporanPageProps> = ({ tenantId, onBackToWorkspace, peran }) => {
  const [kewajiban, setKewajiban] = useState<KewajibanLapor[]>([]);
  const [laporan, setLaporan] = useState<LaporanDenganPosisi[]>([]);
  const [periode, setPeriode] = useState<string>('');
  const [daftarPeriode, setDaftarPeriode] = useState<string[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanKepatuhan | null>(null);
  const [alur, setAlur] = useState<AlurVerifikasi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'kewajiban' | 'alur'>('status');
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);

  // Modal: tambah kewajiban.
  const [isKewajibanOpen, setIsKewajibanOpen] = useState(false);
  const [kewNama, setKewNama] = useState('');
  const [kewJenis, setKewJenis] = useState<JenisLaporan>('triwulanan');
  const [kewDasar, setKewDasar] = useState('');
  const [kewPenerima, setKewPenerima] = useState('');
  const [kewTenggat, setKewTenggat] = useState(10);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  // Modal: isi/catat laporan.
  const [isiUntuk, setIsiUntuk] = useState<KewajibanLapor | null>(null);
  const [isiStatus, setIsiStatus] = useState<StatusLaporan>('terkirim');
  const [isiCatatan, setIsiCatatan] = useState('');
  const [isiLampiran, setIsiLampiran] = useState<string>('');

  // Modal: tindak lanjut verifikasi (setujui / minta revisi).
  const [verifikasiUntuk, setVerifikasiUntuk] = useState<LaporanDenganPosisi | null>(null);
  const [verifikasiAksi, setVerifikasiAksi] = useState<'setujui' | 'revisi'>('setujui');
  const [verifikasiCatatan, setVerifikasiCatatan] = useState('');

  // Modal: kelola alur verifikasi (admin).
  const [isAlurOpen, setIsAlurOpen] = useState(false);
  const [alurId, setAlurId] = useState<string | undefined>(undefined);
  const [alurNama, setAlurNama] = useState('');
  const [alurDefault, setAlurDefault] = useState(false);
  const [alurTahap, setAlurTahap] = useState<TahapAlur[]>([
    { urutan: 1, nama: 'Verifikasi', peran: 'analis' },
    { urutan: 2, nama: 'Persetujuan', peran: 'direksi' },
  ]);

  const muatKewajiban = async () => {
    const res = await fetch('/api/pelaporan/kewajiban');
    if (!res.ok) throw new Error('Gagal memuat kewajiban lapor.');
    const data = await res.json();
    setKewajiban(Array.isArray(data.kewajiban) ? data.kewajiban : []);
    setDaftarPeriode(Array.isArray(data.periode) ? data.periode : []);
    setPeriode((p) => p || (data.periode?.[0] ?? ''));
    return data;
  };

  const muatLaporan = async (p: string) => {
    const res = await fetch(`/api/pelaporan/laporan?periode=${encodeURIComponent(p)}`);
    if (!res.ok) throw new Error('Gagal memuat laporan.');
    const data = await res.json();
    setLaporan(Array.isArray(data.laporan) ? data.laporan : []);
    setRingkasan(data.ringkasan ?? null);
    if (Array.isArray(data.alur)) setAlur(data.alur);
    if (Array.isArray(data.periodeTersedia) && data.periodeTersedia.length > 0) {
      setDaftarPeriode(data.periodeTersedia);
    }
  };

  const muatSemua = async () => {
    setIsLoading(true);
    try {
      await muatKewajiban();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat data pelaporan.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void muatSemua();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!periode) return;
    muatLaporan(periode).catch((err) =>
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat laporan periode ini.' })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, kewajiban.length]);

  /** Peta status per kewajiban untuk periode aktif (untuk tampilan matriks). */
  const statusPerKewajiban = useMemo(() => {
    const map = new Map<string, StatusLaporan>();
    for (const k of kewajiban) {
      const lap = laporan.find((l) => l.kewajibanId === k.id && l.periode === periode);
      map.set(k.id, lap?.status ?? 'belum');
    }
    return map;
  }, [kewajiban, laporan, periode]);

  const simpanKewajiban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kewNama.trim()) return;
    setSedangSimpan(true);
    try {
      const res = await fetch('/api/pelaporan/kewajiban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: kewNama,
          jenis: kewJenis,
          dasar: kewDasar,
          penerima: kewPenerima,
          tenggatHari: kewTenggat,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan kewajiban.');
      }
      setIsKewajibanOpen(false);
      setKewNama('');
      setKewDasar('');
      setKewPenerima('');
      setKewTenggat(10);
      setKewJenis('triwulanan');
      setPesan({ tipe: 'ok', teks: 'Kewajiban lapor ditambahkan.' });
      await muatSemua();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan kewajiban.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const hapusKewajiban = async (k: KewajibanLapor) => {
    if (!window.confirm(`Hapus kewajiban "${k.nama}"? Seluruh laporan terkait juga akan terhapus.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/pelaporan/kewajiban/${encodeURIComponent(k.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus kewajiban.');
      setPesan({ tipe: 'ok', teks: 'Kewajiban dihapus.' });
      await muatSemua();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus kewajiban.' });
    }
  };

  /** Tindak lanjut verifikasi: setujui tahap aktif atau minta revisi. */
  const kirimVerifikasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifikasiUntuk) return;
    setSedangSimpan(true);
    try {
      const res = await fetch(
        `/api/pelaporan/laporan/${encodeURIComponent(verifikasiUntuk.id)}/verifikasi`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aksi: verifikasiAksi, catatan: verifikasiCatatan }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan tindak lanjut verifikasi.');
      setVerifikasiUntuk(null);
      setVerifikasiCatatan('');
      setPesan({
        tipe: 'ok',
        teks:
          verifikasiAksi === 'revisi'
            ? 'Laporan dikembalikan untuk revisi.'
            : 'Tahap verifikasi disetujui.',
      });
      await muatLaporan(periode);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan tindak lanjut.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  /** Buka modal alur untuk membuat alur baru. */
  const bukaAlurBaru = () => {
    setAlurId(undefined);
    setAlurNama('');
    setAlurDefault(false);
    setAlurTahap([
      { urutan: 1, nama: 'Verifikasi', peran: 'analis' },
      { urutan: 2, nama: 'Persetujuan', peran: 'direksi' },
    ]);
    setIsAlurOpen(true);
  };

  /** Buka modal alur untuk mengubah alur yang sudah ada. */
  const bukaAlurEdit = (a: AlurVerifikasi) => {
    setAlurId(a.id);
    setAlurNama(a.nama);
    setAlurDefault(a.isDefault);
    setAlurTahap(a.tahap.map((t) => ({ ...t })));
    setIsAlurOpen(true);
  };

  const simpanAlur = async (e: React.FormEvent) => {
    e.preventDefault();
    setSedangSimpan(true);
    try {
      const res = await fetch('/api/pelaporan/alur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: alurId,
          nama: alurNama,
          isDefault: alurDefault,
          tahap: alurTahap.map((t, i) => ({ urutan: i + 1, nama: t.nama, peran: t.peran })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan alur verifikasi.');
      setIsAlurOpen(false);
      setPesan({ tipe: 'ok', teks: 'Alur verifikasi disimpan.' });
      await muatLaporan(periode);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan alur verifikasi.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const hapusAlur = async (a: AlurVerifikasi) => {
    if (
      !window.confirm(
        `Hapus alur "${a.nama}"? Laporan yang memakainya kembali ke alur bawaan (riwayat verifikasi tidak dihapus).`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/pelaporan/alur/${encodeURIComponent(a.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus alur.');
      setPesan({ tipe: 'ok', teks: 'Alur verifikasi dihapus.' });
      await muatLaporan(periode);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus alur.' });
    }
  };

  const simpanLaporan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isiUntuk) return;
    setSedangSimpan(true);
    try {
      const lampiran = isiLampiran
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((nama) => ({ nama }));
      const res = await fetch('/api/pelaporan/laporan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kewajibanId: isiUntuk.id,
          periode,
          status: isiStatus,
          catatan: isiCatatan,
          lampiran,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan laporan.');
      }
      setIsiUntuk(null);
      setIsiCatatan('');
      setIsiLampiran('');
      setPesan({ tipe: 'ok', teks: `Laporan ${labelPeriode(isiUntuk.jenis, periode)} dicatat.` });
      await muatLaporan(periode);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan laporan.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const kartuRingkasan = [
    {
      label: 'Total Kewajiban',
      nilai: ringkasan?.totalKewajiban ?? 0,
      warna: 'var(--color-brand)',
      ikon: <ClipboardList className="w-4 h-4" />,
    },
    {
      label: 'Terverifikasi',
      nilai: ringkasan?.sudahTerverifikasi ?? 0,
      warna: 'var(--color-pos)',
      ikon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      label: 'Terkirim',
      nilai: ringkasan?.sudahTerkirim ?? 0,
      warna: 'var(--color-warn)',
      ikon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'Belum Lapor',
      nilai: ringkasan?.belumLapor ?? 0,
      warna: 'var(--color-ink-3, #94a3b8)',
      ikon: <CalendarClock className="w-4 h-4" />,
    },
    {
      label: 'Terlambat',
      nilai: ringkasan?.terlambat ?? 0,
      warna: 'var(--color-neg)',
      ikon: <AlertTriangle className="w-4 h-4" />,
    },
  ];

  const persen = ringkasan?.persenKepatuhan ?? 0;
  const bisaAturAlur = peran === 'admin';

  /** Ringkasan rantai verifikasi untuk ditampilkan di kartu laporan. */
  const labelVerifikasi = (lap?: LaporanDenganPosisi): string | null => {
    const pos = lap?.posisiVerifikasi;
    if (!pos || pos.total === 0) return null;
    if (pos.perluRevisi) return 'Menunggu revisi & pengiriman ulang';
    if (pos.tuntas) return 'Selesai diverifikasi';
    if (!pos.tahapAktif) return null;
    return `Tahap ${pos.selesai + 1}/${pos.total}: ${pos.tahapAktif.nama} · ${LABEL_PERAN[pos.tahapAktif.peran]}`;
  };

  /** Boleh tidak peran ini menyelesaikan tahap aktif laporan ini? */
  const bolehTindak = (lap?: LaporanDenganPosisi): boolean => {
    const pos = lap?.posisiVerifikasi;
    if (!pos?.tahapAktif) return false;
    if (peran === 'admin') return true;
    return pos.tahapAktif.peran === peran;
  };

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Header */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0 shadow-sm">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink flex items-center gap-2.5 flex-wrap">
                Pelaporan Periodik & Kepatuhan
                {ringkasan && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                      persen >= 100
                        ? 'bg-pos/15 text-pos border-pos/30'
                        : persen >= 50
                          ? 'bg-warn/15 text-warn border-warn/30'
                          : 'bg-neg/15 text-neg border-neg/30'
                    }`}
                  >
                    {persen}% patuh
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Pantau kewajiban laporan instansi per periode, tenggat, dan status penyampaiannya
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="text-xs font-semibold bg-surface-2 border border-line rounded-control px-3 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Pilih periode pelaporan"
            >
              {daftarPeriode.length === 0 && <option value="">(belum ada periode)</option>}
              {daftarPeriode.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={() => void muatSemua()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Pesan */}
        {pesan && (
          <div
            className={`mb-6 p-3 rounded-card border text-xs flex items-start gap-2 ${
              pesan.tipe === 'ok'
                ? 'bg-pos/15 border-pos/30 text-pos'
                : 'bg-neg/15 border-neg/30 text-neg'
            }`}
          >
            {pesan.tipe === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{pesan.teks}</span>
            <button onClick={() => setPesan(null)} aria-label="Tutup pesan" className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Ringkasan kepatuhan */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {kartuRingkasan.map((k) => (
            <div
              key={k.label}
              className="bg-surface p-4 rounded-card border border-line shadow-2xs"
              style={{ ['--item-accent' as any]: k.warna }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-control flex items-center justify-center text-white shrink-0" style={{ background: k.warna }}>
                  {k.ikon}
                </span>
                <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">
                  {k.label}
                </span>
              </div>
              <div className="text-2xl font-extrabold text-ink leading-none">{k.nilai}</div>
            </div>
          ))}
        </div>

        {/* Tab */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-line flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('status')}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                  activeTab === 'status'
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                }`}
              >
                Status Pelaporan
              </button>
              <button
                onClick={() => setActiveTab('kewajiban')}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                  activeTab === 'kewajiban'
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                }`}
              >
                Kewajiban Lapor ({kewajiban.length})
              </button>
              <button
                onClick={() => setActiveTab('alur')}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                  activeTab === 'alur'
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                }`}
              >
                Alur Verifikasi ({alur.length})
              </button>
            </div>
            {activeTab === 'alur' && bisaAturAlur ? (
              <button
                onClick={bukaAlurBaru}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Alur</span>
              </button>
            ) : activeTab !== 'alur' ? (
              <button
                onClick={() => setIsKewajibanOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kewajiban</span>
              </button>
            ) : null}
          </div>

          <div className="pt-4">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-ink-3">Memuat data pelaporan…</div>
            ) : kewajiban.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-8 h-8 text-ink-3 mx-auto mb-3" />
                <p className="text-xs text-ink-2 mb-1 font-semibold">Belum ada kewajiban lapor</p>
                <p className="text-[11px] text-ink-3 max-w-md mx-auto">
                  Tambahkan kewajiban lapor instansi (mis. Laporan Kinerja Triwulanan) supaya sistem
                  dapat memantau periode mana yang sudah dan belum dilaporkan.
                </p>
              </div>
            ) : activeTab === 'status' ? (
              /* ===== Status per kewajiban untuk periode terpilih ===== */
              <div className="space-y-3">
                {kewajiban.map((k) => {
                  const status = statusPerKewajiban.get(k.id) ?? 'belum';
                  const lap = laporan.find((l) => l.kewajibanId === k.id && l.periode === periode);
                  const lewatTenggat =
                    lap?.deadline &&
                    new Date(lap.deadline).getTime() < Date.now() &&
                    status !== 'terkirim' &&
                    status !== 'terverifikasi';
                  return (
                    <ItemCard
                      key={k.id}
                      accent={WARNA_STATUS[status]}
                      icon={<FileText className="w-4 h-4" />}
                      title={k.nama}
                      meta={
                        <>
                          {LABEL_JENIS[k.jenis]} · {labelPeriode(k.jenis, periode)}
                          {k.penerima ? ` · untuk ${k.penerima}` : ''}
                        </>
                      }
                      trailing={
                        <span
                          className={`px-2 py-0.5 rounded-chip text-[10px] font-semibold uppercase border ${KELAS_STATUS[status]}`}
                        >
                          {LABEL_STATUS[status]}
                        </span>
                      }
                    >
                      <span className="flex flex-wrap items-center gap-3 text-[11px] text-ink-3 mt-2 pt-2 border-t border-line/70">
                        <span>
                          Tenggat:{' '}
                          <strong className={lewatTenggat ? 'text-neg' : 'text-ink-2'}>
                            {lap?.deadline
                              ? new Date(lap.deadline).toLocaleDateString('id-ID')
                              : `${k.tenggatHari} hari setelah periode`}
                          </strong>
                        </span>
                        {lap?.tanggalKirim && (
                          <span>
                            Dikirim:{' '}
                            <strong className="text-ink-2">
                              {new Date(lap.tanggalKirim).toLocaleDateString('id-ID')}
                            </strong>
                          </span>
                        )}
                        {lap?.lampiran?.length ? (
                          <span>
                            Lampiran: <strong className="text-ink-2">{lap.lampiran.length} berkas</strong>
                          </span>
                        ) : null}
                        {lewatTenggat && (
                          <span className="text-neg font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Lewat tenggat
                          </span>
                        )}
                        {labelVerifikasi(lap) && (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              lap?.posisiVerifikasi?.perluRevisi
                                ? 'text-neg'
                                : lap?.posisiVerifikasi?.tuntas
                                  ? 'text-pos'
                                  : 'text-brand-ink'
                            }`}
                          >
                            <GitBranch className="w-3 h-3" />
                            {labelVerifikasi(lap)}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1.5">
                          {lap && bolehTindak(lap) && (
                            <button
                              onClick={() => {
                                setVerifikasiUntuk(lap);
                                setVerifikasiAksi('setujui');
                                setVerifikasiCatatan('');
                              }}
                              className="px-3 py-1 bg-pos/15 hover:bg-pos/25 text-pos border border-pos/30 rounded-control text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              Verifikasi
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setIsiUntuk(k);
                              setIsiStatus(lap?.status && lap.status !== 'belum' ? lap.status : 'terkirim');
                              setIsiCatatan(lap?.catatan || '');
                              setIsiLampiran((lap?.lampiran || []).map((l) => l.nama).join('\n'));
                            }}
                            className="px-3 py-1 border border-line hover:bg-surface-2 text-ink-2 rounded-control text-[11px] font-medium transition-colors"
                          >
                            {lap ? 'Perbarui' : 'Isi Laporan'}
                          </button>
                        </span>
                      </span>
                    </ItemCard>
                  );
                })}
              </div>
            ) : activeTab === 'kewajiban' ? (
              /* ===== Kelola kewajiban ===== */
              <div className="space-y-3">
                {kewajiban.map((k) => (
                  <ItemCard
                    key={k.id}
                    accent={k.isActive ? 'var(--color-brand)' : 'var(--color-ink-3, #94a3b8)'}
                    icon={<ClipboardList className="w-4 h-4" />}
                    title={k.nama}
                    meta={
                      <>
                        {LABEL_JENIS[k.jenis]} · tenggat {k.tenggatHari} hari
                        {k.penerima ? ` · ${k.penerima}` : ''}
                      </>
                    }
                    trailing={
                      <button
                        onClick={() => void hapusKewajiban(k)}
                        className="p-1.5 border border-line hover:bg-neg/10 text-ink-3 hover:text-neg rounded-control transition-colors"
                        title="Hapus kewajiban lapor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    }
                  >
                    {k.dasar && (
                      <span className="block text-[11px] text-ink-3 mt-2 pt-2 border-t border-line/70">
                        Dasar: {k.dasar}
                      </span>
                    )}
                  </ItemCard>
                ))}
              </div>
            ) : (
              /* ===== Kelola alur verifikasi ===== */
              <div className="space-y-3">
                <div className="p-3 bg-surface-2 border border-line rounded-card text-[11px] text-ink-2 leading-relaxed">
                  Alur verifikasi menentukan siapa yang harus menyetujui laporan sebelum dianggap
                  tuntas. Laporan baru otomatis memakai alur <strong>default</strong>; bila instansi
                  belum punya alur, sistem memakai alur bawaan
                  {' '}
                  <strong>Verifikasi (analis) → Persetujuan (direksi)</strong>.
                </div>
                {alur.length === 0 ? (
                  <div className="text-center py-10">
                    <GitBranch className="w-8 h-8 text-ink-3 mx-auto mb-3" />
                    <p className="text-xs text-ink-2 mb-1 font-semibold">Belum ada alur khusus</p>
                    <p className="text-[11px] text-ink-3 max-w-md mx-auto">
                      Laporan memakai alur bawaan. Tambahkan alur bila instansi Anda butuh rantai
                      persetujuan tersendiri.
                    </p>
                  </div>
                ) : (
                  alur.map((a) => (
                    <ItemCard
                      key={a.id}
                      accent={a.isDefault ? 'var(--color-brand)' : 'var(--color-ink-3, #94a3b8)'}
                      icon={<GitBranch className="w-4 h-4" />}
                      title={
                        <span className="flex items-center gap-2">
                          {a.nama}
                          {a.isDefault && (
                            <span className="px-1.5 py-0.5 rounded-chip text-[9px] font-bold uppercase bg-brand/15 text-brand-ink border border-brand/30">
                              Default
                            </span>
                          )}
                        </span>
                      }
                      meta={`${a.tahap.length} tahap`}
                      trailing={
                        bisaAturAlur ? (
                          <span className="flex items-center gap-1.5">
                            <button
                              onClick={() => bukaAlurEdit(a)}
                              className="px-2.5 py-1 border border-line hover:bg-surface-2 text-ink-2 rounded-control text-[11px] font-medium transition-colors"
                            >
                              Ubah
                            </button>
                            <button
                              onClick={() => void hapusAlur(a)}
                              className="p-1.5 border border-line hover:bg-neg/10 text-ink-3 hover:text-neg rounded-control transition-colors"
                              title="Hapus alur verifikasi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : null
                      }
                    >
                      <span className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-line/70">
                        {a.tahap
                          .slice()
                          .sort((x, y) => x.urutan - y.urutan)
                          .map((t, i) => (
                            <span key={`${a.id}-${t.urutan}`} className="inline-flex items-center gap-1.5">
                              {i > 0 && <span className="text-line-strong">→</span>}
                              <span className="px-2 py-0.5 rounded-chip text-[10px] font-semibold bg-surface-2 border border-line text-ink-2">
                                {t.nama}
                                <span className="text-ink-3 font-normal"> · {LABEL_PERAN[t.peran]}</span>
                              </span>
                            </span>
                          ))}
                      </span>
                    </ItemCard>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Modal: Tambah Kewajiban ===== */}
      {isKewajibanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsKewajibanOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-sm text-ink">Tambah Kewajiban Lapor</h3>
              <button onClick={() => setIsKewajibanOpen(false)} className="text-ink-3 hover:text-ink-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={simpanKewajiban} className="space-y-3">
              <div>
                <label className="block text-ink-2 font-medium mb-1">Nama Laporan</label>
                <input
                  type="text"
                  required
                  value={kewNama}
                  onChange={(e) => setKewNama(e.target.value)}
                  placeholder="Contoh: Laporan Kinerja Triwulanan"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Jenis Periode</label>
                  <select
                    value={kewJenis}
                    onChange={(e) => setKewJenis(e.target.value as JenisLaporan)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="bulanan">Bulanan</option>
                    <option value="triwulanan">Triwulanan</option>
                    <option value="semesteran">Semesteran</option>
                    <option value="tahunan">Tahunan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Tenggat (hari)</label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={kewTenggat}
                    onChange={(e) => setKewTenggat(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-[10px] text-ink-3 mt-0.5 block">
                    Setelah periode berakhir
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">Penerima Laporan (opsional)</label>
                <input
                  type="text"
                  value={kewPenerima}
                  onChange={(e) => setKewPenerima(e.target.value)}
                  placeholder="Contoh: Pemda / Dewan Pengawas / BPKP"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">Dasar Hukum / Permintaan (opsional)</label>
                <input
                  type="text"
                  value={kewDasar}
                  onChange={(e) => setKewDasar(e.target.value)}
                  placeholder="Contoh: Permendagri 118/2018"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsKewajibanOpen(false)}
                  className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sedangSimpan || !kewNama.trim()}
                  className="px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sedangSimpan ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: Isi Laporan ===== */}
      {isiUntuk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsiUntuk(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-sm text-ink">
                Isi Laporan — {labelPeriode(isiUntuk.jenis, periode)}
              </h3>
              <button onClick={() => setIsiUntuk(null)} className="text-ink-3 hover:text-ink-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-surface-2 border border-line rounded-card">
              <span className="block font-semibold text-ink">{isiUntuk.nama}</span>
              <span className="block text-[11px] text-ink-3 mt-0.5">
                {LABEL_JENIS[isiUntuk.jenis]} · periode {periode}
              </span>
            </div>
            <form onSubmit={simpanLaporan} className="space-y-3">
              <div>
                <label className="block text-ink-2 font-medium mb-1">Status</label>
                <select
                  value={isiStatus}
                  onChange={(e) => setIsiStatus(e.target.value as StatusLaporan)}
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="draf">Draf (masih dikerjakan)</option>
                  <option value="terkirim">Terkirim (sudah disampaikan)</option>
                  <option value="terverifikasi">Terverifikasi (sudah diterima)</option>
                  <option value="revisi">Perlu Revisi</option>
                </select>
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">Catatan / Ringkasan (opsional)</label>
                <textarea
                  rows={3}
                  value={isiCatatan}
                  onChange={(e) => setIsiCatatan(e.target.value)}
                  placeholder="Ringkasan isi laporan atau catatan penyampaian"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">
                  Nama Berkas Lampiran (satu per baris, opsional)
                </label>
                <textarea
                  rows={2}
                  value={isiLampiran}
                  onChange={(e) => setIsiLampiran(e.target.value)}
                  placeholder={'laporan-kinerja-q1.pdf\nrealisasi-anggaran-q1.xlsx'}
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none font-mono text-[11px]"
                />
                <span className="text-[10px] text-ink-3 mt-0.5 block">
                  Aplikasi mencatat nama berkas sebagai rujukan; berkasnya tetap disimpan di tempat Anda.
                </span>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsiUntuk(null)}
                  className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sedangSimpan}
                  className="px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sedangSimpan ? 'Menyimpan…' : 'Simpan Laporan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: Tindak Lanjut Verifikasi ===== */}
      {verifikasiUntuk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-scrim/50 backdrop-blur-xs"
            onClick={() => setVerifikasiUntuk(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand" />
                Tindak Lanjut Verifikasi
              </h3>
              <button onClick={() => setVerifikasiUntuk(null)} className="text-ink-3 hover:text-ink-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-surface-2 border border-line rounded-card">
              <span className="block font-semibold text-ink">{verifikasiUntuk.nama}</span>
              <span className="block text-[11px] text-ink-3 mt-0.5">
                {LABEL_JENIS[verifikasiUntuk.jenis]} · periode {verifikasiUntuk.periode}
              </span>
              {verifikasiUntuk.posisiVerifikasi?.tahapAktif && (
                <span className="block text-[11px] text-brand-ink font-semibold mt-1.5">
                  Tahap aktif: {verifikasiUntuk.posisiVerifikasi.tahapAktif.nama} (
                  {LABEL_PERAN[verifikasiUntuk.posisiVerifikasi.tahapAktif.peran]})
                </span>
              )}
            </div>

            {/* Jejak verifikasi sejauh ini */}
            {verifikasiUntuk.riwayatVerifikasi?.length ? (
              <div>
                <span className="block text-ink-2 font-medium mb-1.5">Jejak verifikasi</span>
                <ol className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {verifikasiUntuk.riwayatVerifikasi.map((r: AksiVerifikasi, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[11px] text-ink-2 bg-surface-2 border border-line rounded-control px-2.5 py-1.5"
                    >
                      <span
                        className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                          r.aksi === 'revisi' ? 'bg-neg' : r.aksi === 'setujui' ? 'bg-pos' : 'bg-brand'
                        }`}
                      />
                      <span className="flex-1">
                        <strong className="text-ink">
                          {r.aksi === 'kirim'
                            ? 'Dikirim'
                            : r.aksi === 'setujui'
                              ? 'Disetujui'
                              : 'Diminta revisi'}
                        </strong>
                        {r.aksi !== 'kirim' ? ` tahap ${r.urutan}` : ''} oleh {r.oleh} (
                        {LABEL_PERAN[r.peran]})
                        {r.catatan ? <span className="block text-ink-3 mt-0.5">“{r.catatan}”</span> : null}
                      </span>
                      <span className="text-[10px] text-ink-3 shrink-0">
                        {new Date(r.pada).toLocaleDateString('id-ID')}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <form onSubmit={kirimVerifikasi} className="space-y-3">
              <div>
                <label className="block text-ink-2 font-medium mb-1">Tindakan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifikasiAksi('setujui')}
                    className={`px-3 py-2 rounded-control text-xs font-semibold border transition-colors inline-flex items-center justify-center gap-1.5 ${
                      verifikasiAksi === 'setujui'
                        ? 'bg-pos/15 text-pos border-pos/40'
                        : 'bg-surface-2 text-ink-2 border-line hover:border-pos/40'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifikasiAksi('revisi')}
                    className={`px-3 py-2 rounded-control text-xs font-semibold border transition-colors inline-flex items-center justify-center gap-1.5 ${
                      verifikasiAksi === 'revisi'
                        ? 'bg-neg/15 text-neg border-neg/40'
                        : 'bg-surface-2 text-ink-2 border-line hover:border-neg/40'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Minta Revisi
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">
                  Catatan {verifikasiAksi === 'revisi' ? '' : '(opsional)'}
                </label>
                <textarea
                  rows={3}
                  value={verifikasiCatatan}
                  onChange={(e) => setVerifikasiCatatan(e.target.value)}
                  placeholder={
                    verifikasiAksi === 'revisi'
                      ? 'Jelaskan apa yang perlu diperbaiki'
                      : 'Catatan persetujuan (opsional)'
                  }
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerifikasiUntuk(null)}
                  className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sedangSimpan || (verifikasiAksi === 'revisi' && !verifikasiCatatan.trim())}
                  className={`px-4 py-2 rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed text-on-brand ${
                    verifikasiAksi === 'revisi' ? 'bg-neg hover:bg-neg/90' : 'bg-brand hover:bg-brand-ink'
                  }`}
                >
                  {sedangSimpan ? 'Menyimpan…' : verifikasiAksi === 'revisi' ? 'Kirim Revisi' : 'Setujui'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: Alur Verifikasi (admin) ===== */}
      {isAlurOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsAlurOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-brand" />
                {alurId ? 'Ubah Alur Verifikasi' : 'Tambah Alur Verifikasi'}
              </h3>
              <button onClick={() => setIsAlurOpen(false)} className="text-ink-3 hover:text-ink-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={simpanAlur} className="space-y-3">
              <div>
                <label className="block text-ink-2 font-medium mb-1">Nama Alur</label>
                <input
                  type="text"
                  required
                  value={alurNama}
                  onChange={(e) => setAlurNama(e.target.value)}
                  placeholder="Contoh: Alur Laporan Keuangan"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-ink-2 font-medium">Tahap Persetujuan (berurutan)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setAlurTahap((prev) =>
                        prev.length >= 5
                          ? prev
                          : [...prev, { urutan: prev.length + 1, nama: '', peran: 'analis' }]
                      )
                    }
                    disabled={alurTahap.length >= 5}
                    className="text-[11px] font-semibold text-brand-ink hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Tambah tahap
                  </button>
                </div>
                <div className="space-y-2">
                  {alurTahap.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-surface-2 border border-line flex items-center justify-center text-[10px] font-bold text-ink-2 shrink-0">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={t.nama}
                        onChange={(e) =>
                          setAlurTahap((prev) =>
                            prev.map((x, xi) => (xi === i ? { ...x, nama: e.target.value } : x))
                          )
                        }
                        placeholder="Nama tahap (mis. Verifikasi Kabag)"
                        className="flex-1 px-3 py-1.5 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <select
                        value={t.peran}
                        onChange={(e) =>
                          setAlurTahap((prev) =>
                            prev.map((x, xi) =>
                              xi === i ? { ...x, peran: e.target.value as UserRole } : x
                            )
                          )
                        }
                        className="px-2 py-1.5 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                      >
                        <option value="analis">Analis</option>
                        <option value="direksi">Direksi</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setAlurTahap((prev) => prev.filter((_, xi) => xi !== i))}
                        disabled={alurTahap.length <= 1}
                        className="p-1.5 border border-line hover:bg-neg/10 text-ink-3 hover:text-neg rounded-control transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Hapus tahap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-ink-3 mt-1 block">
                  Laporan harus disetujui berurutan dari tahap 1. Admin selalu boleh menyetujui
                  tahap mana pun.
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alurDefault}
                  onChange={(e) => setAlurDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-line accent-brand"
                />
                <span className="text-ink-2">Jadikan alur default untuk laporan baru</span>
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAlurOpen(false)}
                  className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sedangSimpan || !alurNama.trim() || alurTahap.some((t) => !t.nama.trim())}
                  className="px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sedangSimpan ? 'Menyimpan…' : 'Simpan Alur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
