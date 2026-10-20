import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileWarning,
  Gavel,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  AksiTindakLanjut,
  RingkasanAudit,
  SumberAudit,
  StatusTindakLanjut,
  TemuanAudit,
  UserRole,
} from '../types';
import { ItemCard } from '../components/ui/ItemCard';
import {
  LABEL_STATUS_AUDIT,
  LABEL_SUMBER_AUDIT,
} from '../services/audit/tindakLanjut';

interface TindakLanjutAuditPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
  /** Peran pengguna aktif — menentukan tombol tambah/ubah/hapus temuan tampil. */
  peran?: UserRole;
}

/** Warna aksen per status tindak lanjut. */
const WARNA_STATUS: Record<StatusTindakLanjut, string> = {
  belum: 'var(--color-neg)',
  proses: 'var(--color-warn)',
  selesai: 'var(--color-pos)',
  tidak_ditindaklanjuti: 'var(--color-ink-3, #94a3b8)',
};

const KELAS_STATUS: Record<StatusTindakLanjut, string> = {
  belum: 'bg-neg/15 text-neg border-neg/30',
  proses: 'bg-warn/15 text-warn border-warn/30',
  selesai: 'bg-pos/15 text-pos border-pos/30',
  tidak_ditindaklanjuti: 'bg-surface-2 text-ink-2 border-line',
};

/** Warna aksen per sumber pemeriksa. */
const WARNA_SUMBER: Record<SumberAudit, string> = {
  bpk: 'var(--color-brand)',
  inspektorat: 'var(--color-violet)',
  bpkp: 'var(--color-coral)',
  kpk: 'var(--color-neg)',
  lainnya: 'var(--color-ink-3, #94a3b8)',
};

const IKON_SUMBER: Record<SumberAudit, React.ReactNode> = {
  bpk: <Landmark className="w-4 h-4" />,
  inspektorat: <ShieldAlert className="w-4 h-4" />,
  bpkp: <Gavel className="w-4 h-4" />,
  kpk: <Gavel className="w-4 h-4" />,
  lainnya: <FileWarning className="w-4 h-4" />,
};

/** Format angka rupiah ringkas (Rp miliar / triliun / juta). */
function rupiahRingkas(n?: number): string {
  if (!Number.isFinite(n)) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e12) return `Rp ${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T`;
  if (Math.abs(v) >= 1e9) return `Rp ${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (Math.abs(v) >= 1e6) return `Rp ${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  return `Rp ${v.toLocaleString('id-ID')}`;
}

function tanggalRingkas(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const FILTER_STATUS: Array<{ nilai: '' | StatusTindakLanjut; label: string }> = [
  { nilai: '', label: 'Semua status' },
  { nilai: 'belum', label: 'Belum Ditindaklanjuti' },
  { nilai: 'proses', label: 'Sedang Ditindaklanjuti' },
  { nilai: 'selesai', label: 'Selesai' },
  { nilai: 'tidak_ditindaklanjuti', label: 'Tidak Dapat Ditindaklanjuti' },
];

export const TindakLanjutAuditPage: React.FC<TindakLanjutAuditPageProps> = ({
  tenantId,
  onBackToWorkspace,
  peran,
}) => {
  const [temuan, setTemuan] = useState<TemuanAudit[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanAudit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'temuan' | 'rekap'>('temuan');
  const [filterSumber, setFilterSumber] = useState<'' | SumberAudit>('');
  const [filterStatus, setFilterStatus] = useState<'' | StatusTindakLanjut>('');
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);

  // Modal: tambah/ubah temuan (admin).
  const [isTemuanOpen, setIsTemuanOpen] = useState(false);
  const [temuanId, setTemuanId] = useState<string | undefined>(undefined);
  const [fSumber, setFSumber] = useState<SumberAudit>('bpk');
  const [fNomorLHP, setFNomorLHP] = useState('');
  const [fTanggalLHP, setFTanggalLHP] = useState('');
  const [fPeriode, setFPeriode] = useState('');
  const [fJudul, setFJudul] = useState('');
  const [fUraian, setFUraian] = useState('');
  const [fRekomendasi, setFRekomendasi] = useState('');
  const [fNilai, setFNilai] = useState('');
  const [fBatasWaktu, setFBatasWaktu] = useState('');
  const [fPIC, setFPIC] = useState('');

  // Modal: catat tindak lanjut.
  const [tlUntuk, setTlUntuk] = useState<TemuanAudit | null>(null);
  const [tlUraian, setTlUraian] = useState('');
  const [tlTanggal, setTlTanggal] = useState('');
  const [tlStatus, setTlStatus] = useState<StatusTindakLanjut>('proses');
  const [tlAlasan, setTlAlasan] = useState('');
  const [tlBukti, setTlBukti] = useState('');

  const [sedangSimpan, setSedangSimpan] = useState(false);

  const bisaKelolaTemuan = peran === 'admin';

  const muat = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterSumber) qs.set('sumber', filterSumber);
      if (filterStatus) qs.set('status', filterStatus);
      const res = await fetch(`/api/audit/temuan${qs.toString() ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Gagal memuat temuan audit.');
      const data = await res.json();
      setTemuan(Array.isArray(data.temuan) ? data.temuan : []);
      setRingkasan(data.ringkasan ?? null);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat data audit.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, filterSumber, filterStatus]);

  const bukaTemuanBaru = () => {
    setTemuanId(undefined);
    setFSumber('bpk');
    setFNomorLHP('');
    setFTanggalLHP(new Date().toISOString().slice(0, 10));
    setFPeriode('');
    setFJudul('');
    setFUraian('');
    setFRekomendasi('');
    setFNilai('');
    setFBatasWaktu('');
    setFPIC('');
    setIsTemuanOpen(true);
  };

  const bukaTemuanEdit = (t: TemuanAudit) => {
    setTemuanId(t.id);
    setFSumber(t.sumber);
    setFNomorLHP(t.nomorLHP);
    setFTanggalLHP(t.tanggalLHP ? t.tanggalLHP.slice(0, 10) : '');
    setFPeriode(t.periodePemeriksaan || '');
    setFJudul(t.judul);
    setFUraian(t.uraian || '');
    setFRekomendasi(t.rekomendasi);
    setFNilai(t.nilaiTemuan !== undefined ? String(t.nilaiTemuan) : '');
    setFBatasWaktu(t.batasWaktu ? t.batasWaktu.slice(0, 10) : '');
    setFPIC(t.penanggungJawab || '');
    setIsTemuanOpen(true);
  };

  const simpanTemuan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSedangSimpan(true);
    try {
      const body = {
        sumber: fSumber,
        nomorLHP: fNomorLHP,
        tanggalLHP: fTanggalLHP,
        periodePemeriksaan: fPeriode,
        judul: fJudul,
        uraian: fUraian,
        rekomendasi: fRekomendasi,
        nilaiTemuan: fNilai === '' ? undefined : Number(fNilai),
        batasWaktu: fBatasWaktu || undefined,
        penanggungJawab: fPIC,
      };
      const res = await fetch(temuanId ? `/api/audit/temuan/${temuanId}` : '/api/audit/temuan', {
        method: temuanId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan temuan.');
      }
      setIsTemuanOpen(false);
      setPesan({ tipe: 'ok', teks: temuanId ? 'Temuan audit diperbarui.' : 'Temuan audit ditambahkan.' });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan temuan.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const hapusTemuan = async (t: TemuanAudit) => {
    if (!window.confirm(`Hapus temuan "${t.judul}"? Riwayat tindak lanjutnya ikut terhapus.`)) return;
    try {
      const res = await fetch(`/api/audit/temuan/${t.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus temuan.');
      setPesan({ tipe: 'ok', teks: 'Temuan audit dihapus.' });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus temuan.' });
    }
  };

  const bukaTindakLanjut = (t: TemuanAudit) => {
    setTlUntuk(t);
    setTlUraian('');
    setTlTanggal(new Date().toISOString().slice(0, 10));
    setTlStatus(t.status === 'belum' ? 'proses' : t.status);
    setTlAlasan('');
    setTlBukti('');
  };

  const simpanTindakLanjut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tlUntuk) return;
    setSedangSimpan(true);
    try {
      const bukti = tlBukti
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((nama) => ({ nama }));
      const res = await fetch(`/api/audit/temuan/${tlUntuk.id}/tindak-lanjut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uraian: tlUraian,
          tanggal: tlTanggal,
          statusSesudah: tlStatus,
          alasan: tlAlasan,
          bukti,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan tindak lanjut.');
      }
      setTlUntuk(null);
      setPesan({ tipe: 'ok', teks: 'Tindak lanjut dicatat.' });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan tindak lanjut.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const persen = ringkasan?.persenTindakLanjut ?? 0;

  const kartuRingkasan = [
    { label: 'Total Temuan', nilai: ringkasan?.total ?? 0, warna: 'var(--color-brand)', ikon: <FileWarning className="w-4 h-4" /> },
    { label: 'Selesai', nilai: ringkasan?.selesai ?? 0, warna: 'var(--color-pos)', ikon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Dalam Proses', nilai: ringkasan?.proses ?? 0, warna: 'var(--color-warn)', ikon: <Clock className="w-4 h-4" /> },
    { label: 'Belum', nilai: ringkasan?.belum ?? 0, warna: 'var(--color-neg)', ikon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Lewat Tenggat', nilai: ringkasan?.lewatTenggat ?? 0, warna: 'var(--color-neg)', ikon: <ShieldAlert className="w-4 h-4" /> },
  ];

  const totalNilaiTeks = useMemo(() => rupiahRingkas(ringkasan?.totalNilai), [ringkasan?.totalNilai]);

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Header */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0 shadow-sm">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink flex items-center gap-2.5 flex-wrap">
                Tindak Lanjut Audit
                {ringkasan && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                      persen >= 90
                        ? 'bg-pos/15 text-pos border-pos/30'
                        : persen >= 60
                          ? 'bg-warn/15 text-warn border-warn/30'
                          : 'bg-neg/15 text-neg border-neg/30'
                    }`}
                    title="Persentase tindak lanjut rekomendasi — indikator kinerja resmi daerah"
                  >
                    {persen}% ditindaklanjuti
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Pantau temuan BPK / Inspektorat / BPKP dan tindak lanjut rekomendasinya
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void muat()}
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

        {/* Ringkasan */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {kartuRingkasan.map((k) => (
            <div key={k.label} className="bg-surface p-4 rounded-card border border-line shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-control flex items-center justify-center text-white shrink-0" style={{ background: k.warna }}>
                  {k.ikon}
                </span>
                <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">{k.label}</span>
              </div>
              <div className="text-2xl font-extrabold text-ink leading-none">{k.nilai}</div>
            </div>
          ))}
        </div>

        {/* Nilai temuan + progres tindak lanjut */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="bg-surface p-4 rounded-card border border-line flex items-center justify-between gap-4">
            <div>
              <span className="block text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Total Nilai Temuan</span>
              <span className="block text-xl font-extrabold text-ink mt-1">{totalNilaiTeks}</span>
            </div>
            <BadgeCheck className="w-8 h-8 text-ink-3 shrink-0" />
          </div>
          <div className="bg-surface p-4 rounded-card border border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">
                Progres Tindak Lanjut
              </span>
              <span className="text-sm font-extrabold text-ink">{persen}%</span>
            </div>
            <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden border border-line">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, persen)}%`,
                  background: persen >= 90 ? 'var(--color-pos)' : persen >= 60 ? 'var(--color-warn)' : 'var(--color-neg)',
                }}
              />
            </div>
            <span className="block text-[10px] text-ink-3 mt-1.5">
              (selesai + tidak dapat ditindaklanjuti) ÷ total temuan — indikator kinerja resmi daerah
            </span>
          </div>
        </div>

        {/* Tab + filter */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-line flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('temuan')}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                  activeTab === 'temuan' ? 'bg-brand text-on-brand shadow-sm' : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                }`}
              >
                Temuan ({temuan.length})
              </button>
              <button
                onClick={() => setActiveTab('rekap')}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                  activeTab === 'rekap' ? 'bg-brand text-on-brand shadow-sm' : 'bg-surface-2 text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
                }`}
              >
                Rekap per Sumber
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'temuan' && (
                <>
                  <select
                    value={filterSumber}
                    onChange={(e) => setFilterSumber(e.target.value as any)}
                    className="text-xs font-semibold bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    aria-label="Filter sumber pemeriksa"
                  >
                    <option value="">Semua sumber</option>
                    {(Object.keys(LABEL_SUMBER_AUDIT) as SumberAudit[]).map((s) => (
                      <option key={s} value={s}>
                        {LABEL_SUMBER_AUDIT[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="text-xs font-semibold bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    aria-label="Filter status tindak lanjut"
                  >
                    {FILTER_STATUS.map((f) => (
                      <option key={f.nilai} value={f.nilai}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {bisaKelolaTemuan && (
                <button
                  onClick={bukaTemuanBaru}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Temuan
                </button>
              )}
            </div>
          </div>

          <div className="pt-4">
            {isLoading ? (
              <div className="text-center py-10 text-xs text-ink-3">Memuat…</div>
            ) : activeTab === 'temuan' ? (
              temuan.length === 0 ? (
                <div className="text-center py-10">
                  <FileWarning className="w-8 h-8 text-ink-3 mx-auto mb-3" />
                  <p className="text-xs text-ink-2 mb-1 font-semibold">Belum ada temuan audit</p>
                  <p className="text-[11px] text-ink-3 max-w-md mx-auto">
                    {filterSumber || filterStatus
                      ? 'Tidak ada temuan yang cocok dengan filter. Coba ubah filter.'
                      : 'Catat temuan dari LHP agar tindak lanjut rekomendasinya bisa dipantau.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {temuan.map((t) => {
                    const aksiTerakhir = t.aksiTindakLanjut[t.aksiTindakLanjut.length - 1];
                    return (
                      <ItemCard
                        key={t.id}
                        accent={WARNA_SUMBER[t.sumber]}
                        icon={IKON_SUMBER[t.sumber]}
                        title={t.judul}
                        meta={
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{LABEL_SUMBER_AUDIT[t.sumber]}</span>
                            <span>·</span>
                            <span>{t.nomorLHP}</span>
                            <span>·</span>
                            <span>{tanggalRingkas(t.tanggalLHP)}</span>
                            {t.periodePemeriksaan && (
                              <>
                                <span>·</span>
                                <span>periode {t.periodePemeriksaan}</span>
                              </>
                            )}
                          </span>
                        }
                        trailing={
                          <span className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-chip text-[10px] font-bold border ${KELAS_STATUS[t.status]}`}>
                              {LABEL_STATUS_AUDIT[t.status]}
                            </span>
                            <button
                              onClick={() => bukaTindakLanjut(t)}
                              className="px-2.5 py-1 bg-brand hover:brightness-95 text-on-brand rounded-control text-[11px] font-medium transition-colors"
                              title="Catat tindak lanjut"
                            >
                              Tindak Lanjut
                            </button>
                            {bisaKelolaTemuan && (
                              <>
                                <button
                                  onClick={() => bukaTemuanEdit(t)}
                                  className="p-1.5 border border-line hover:bg-surface-2 text-ink-2 rounded-control transition-colors"
                                  title="Ubah temuan"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => void hapusTemuan(t)}
                                  className="p-1.5 border border-line hover:bg-neg/10 text-ink-3 hover:text-neg rounded-control transition-colors"
                                  title="Hapus temuan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </span>
                        }
                      >
                        <div className="mt-2 pt-2 border-t border-line/70 space-y-1.5">
                          <p className="text-[11px] text-ink-2">
                            <span className="font-semibold text-ink-3">Rekomendasi:</span> {t.rekomendasi}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
                            {t.nilaiTemuan !== undefined && (
                              <span>
                                Nilai: <span className="font-semibold text-ink-2">{rupiahRingkas(t.nilaiTemuan)}</span>
                              </span>
                            )}
                            {t.batasWaktu && (
                              <span className={new Date(t.batasWaktu).getTime() < Date.now() && t.status !== 'selesai' && t.status !== 'tidak_ditindaklanjuti' ? 'text-neg font-semibold' : ''}>
                                Batas: {tanggalRingkas(t.batasWaktu)}
                              </span>
                            )}
                            {t.penanggungJawab && <span>PIC: {t.penanggungJawab}</span>}
                            <span>{t.aksiTindakLanjut.length} aksi tindak lanjut</span>
                          </div>
                          {aksiTerakhir && (
                            <p className="text-[11px] text-ink-3 italic">
                              Terakhir: “{aksiTerakhir.uraian}” — {aksiTerakhir.oleh}, {tanggalRingkas(aksiTerakhir.tanggal)}
                            </p>
                          )}
                          {t.alasanTidakLanjut && (
                            <p className="text-[11px] text-warn">
                              <span className="font-semibold">Alasan tidak ditindaklanjuti:</span> {t.alasanTidakLanjut}
                            </p>
                          )}
                        </div>
                      </ItemCard>
                    );
                  })}
                </div>
              )
            ) : (
              /* ===== Rekap per sumber ===== */
              <div className="space-y-3">
                {!ringkasan || ringkasan.perSumber.length === 0 ? (
                  <div className="text-center py-10 text-xs text-ink-3">
                    Belum ada temuan untuk direkap.
                  </div>
                ) : (
                  ringkasan.perSumber.map((r) => (
                    <div key={r.sumber} className="bg-surface-2 border border-line rounded-card p-4">
                      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded-control flex items-center justify-center text-white shrink-0"
                            style={{ background: WARNA_SUMBER[r.sumber] }}
                          >
                            {IKON_SUMBER[r.sumber]}
                          </span>
                          <span className="text-sm font-bold text-ink">{LABEL_SUMBER_AUDIT[r.sumber]}</span>
                        </span>
                        <span className="text-[11px] text-ink-2">
                          {r.selesai}/{r.total} ditindaklanjuti · <span className="font-bold text-ink">{r.persenTindakLanjut}%</span>
                        </span>
                      </div>
                      <div className="h-2 bg-surface rounded-full overflow-hidden border border-line">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, r.persenTindakLanjut)}%`,
                            background: WARNA_SUMBER[r.sumber],
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Modal: Tambah/Ubah Temuan (admin) ===== */}
      {isTemuanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsTemuanOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-brand" />
                {temuanId ? 'Ubah Temuan Audit' : 'Tambah Temuan Audit'}
              </h3>
              <button onClick={() => setIsTemuanOpen(false)} className="text-ink-3 hover:text-ink-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={simpanTemuan} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Sumber Pemeriksa</label>
                  <select
                    value={fSumber}
                    onChange={(e) => setFSumber(e.target.value as SumberAudit)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {(Object.keys(LABEL_SUMBER_AUDIT) as SumberAudit[]).map((s) => (
                      <option key={s} value={s}>
                        {LABEL_SUMBER_AUDIT[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Tanggal LHP</label>
                  <input
                    type="date"
                    value={fTanggalLHP}
                    onChange={(e) => setFTanggalLHP(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Nomor LHP *</label>
                  <input
                    type="text"
                    required
                    value={fNomorLHP}
                    onChange={(e) => setFNomorLHP(e.target.value)}
                    placeholder="mis. 05/LHP/XX/2025"
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Periode Diperiksa</label>
                  <input
                    type="text"
                    value={fPeriode}
                    onChange={(e) => setFPeriode(e.target.value)}
                    placeholder="mis. 2024"
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">Judul Temuan *</label>
                <input
                  type="text"
                  required
                  value={fJudul}
                  onChange={(e) => setFJudul(e.target.value)}
                  placeholder="Ringkasan singkat temuan"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">Uraian</label>
                <textarea
                  rows={3}
                  value={fUraian}
                  onChange={(e) => setFUraian(e.target.value)}
                  placeholder="Kondisi, kriteria, sebab, akibat"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div>
                <label className="block text-ink-2 font-medium mb-1">Rekomendasi *</label>
                <textarea
                  rows={3}
                  required
                  value={fRekomendasi}
                  onChange={(e) => setFRekomendasi(e.target.value)}
                  placeholder="Apa yang direkomendasikan pemeriksa"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Nilai (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={fNilai}
                    onChange={(e) => setFNilai(e.target.value)}
                    placeholder="opsional"
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Batas Waktu</label>
                  <input
                    type="date"
                    value={fBatasWaktu}
                    onChange={(e) => setFBatasWaktu(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">PIC</label>
                  <input
                    type="text"
                    value={fPIC}
                    onChange={(e) => setFPIC(e.target.value)}
                    placeholder="Unit/pejabat"
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemuanOpen(false)}
                  className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sedangSimpan || !fJudul.trim() || !fRekomendasi.trim() || !fNomorLHP.trim()}
                  className="px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sedangSimpan ? 'Menyimpan…' : 'Simpan Temuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: Catat Tindak Lanjut ===== */}
      {tlUntuk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setTlUntuk(null)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-brand" />
                Catat Tindak Lanjut
              </h3>
              <button onClick={() => setTlUntuk(null)} className="text-ink-3 hover:text-ink-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-surface-2 border border-line rounded-card">
              <span className="block font-semibold text-ink">{tlUntuk.judul}</span>
              <span className="block text-[11px] text-ink-3 mt-0.5">
                {LABEL_SUMBER_AUDIT[tlUntuk.sumber]} · {tlUntuk.nomorLHP}
              </span>
              <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-chip text-[10px] font-bold border ${KELAS_STATUS[tlUntuk.status]}`}>
                {LABEL_STATUS_AUDIT[tlUntuk.status]}
              </span>
            </div>

            {/* Jejak tindak lanjut sebelumnya */}
            {tlUntuk.aksiTindakLanjut.length > 0 && (
              <div>
                <span className="block text-ink-2 font-medium mb-1.5">Jejak tindak lanjut</span>
                <ol className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {tlUntuk.aksiTindakLanjut.map((a: AksiTindakLanjut) => (
                    <li key={a.id} className="flex items-start gap-2 text-[11px] text-ink-2 bg-surface-2 border border-line rounded-control px-2.5 py-1.5">
                      <span
                        className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: WARNA_STATUS[a.statusSesudah] }}
                      />
                      <span className="flex-1">
                        {a.uraian}
                        <span className="block text-ink-3 mt-0.5">
                          {a.oleh} · {tanggalRingkas(a.tanggal)}
                          {a.bukti.length > 0 ? ` · ${a.bukti.length} bukti` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <form onSubmit={simpanTindakLanjut} className="space-y-3">
              <div>
                <label className="block text-ink-2 font-medium mb-1">Uraian Tindak Lanjut *</label>
                <textarea
                  rows={3}
                  required
                  value={tlUraian}
                  onChange={(e) => setTlUraian(e.target.value)}
                  placeholder="Apa yang sudah/akan dikerjakan"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={tlTanggal}
                    onChange={(e) => setTlTanggal(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Status Sesudah</label>
                  <select
                    value={tlStatus}
                    onChange={(e) => setTlStatus(e.target.value as StatusTindakLanjut)}
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="proses">Sedang Ditindaklanjuti</option>
                    <option value="selesai">Selesai</option>
                    <option value="tidak_ditindaklanjuti">Tidak Dapat Ditindaklanjuti</option>
                  </select>
                </div>
              </div>
              {tlStatus === 'tidak_ditindaklanjuti' && (
                <div>
                  <label className="block text-ink-2 font-medium mb-1">Alasan *</label>
                  <textarea
                    rows={2}
                    required
                    value={tlAlasan}
                    onChange={(e) => setTlAlasan(e.target.value)}
                    placeholder="Mengapa temuan tidak dapat ditindaklanjuti"
                    className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-ink-2 font-medium mb-1">Bukti (satu per baris)</label>
                <textarea
                  rows={2}
                  value={tlBukti}
                  onChange={(e) => setTlBukti(e.target.value)}
                  placeholder="mis. BA-Tindak-Lanjut-2025.pdf"
                  className="w-full px-3 py-2 border border-line rounded-control bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTlUntuk(null)}
                  className="px-4 py-2 border border-line rounded-control text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sedangSimpan || !tlUraian.trim() || (tlStatus === 'tidak_ditindaklanjuti' && !tlAlasan.trim())}
                  className="px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sedangSimpan ? 'Menyimpan…' : 'Simpan Tindak Lanjut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
