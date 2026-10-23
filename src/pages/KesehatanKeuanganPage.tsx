import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  Landmark,
  Pencil,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Citation,
  KunciKomponen,
  RasioKeuangan,
  RingkasanKeuangan,
  SnapshotKeuangan,
  UserRole,
} from '../types';
import {
  kategoriDariSkor,
  LABEL_KATEGORI,
  LABEL_KOMPONEN,
  URUTAN_KOMPONEN,
  WARNA_KATEGORI,
} from '../services/keuangan/rasio';

interface KesehatanKeuanganPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
  /** Peran pengguna aktif — menentukan tombol tarik-dari-dokumen tampil. */
  peran?: UserRole;
}

/** Kelas badge per kategori kesehatan. */
const KELAS_KATEGORI: Record<NonNullable<RasioKeuangan['kategori']>, string> = {
  sangat_sehat: 'bg-pos/15 text-pos border-pos/30',
  sehat: 'bg-pos/15 text-pos border-pos/30',
  cukup_sehat: 'bg-warn/15 text-warn border-warn/30',
  kurang_sehat: 'bg-coral/15 text-coral border-coral/30',
  tidak_sehat: 'bg-neg/15 text-neg border-neg/30',
};

/** Format angka rupiah ringkas (Rp miliar / triliun / juta). */
function rupiahRingkas(n?: number): string {
  if (!Number.isFinite(n as number)) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e12) return `Rp ${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T`;
  if (Math.abs(v) >= 1e9) return `Rp ${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (Math.abs(v) >= 1e6) return `Rp ${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  return `Rp ${v.toLocaleString('id-ID')}`;
}

function nilaiRasio(r: RasioKeuangan): string {
  if (r.nilai === null || r.nilai === undefined) return '—';
  return r.satuan === '×'
    ? `${r.nilai.toLocaleString('id-ID', { maximumFractionDigits: 2 })}×`
    : `${r.nilai.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
}

function deltaTeks(d?: number | null): { teks: string; arah: 'naik' | 'turun' | 'tetap' } {
  if (d === null || d === undefined) return { teks: '—', arah: 'tetap' };
  if (Math.abs(d) < 0.005) return { teks: '0', arah: 'tetap' };
  return { teks: `${d > 0 ? '+' : ''}${d.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`, arah: d > 0 ? 'naik' : 'turun' };
}

/** Periode kode → label default (fallback bila periodeLabel tak ada). */
function labelPeriodeDefault(periode: string): string {
  const q = /^(\d{4})-Q([1-4])$/i.exec(periode);
  if (q) return `Triwulan ${['I', 'II', 'III', 'IV'][Number(q[2]) - 1]} ${q[1]}`;
  const s = /^(\d{4})-S([12])$/i.exec(periode);
  if (s) return `Semester ${s[2]} ${s[1]}`;
  if (/^\d{4}$/.test(periode)) return `Tahun ${periode}`;
  return periode;
}

export const KesehatanKeuanganPage: React.FC<KesehatanKeuanganPageProps> = ({
  tenantId,
  onBackToWorkspace,
  peran,
}) => {
  const [ringkasan, setRingkasan] = useState<RingkasanKeuangan | null>(null);
  const [periodeDipilih, setPeriodeDipilih] = useState<string>('');
  const [snapshotAktif, setSnapshotAktif] = useState<SnapshotKeuangan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rasio' | 'komponen'>('rasio');
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);

  // Modal input snapshot.
  const [isOpen, setIsOpen] = useState(false);
  const [fPeriode, setFPeriode] = useState('');
  const [fKomponen, setFKomponen] = useState<Record<string, string>>({});
  const [fCatatan, setFCatatan] = useState('');
  const [fSitasi, setFSitasi] = useState<Partial<Record<KunciKomponen, Citation>>>({});
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangTarik, setSedangTarik] = useState(false);

  const bisaTarikRag = peran === 'admin';

  const muat = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/keuangan/ringkasan');
      if (!res.ok) throw new Error('Gagal memuat kesehatan keuangan.');
      const data: RingkasanKeuangan = await res.json();
      setRingkasan(data);
      // Pilih periode: yang sedang dipilih bila masih ada, kalau tidak terbaru.
      const daftar = data.periodeTersedia || [];
      const pilih = periodeDipilih && daftar.includes(periodeDipilih) ? periodeDipilih : daftar[0] || '';
      setPeriodeDipilih(pilih);
      await muatSnapshot(pilih);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat data keuangan.' });
    } finally {
      setIsLoading(false);
    }
  };

  const muatSnapshot = async (periode: string) => {
    if (!periode) {
      setSnapshotAktif(null);
      return;
    }
    try {
      const res = await fetch(`/api/keuangan/snapshot?periode=${encodeURIComponent(periode)}`);
      if (!res.ok) throw new Error('Gagal memuat snapshot periode.');
      const data = await res.json();
      const daftar: SnapshotKeuangan[] = Array.isArray(data.snapshot) ? data.snapshot : [];
      setSnapshotAktif(daftar[0] || null);
    } catch {
      setSnapshotAktif(null);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const pilihPeriode = async (p: string) => {
    setPeriodeDipilih(p);
    await muatSnapshot(p);
  };

  const bukaInput = (dari?: SnapshotKeuangan | null) => {
    const s = dari || null;
    setFPeriode(s?.periode || '');
    const komp: Record<string, string> = {};
    for (const k of URUTAN_KOMPONEN) {
      const v = s?.komponen?.[k];
      komp[k] = v !== undefined && v !== null ? String(v) : '';
    }
    setFKomponen(komp);
    setFCatatan(s?.catatan || '');
    setFSitasi(s?.sitasi || {});
    setIsOpen(true);
  };

  const simpanSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSedangSimpan(true);
    try {
      const komponen: Record<string, number> = {};
      for (const k of URUTAN_KOMPONEN) {
        const v = fKomponen[k];
        if (v === undefined || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) komponen[k] = n;
      }
      const res = await fetch('/api/keuangan/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periode: fPeriode,
          komponen,
          sitasi: fSitasi,
          catatan: fCatatan || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan snapshot.');
      }
      setIsOpen(false);
      setPesan({ tipe: 'ok', teks: `Kesehatan keuangan periode ${fPeriode} disimpan.` });
      setPeriodeDipilih(fPeriode);
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan snapshot.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const tarikDariDokumen = async () => {
    if (!fPeriode.trim()) {
      setPesan({ tipe: 'err', teks: 'Isi periode dulu (contoh: 2026-Q1) sebelum menarik dari dokumen.' });
      return;
    }
    setSedangTarik(true);
    try {
      const res = await fetch('/api/keuangan/ekstrak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode: fPeriode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menarik data dari dokumen.');
      const komp: Record<string, string> = { ...fKomponen };
      for (const k of URUTAN_KOMPONEN) {
        const v = data.komponen?.[k];
        if (v !== undefined && v !== null) komp[k] = String(v);
      }
      setFKomponen(komp);
      setFSitasi(data.sitasi || {});
      const jml = Object.keys(data.komponen || {}).length;
      setPesan({
        tipe: jml > 0 ? 'ok' : 'err',
        teks:
          jml > 0
            ? `Berhasil menarik ${jml} komponen dari dokumen. Periksa nilainya sebelum menyimpan.`
            : data.catatan || 'Dokumen tidak memuat angka neraca/laba rugi yang bisa dilacak.',
      });
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menarik data dari dokumen.' });
    } finally {
      setSedangTarik(false);
    }
  };

  const hapusSnapshot = async () => {
    if (!snapshotAktif) return;
    if (!window.confirm(`Hapus snapshot periode ${snapshotAktif.periode}?`)) return;
    try {
      const res = await fetch(`/api/keuangan/snapshot/${snapshotAktif.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghapus snapshot.');
      }
      setPesan({ tipe: 'ok', teks: 'Snapshot keuangan dihapus.' });
      setPeriodeDipilih('');
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus snapshot.' });
    }
  };

  const skor = snapshotAktif?.skorKesehatan;
  const rasioAktif = snapshotAktif?.rasio || [];
  const rasioTerhitung = rasioAktif.filter((r) => r.nilai !== null);

  const kartuUtama = useMemo(() => {
    const cari = (kunci: string) => rasioAktif.find((r) => r.kunci === kunci);
    const roa = cari('roa');
    const roe = cari('roe');
    const der = cari('der');
    const cr = cari('currentRatio');
    return [
      { label: 'ROA', r: roa, ikon: <Activity className="w-4 h-4" /> },
      { label: 'ROE', r: roe, ikon: <TrendingUp className="w-4 h-4" /> },
      { label: 'DER', r: der, ikon: <Landmark className="w-4 h-4" /> },
      { label: 'Rasio Lancar', r: cr, ikon: <Gauge className="w-4 h-4" /> },
    ];
  }, [rasioAktif]);

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Header */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0 shadow-sm">
              <Gauge className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink flex items-center gap-2.5 flex-wrap">
                Kesehatan Keuangan
                {skor !== undefined && snapshotAktif && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                      KELAS_KATEGORI[
                        kategoriDariSkor(skor) || 'cukup_sehat'
                      ]
                    }`}
                    title="Skor gabungan dari rasio yang berkategori (0–100)"
                  >
                    Skor {skor}/100 · {LABEL_KATEGORI[kategoriDariSkor(skor) || 'cukup_sehat']}
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Rasio ROA/ROE/DER/likuiditas dari neraca &amp; laba rugi — angka ditarik dari dokumen resmi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ringkasan && ringkasan.periodeTersedia.length > 0 && (
              <select
                value={periodeDipilih}
                onChange={(e) => void pilihPeriode(e.target.value)}
                className="text-xs font-semibold bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="Pilih periode"
              >
                {ringkasan.periodeTersedia.map((p) => (
                  <option key={p} value={p}>
                    {labelPeriodeDefault(p)}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => void muat()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
            <button
              onClick={() => bukaInput(snapshotAktif)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              {snapshotAktif ? 'Ubah Periode Ini' : 'Input Data'}
            </button>
          </div>
        </div>

        {/* Pesan */}
        {pesan && (
          <div
            className={`mb-6 p-3 rounded-card border text-xs flex items-start gap-2 ${
              pesan.tipe === 'ok' ? 'bg-pos/15 border-pos/30 text-pos' : 'bg-neg/15 border-neg/30 text-neg'
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

        {isLoading ? (
          <div className="text-center py-16 text-xs text-ink-3">Memuat…</div>
        ) : !snapshotAktif ? (
          <div className="bg-surface p-10 rounded-card border border-line text-center">
            <Gauge className="w-10 h-10 text-ink-3 mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink mb-1">Belum ada data kesehatan keuangan</p>
            <p className="text-xs text-ink-3 max-w-md mx-auto mb-5">
              {bisaTarikRag
                ? 'Tarik komponen neraca & laba rugi dari dokumen resmi instansi, atau isi manual. Rasio dihitung otomatis.'
                : 'Isi komponen neraca & laba rugi untuk satu periode; rasio dihitung otomatis.'}
            </p>
            <button
              onClick={() => bukaInput(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Input Data Keuangan
            </button>
          </div>
        ) : (
          <>
            {/* Kartu rasio utama */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {kartuUtama.map((k) => {
                const d = deltaTeks(ringkasan?.delta?.[k.r?.kunci || '']);
                return (
                  <div key={k.label} className="bg-surface p-4 rounded-card border border-line shadow-2xs">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-6 h-6 rounded-control flex items-center justify-center text-white shrink-0"
                        style={{ background: k.r?.kategori ? WARNA_KATEGORI[k.r.kategori] : 'var(--color-ink-3, #94a3b8)' }}
                      >
                        {k.ikon}
                      </span>
                      <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">{k.label}</span>
                    </div>
                    <div className="text-2xl font-extrabold text-ink leading-none">{k.r ? nilaiRasio(k.r) : '—'}</div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      {k.r?.kategori ? (
                        <span className={`px-1.5 py-0.5 rounded-chip text-[10px] font-bold border ${KELAS_KATEGORI[k.r.kategori]}`}>
                          {LABEL_KATEGORI[k.r.kategori]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-3">data belum cukup</span>
                      )}
                      {ringkasan?.sebelumnya && (
                        <span
                          className={`text-[10px] font-semibold inline-flex items-center gap-0.5 ${
                            d.arah === 'naik' ? 'text-pos' : d.arah === 'turun' ? 'text-neg' : 'text-ink-3'
                          }`}
                          title="Perubahan dari periode sebelumnya"
                        >
                          {d.arah === 'naik' ? <TrendingUp className="w-3 h-3" /> : d.arah === 'turun' ? <TrendingDown className="w-3 h-3" /> : null}
                          {d.teks}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tab */}
            <div className="bg-surface p-5 rounded-card border border-line mb-6">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-line flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('rasio')}
                    className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                      activeTab === 'rasio' ? 'bg-brand text-on-brand shadow-sm' : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                    }`}
                  >
                    Rasio ({rasioTerhitung.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('komponen')}
                    className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                      activeTab === 'komponen' ? 'bg-brand text-on-brand shadow-sm' : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                    }`}
                  >
                    Komponen ({Object.keys(snapshotAktif.komponen || {}).length})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-3">
                    {snapshotAktif.periodeLabel} · disusun {snapshotAktif.disusunOleh || '—'}
                  </span>
                  {peran === 'admin' && (
                    <button
                      onClick={() => void hapusSnapshot()}
                      className="p-1.5 border border-line hover:bg-neg/10 text-ink-3 hover:text-neg rounded-control transition-colors"
                      title="Hapus snapshot periode ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4">
                {activeTab === 'rasio' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rasioAktif.map((r) => (
                      <div key={r.kunci} className="bg-surface-2 border border-line rounded-card p-4">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-ink-3" />
                            <span className="text-sm font-bold text-ink">{r.label}</span>
                            {r.sektorKhusus && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-chip bg-brand/10 text-brand-ink font-semibold uppercase">
                                {r.sektorKhusus.join('/')}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-extrabold text-ink">{nilaiRasio(r)}</span>
                            {r.kategori && (
                              <span className={`px-1.5 py-0.5 rounded-chip text-[10px] font-bold border ${KELAS_KATEGORI[r.kategori]}`}>
                                {LABEL_KATEGORI[r.kategori]}
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-3">{r.rumus}</p>
                        {r.ambang && <p className="text-[10px] text-ink-3 mt-0.5">Ambang: {r.ambang}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-ink-3 border-b border-line">
                          <th className="py-2 pr-3 font-semibold">Komponen</th>
                          <th className="py-2 pr-3 font-semibold text-right">Nilai</th>
                          <th className="py-2 font-semibold">Sumber Dokumen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {URUTAN_KOMPONEN.filter((k) => snapshotAktif.komponen?.[k] !== undefined).map((k) => {
                          const cit = snapshotAktif.sitasi?.[k];
                          return (
                            <tr key={k} className="border-b border-line/60">
                              <td className="py-2 pr-3 text-ink font-medium">{LABEL_KOMPONEN[k]}</td>
                              <td className="py-2 pr-3 text-right font-semibold text-ink tabular-nums">
                                {rupiahRingkas(snapshotAktif.komponen[k])}
                              </td>
                              <td className="py-2 text-ink-3">
                                {cit ? (
                                  <span className="inline-flex items-center gap-1.5" title={cit.chunkSnippet}>
                                    <FileText className="w-3.5 h-3.5 shrink-0 text-brand" />
                                    <span className="truncate max-w-[22rem]">
                                      {cit.docName}
                                      {cit.page ? ` · hal. ${cit.page}` : ''}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-ink-3 italic">input manual</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {snapshotAktif.catatan && (
                      <p className="text-[11px] text-ink-3 mt-3 italic">Catatan: {snapshotAktif.catatan}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tren antar periode */}
            {ringkasan && ringkasan.periodeTersedia.length > 1 && (
              <div className="bg-surface p-5 rounded-card border border-line">
                <h2 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand" />
                  Perbandingan Periode
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-3 border-b border-line">
                        <th className="py-2 pr-3 font-semibold">Rasio</th>
                        <th className="py-2 pr-3 font-semibold text-right">{ringkasan.sebelumnya?.periodeLabel || 'Sebelumnya'}</th>
                        <th className="py-2 pr-3 font-semibold text-right">{ringkasan.terbaru?.periodeLabel || 'Terbaru'}</th>
                        <th className="py-2 font-semibold text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ringkasan.terbaru?.rasio || []).map((r) => {
                        const lama = ringkasan.sebelumnya?.rasio?.find((x) => x.kunci === r.kunci);
                        const d = deltaTeks(ringkasan.delta?.[r.kunci]);
                        return (
                          <tr key={r.kunci} className="border-b border-line/60">
                            <td className="py-2 pr-3 text-ink font-medium">{r.label}</td>
                            <td className="py-2 pr-3 text-right text-ink-2 tabular-nums">{lama ? nilaiRasio(lama) : '—'}</td>
                            <td className="py-2 pr-3 text-right text-ink font-semibold tabular-nums">{nilaiRasio(r)}</td>
                            <td
                              className={`py-2 text-right font-semibold tabular-nums ${
                                d.arah === 'naik' ? 'text-pos' : d.arah === 'turun' ? 'text-neg' : 'text-ink-3'
                              }`}
                            >
                              {d.teks}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Modal: Input snapshot ===== */}
      {isOpen && (
        <div className="modal-layer">
          <div className="scrim" onClick={() => setIsOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-2xl bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <Gauge className="w-4 h-4 text-brand" />
                Input Kesehatan Keuangan
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-ink-3 hover:text-ink-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={simpanSnapshot} className="space-y-4">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[12rem]">
                  <label className="label">Periode *</label>
                  <input
                    type="text"
                    required
                    value={fPeriode}
                    onChange={(e) => setFPeriode(e.target.value)}
                    placeholder="2026, 2026-Q1, 2026-06"
                    className="field-lg"
                  />
                </div>
                {bisaTarikRag && (
                  <button
                    type="button"
                    onClick={() => void tarikDariDokumen()}
                    disabled={sedangTarik}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-brand/40 text-brand-ink bg-brand/5 hover:bg-brand/10 rounded-control font-medium transition-colors disabled:opacity-50"
                    title="Tarik angka dari dokumen resmi instansi"
                  >
                    <Database className="w-3.5 h-3.5" />
                    {sedangTarik ? 'Menarik…' : 'Tarik dari Dokumen'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {URUTAN_KOMPONEN.map((k) => (
                  <div key={k}>
                    <label className="label">
                      {LABEL_KOMPONEN[k]}
                      {fSitasi[k] && (
                        <span className="ml-1 text-[9px] text-brand-ink" title={fSitasi[k]?.chunkSnippet}>
                          ✓ dokumen
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={fKomponen[k] ?? ''}
                      onChange={(e) => setFKomponen((prev) => ({ ...prev, [k]: e.target.value }))}
                      placeholder="opsional"
                      className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand tabular-nums"
                    />
                    {fSitasi[k] && (
                      <span className="block text-[9px] text-ink-3 mt-0.5 truncate" title={fSitasi[k]?.docName}>
                        {fSitasi[k]?.docName}
                        {fSitasi[k]?.page ? ` · hal. ${fSitasi[k]?.page}` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="label">Catatan</label>
                <textarea
                  rows={2}
                  value={fCatatan}
                  onChange={(e) => setFCatatan(e.target.value)}
                  placeholder="Mis. sumber: Laporan Keuangan Audited 2025"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>

              <p className="text-[10px] text-ink-3">
                Kosongkan komponen yang tidak ada di dokumen — jangan isi 0. Rasio yang komponennya kosong
                ditampilkan “—” (bukan angka palsu).
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sedangSimpan || !fPeriode.trim()}
                  className="px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sedangSimpan ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


export default KesehatanKeuanganPage;
