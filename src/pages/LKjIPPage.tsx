import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  BagianLKjIP,
  LKjIP,
  PerjanjianKinerja,
  RingkasanLKjIP,
  StatusLKjIP,
  UserRole,
} from '../types';
import { LABEL_STATUS_LKJIP, URUTAN_STATUS_LKJIP } from '../services/kinerja/lkjip';

interface LKjIPPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
  peran?: UserRole;
}

/** LKjIP + data tertaut yang dilampirkan API. */
type LKjIPTampil = LKjIP & {
  capaianTertaut?: { terealisasi: number; tercapai: number; rataCapaian: number | null };
  pkTertaut?: Array<{ id: string; nomor: string; periode: string; status: string; jumlahIndikator: number }>;
};

const KELAS_STATUS: Record<StatusLKjIP, string> = {
  draf: 'bg-surface-2 text-ink-2 border-line',
  final: 'bg-pos/15 text-pos border-pos/30',
};

function tanggalRingkas(iso?: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const LKjIPPage: React.FC<LKjIPPageProps> = ({ tenantId, onBackToWorkspace, peran }) => {
  const [daftar, setDaftar] = useState<LKjIPTampil[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanLKjIP | null>(null);
  const [daftarPK, setDaftarPK] = useState<PerjanjianKinerja[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);
  const [filterPeriode, setFilterPeriode] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [bukaId, setBukaId] = useState<string | null>(null);

  const bisaKelola = peran === 'admin';

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fPeriode, setFPeriode] = useState(String(new Date().getFullYear() - 1));
  const [fNomor, setFNomor] = useState('');
  const [fJudul, setFJudul] = useState('');
  const [fStatus, setFStatus] = useState<StatusLKjIP>('draf');
  const [fTanggal, setFTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [fRingkasan, setFRingkasan] = useState('');
  const [fBagian, setFBagian] = useState<Array<{ judul: string; isi: string }>>([]);
  const [fPKIds, setFPKIds] = useState<string[]>([]);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const muat = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterPeriode) qs.set('periode', filterPeriode);
      if (filterStatus) qs.set('status', filterStatus);
      const [resLk, resPk] = await Promise.all([
        fetch(`/api/lkjip${qs.toString() ? `?${qs}` : ''}`),
        fetch('/api/perjanjian-kinerja'),
      ]);
      if (!resLk.ok) throw new Error('Gagal memuat LKjIP.');
      const data = await resLk.json();
      setDaftar(data.lkjip || []);
      setRingkasan(data.ringkasan || null);
      if (resPk.ok) {
        const dPk = await resPk.json();
        setDaftarPK(dPk.perjanjianKinerja || []);
      }
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat LKjIP.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, filterPeriode, filterStatus]);

  const daftarPeriode = useMemo(() => {
    const set = new Set(daftar.map((l) => l.periode).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [daftar]);

  const bukaTambah = () => {
    setEditId(null);
    setFPeriode(String(new Date().getFullYear() - 1));
    setFNomor(`LKJIP-${new Date().getFullYear() - 1}`);
    setFJudul(`Laporan Kinerja Instansi Pemerintah Tahun ${new Date().getFullYear() - 1}`);
    setFStatus('draf');
    setFTanggal(new Date().toISOString().slice(0, 10));
    setFRingkasan('');
    setFBagian([
      { judul: 'Ringkasan Eksekutif', isi: '' },
      { judul: 'Analisis Capaian Kinerja', isi: '' },
      { judul: 'Kendala & Permasalahan', isi: '' },
      { judul: 'Tindak Lanjut & Rencana Perbaikan', isi: '' },
    ]);
    setFPKIds([]);
    setIsOpen(true);
  };

  const bukaUbah = (l: LKjIPTampil) => {
    setEditId(l.id);
    setFPeriode(l.periode);
    setFNomor(l.nomor);
    setFJudul(l.judul);
    setFStatus(l.status);
    setFTanggal(l.tanggal ? l.tanggal.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFRingkasan(l.ringkasanEksekutif || '');
    setFBagian(l.bagian.map((b) => ({ judul: b.judul, isi: b.isi })));
    setFPKIds(l.perjanjianKinerjaIds || []);
    setIsOpen(true);
  };

  const simpan = async () => {
    if (!fPeriode.trim()) return setPesan({ tipe: 'err', teks: 'Periode wajib diisi.' });
    if (!fNomor.trim()) return setPesan({ tipe: 'err', teks: 'Nomor wajib diisi.' });
    if (!fJudul.trim()) return setPesan({ tipe: 'err', teks: 'Judul wajib diisi.' });
    for (const [i, b] of fBagian.entries()) {
      if (!b.judul.trim()) return setPesan({ tipe: 'err', teks: `Bagian #${i + 1}: judul wajib diisi.` });
      if (!b.isi.trim()) return setPesan({ tipe: 'err', teks: `Bagian #${i + 1}: isi wajib diisi.` });
    }
    setSedangSimpan(true);
    try {
      const body = {
        periode: fPeriode.trim(),
        nomor: fNomor.trim(),
        judul: fJudul.trim(),
        status: fStatus,
        tanggal: fTanggal ? new Date(fTanggal).toISOString() : undefined,
        ringkasanEksekutif: fRingkasan.trim(),
        bagian: fBagian.map((b) => ({ judul: b.judul.trim(), isi: b.isi.trim() })),
        perjanjianKinerjaIds: fPKIds,
      };
      const res = await fetch(editId ? `/api/lkjip/${editId}` : '/api/lkjip', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setIsOpen(false);
      setPesan({ tipe: 'ok', teks: editId ? 'LKjIP diperbarui.' : `LKjIP ${data.nomor} dibuat.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const hapus = async (l: LKjIPTampil) => {
    try {
      const res = await fetch(`/api/lkjip/${l.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menghapus.');
      }
      setPesan({ tipe: 'ok', teks: `LKjIP ${l.nomor} dihapus.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus.' });
    }
  };

  const kartuRingkas = useMemo(
    () => [
      { label: 'Dokumen LKjIP', nilai: String(ringkasan?.total ?? 0), ikon: <BookOpen className="w-4 h-4" />, warna: 'bg-brand' },
      { label: 'Indikator Tercapai', nilai: String(ringkasan?.indikatorTercapai ?? 0), ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-pos' },
      {
        label: 'Rata Capaian',
        nilai: ringkasan?.rataCapaian === null || ringkasan?.rataCapaian === undefined ? '—' : `${ringkasan.rataCapaian}%`,
        ikon: <TrendingUp className="w-4 h-4" />,
        warna: 'bg-warn',
      },
      { label: 'Lewat Tenggat', nilai: String(ringkasan?.lewatTenggat ?? 0), ikon: <Clock className="w-4 h-4" />, warna: 'bg-neg' },
    ],
    [ringkasan]
  );

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Header */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink">LKjIP</h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Laporan Kinerja Instansi Pemerintah — disusun dari Perjanjian Kinerja periode berjalan
              </p>
              <p className="text-[11px] text-ink-3 mt-1">
                Dasar: Perpres 29/2014 (SAKIP) · PermenPANRB 53/2014 · Permendagri 37/2018 — disampaikan paling lambat 2 bulan setelah tahun anggaran berakhir
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
            {bisaKelola && (
              <button
                onClick={bukaTambah}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Susun LKjIP</span>
              </button>
            )}
          </div>
        </div>

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

        {/* Kartu ringkas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {kartuRingkas.map((k) => (
            <div key={k.label} className="bg-surface p-4 rounded-card border border-line shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-control flex items-center justify-center text-on-brand shrink-0 ${k.warna}`}>
                  {k.ikon}
                </span>
                <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">{k.label}</span>
              </div>
              <div className="text-2xl font-extrabold text-ink leading-none tabular-nums">{k.nilai}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-bold text-ink">Dokumen LKjIP</h2>
          <div className="flex items-center gap-2">
            <select
              value={filterPeriode}
              onChange={(e) => setFilterPeriode(e.target.value)}
              className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Filter periode"
            >
              <option value="">Semua periode</option>
              {daftarPeriode.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Filter status"
            >
              <option value="">Semua status</option>
              {URUTAN_STATUS_LKJIP.map((s) => (
                <option key={s} value={s}>
                  {LABEL_STATUS_LKJIP[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-xs text-ink-3">Memuat…</div>
        ) : daftar.length === 0 ? (
          <div className="bg-surface p-10 rounded-card border border-line text-center">
            <BookOpen className="w-10 h-10 text-ink-3 mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink mb-1">Belum ada LKjIP</p>
            <p className="text-xs text-ink-3 max-w-md mx-auto mb-5">
              {bisaKelola
                ? 'Susun laporan kinerja tahunan — capaian ditarik otomatis dari Perjanjian Kinerja yang ditautkan.'
                : 'Hubungi admin instansi untuk menyusun LKjIP.'}
            </p>
            {bisaKelola && (
              <button
                onClick={bukaTambah}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Susun LKjIP
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {daftar.map((l) => {
              const terbuka = bukaId === l.id;
              const cap = l.capaianTertaut;
              return (
                <div key={l.id} className="bg-surface rounded-card border border-line shadow-2xs overflow-hidden">
                  <div className="p-4 flex items-start gap-3">
                    <button
                      onClick={() => setBukaId(terbuka ? null : l.id)}
                      className="mt-0.5 shrink-0 text-ink-3 hover:text-ink"
                      aria-label={terbuka ? 'Tutup rincian' : 'Buka rincian'}
                    >
                      {terbuka ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-ink font-mono">{l.nomor}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${KELAS_STATUS[l.status]}`}>
                          {LABEL_STATUS_LKJIP[l.status]}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-surface-2 text-ink-2 font-medium">
                          Tahun {l.periode}
                        </span>
                        {l.status === 'draf' && (
                          <span className="text-[11px] text-ink-3">Tenggat: 28 Feb {Number(l.periode) + 1}</span>
                        )}
                      </div>
                      <p className="text-sm text-ink font-medium">{l.judul}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-3 flex-wrap">
                        <span>Disusun {tanggalRingkas(l.tanggal)}</span>
                        <span>{l.bagian.length} bagian</span>
                        <span>{l.perjanjianKinerjaIds.length} PK tertaut</span>
                        {cap && cap.rataCapaian !== null && (
                          <span className="font-semibold text-ink-2">
                            Capaian rata-rata {cap.rataCapaian}% ({cap.tercapai}/{cap.terealisasi} indikator tercapai)
                          </span>
                        )}
                      </div>
                    </div>
                    {bisaKelola && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => bukaUbah(l)}
                          className="p-1.5 text-ink-3 hover:text-brand-ink rounded-control hover:bg-brand/10 transition-colors"
                          aria-label="Ubah LKjIP"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void hapus(l)}
                          className="p-1.5 text-ink-3 hover:text-neg rounded-control hover:bg-neg/10 transition-colors"
                          aria-label="Hapus LKjIP"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {terbuka && (
                    <div className="border-t border-line bg-surface-2/40 p-4 space-y-4 text-xs">
                      {l.ringkasanEksekutif && (
                        <div>
                          <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1">Ringkasan Eksekutif</div>
                          <p className="text-ink-2 whitespace-pre-line">{l.ringkasanEksekutif}</p>
                        </div>
                      )}

                      {/* PK tertaut — sumber angka capaian */}
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
                          <Link2 className="w-3.5 h-3.5" />
                          Perjanjian Kinerja Tertaut
                        </div>
                        {!l.pkTertaut || l.pkTertaut.length === 0 ? (
                          <p className="text-ink-3 italic">Belum ada Perjanjian Kinerja ditautkan — capaian tidak bisa dihitung.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {l.pkTertaut.map((p) => (
                              <span key={p.id} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-control border border-line bg-surface">
                                <FileText className="w-3 h-3 text-ink-3" />
                                <span className="font-mono text-ink-2">{p.nomor}</span>
                                <span className="text-ink-3">· {p.jumlahIndikator} indikator</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bab/bagian */}
                      <div>
                        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
                          Isi Laporan ({l.bagian.length} bagian)
                        </div>
                        <div className="space-y-3">
                          {l.bagian.map((b: BagianLKjIP) => (
                            <div key={b.id} className="border-l-2 border-brand/40 pl-3">
                              <div className="font-semibold text-ink">{b.judul}</div>
                              <p className="text-ink-2 mt-0.5 whitespace-pre-line">{b.isi}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Modal: Susun/Ubah LKjIP ===== */}
      {isOpen && (
        <div className="modal-layer">
          <div className="scrim" onClick={() => setIsOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-modal-lkjip"
            className="relative w-full max-w-3xl bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="judul-modal-lkjip" className="font-bold text-sm text-ink">
                {editId ? 'Ubah LKjIP' : 'Susun LKjIP'}
              </h3>
              <button onClick={() => setIsOpen(false)} aria-label="Tutup" className="text-ink-3 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-strong">Tahun anggaran *</label>
                  <input
                    type="text"
                    value={fPeriode}
                    onChange={(e) => setFPeriode(e.target.value)}
                    placeholder="2026"
                    className="field"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label-strong">Nomor *</label>
                  <input
                    type="text"
                    value={fNomor}
                    onChange={(e) => setFNomor(e.target.value)}
                    className="field"
                  />
                </div>
              </div>
              <div>
                <label className="label-strong">Judul laporan *</label>
                <input
                  type="text"
                  value={fJudul}
                  onChange={(e) => setFJudul(e.target.value)}
                  className="field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-strong">Tanggal penyusunan</label>
                  <input
                    type="date"
                    value={fTanggal}
                    onChange={(e) => setFTanggal(e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label-strong">Status</label>
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value as StatusLKjIP)}
                    className="field"
                  >
                    {URUTAN_STATUS_LKJIP.map((s) => (
                      <option key={s} value={s}>
                        {LABEL_STATUS_LKJIP[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tautan PK */}
              <div className="border-t border-line pt-3">
                <div className="font-bold text-ink mb-2">Perjanjian Kinerja Tertaut</div>
                {daftarPK.length === 0 ? (
                  <p className="text-[11px] text-ink-3 italic">
                    Belum ada Perjanjian Kinerja untuk instansi ini — buat dulu di menu Perjanjian Kinerja agar capaian bisa dihitung.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-control bg-surface-2 border border-line">
                    {daftarPK.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 cursor-pointer hover:bg-surface rounded-control p-1.5">
                        <input
                          type="checkbox"
                          checked={fPKIds.includes(p.id)}
                          onChange={(e) =>
                            setFPKIds((lama) => (e.target.checked ? [...lama, p.id] : lama.filter((x) => x !== p.id)))
                          }
                          className="mt-0.5 accent-[var(--brand)]"
                        />
                        <span className="text-ink-2">
                          <span className="font-mono font-semibold">{p.nomor}</span> · {p.periode} ·{' '}
                          <span className="text-ink-3">{p.indikator.length} indikator</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label-strong">Ringkasan eksekutif</label>
                <textarea
                  value={fRingkasan}
                  onChange={(e) => setFRingkasan(e.target.value)}
                  rows={3}
                  className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>

              {/* Bagian/bab */}
              <div className="border-t border-line pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-ink">Isi Laporan ({fBagian.length} bagian)</span>
                  <button
                    onClick={() => setFBagian((l) => [...l, { judul: '', isi: '' }])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah bagian
                  </button>
                </div>
                <div className="space-y-3">
                  {fBagian.map((b, idx) => (
                    <div key={idx} className="p-3 rounded-control bg-surface-2 border border-line space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={b.judul}
                          onChange={(e) => setFBagian((l) => l.map((x, k) => (k === idx ? { ...x, judul: e.target.value } : x)))}
                          placeholder="Judul bagian"
                          className="flex-1 px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink font-semibold focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        {fBagian.length > 1 && (
                          <button
                            onClick={() => setFBagian((l) => l.filter((_, k) => k !== idx))}
                            className="text-ink-3 hover:text-neg shrink-0"
                            aria-label="Hapus bagian"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={b.isi}
                        onChange={(e) => setFBagian((l) => l.map((x, k) => (k === idx ? { ...x, isi: e.target.value } : x)))}
                        rows={3}
                        placeholder="Isi naratif bagian ini"
                        className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-ink-2 bg-surface-2 hover:bg-line/40 border border-line rounded-control transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => void simpan()}
                disabled={sedangSimpan}
                className="px-4 py-2 text-xs font-semibold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60"
              >
                {sedangSimpan ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
