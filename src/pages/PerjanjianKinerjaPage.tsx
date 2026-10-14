import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileSignature,
  Pencil,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ArahIndikator,
  IndikatorKinerja,
  PerjanjianKinerja,
  RingkasanPerjanjianKinerja,
  StatusPerjanjianKinerja,
  UserRole,
} from '../types';
import {
  LABEL_ARAH,
  LABEL_STATUS_PK,
  URUTAN_STATUS_PK,
  hitungCapaian,
  kategoriCapaian,
} from '../services/kinerja/perjanjianKinerja';

interface PerjanjianKinerjaPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
  peran?: UserRole;
}

/** Kelas badge per status dokumen. */
const KELAS_STATUS: Record<StatusPerjanjianKinerja, string> = {
  draf: 'bg-surface-2 text-ink-2 border-line',
  aktif: 'bg-pos/15 text-pos border-pos/30',
  ditutup: 'bg-ink/10 text-ink-3 border-line',
};

/** Kelas badge per kategori capaian. */
const KELAS_CAPAIAN: Record<ReturnType<typeof kategoriCapaian>, string> = {
  tercapai: 'bg-pos/15 text-pos border-pos/30',
  dekat: 'bg-warn/15 text-warn border-warn/30',
  jauh: 'bg-neg/15 text-neg border-neg/30',
  belum: 'bg-surface-2 text-ink-3 border-line',
};

function tanggalRingkas(iso?: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function angkaRingkas(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export const PerjanjianKinerjaPage: React.FC<PerjanjianKinerjaPageProps> = ({ tenantId, onBackToWorkspace, peran }) => {
  const [daftar, setDaftar] = useState<PerjanjianKinerja[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanPerjanjianKinerja | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);
  const [filterPeriode, setFilterPeriode] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [bukaId, setBukaId] = useState<string | null>(null);

  const bisaKelola = peran === 'admin';

  // Modal tambah/ubah dokumen.
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fNomor, setFNomor] = useState('');
  const [fPeriode, setFPeriode] = useState(String(new Date().getFullYear()));
  const [fPihak1, setFPihak1] = useState('');
  const [fJab1, setFJab1] = useState('Direktur Utama');
  const [fPihak2, setFPihak2] = useState('');
  const [fJab2, setFJab2] = useState('');
  const [fTanggal, setFTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [fStatus, setFStatus] = useState<StatusPerjanjianKinerja>('draf');
  const [fCatatan, setFCatatan] = useState('');
  const [fIndikator, setFIndikator] = useState<Array<Omit<IndikatorKinerja, 'id'>>>([]);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  // Modal catat realisasi.
  const [realisasiUntuk, setRealisasiUntuk] = useState<{ pk: PerjanjianKinerja; ind: IndikatorKinerja } | null>(null);
  const [rNilai, setRNilai] = useState('');
  const [rCatatan, setRCatatan] = useState('');

  const muat = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterPeriode) qs.set('periode', filterPeriode);
      if (filterStatus) qs.set('status', filterStatus);
      const res = await fetch(`/api/perjanjian-kinerja${qs.toString() ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Gagal memuat Perjanjian Kinerja.');
      const data = await res.json();
      setDaftar(data.perjanjianKinerja || []);
      setRingkasan(data.ringkasan || null);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat Perjanjian Kinerja.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, filterPeriode, filterStatus]);

  const daftarPeriode = useMemo(() => {
    const set = new Set(daftar.map((p) => p.periode).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [daftar]);

  const indikatorKosong = (): Omit<IndikatorKinerja, 'id'> => ({
    sasaran: '',
    indikator: '',
    satuan: '%',
    target: 0,
    arah: 'maksimal',
  });

  const bukaTambah = () => {
    setEditId(null);
    setFNomor(`PK-${String((ringkasan?.total || 0) + 1).padStart(2, '0')}/DIR/${new Date().getFullYear()}`);
    setFPeriode(String(new Date().getFullYear()));
    setFPihak1('');
    setFJab1('Direktur Utama');
    setFPihak2('');
    setFJab2('');
    setFTanggal(new Date().toISOString().slice(0, 10));
    setFStatus('draf');
    setFCatatan('');
    setFIndikator([indikatorKosong()]);
    setIsOpen(true);
  };

  const bukaUbah = (p: PerjanjianKinerja) => {
    setEditId(p.id);
    setFNomor(p.nomor);
    setFPeriode(p.periode);
    setFPihak1(p.pihakPertama);
    setFJab1(p.jabatanPertama);
    setFPihak2(p.pihakKedua);
    setFJab2(p.jabatanKedua);
    setFTanggal(p.tanggal ? p.tanggal.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFStatus(p.status);
    setFCatatan(p.catatan || '');
    setFIndikator(
      p.indikator.map((i) => ({
        sasaran: i.sasaran,
        indikator: i.indikator,
        satuan: i.satuan,
        target: i.target,
        arah: i.arah,
        realisasi: i.realisasi,
        catatanRealisasi: i.catatanRealisasi,
      }))
    );
    setIsOpen(true);
  };

  const ubahIndikator = (idx: number, patch: Partial<Omit<IndikatorKinerja, 'id'>>) => {
    setFIndikator((lama) => lama.map((i, k) => (k === idx ? { ...i, ...patch } : i)));
  };

  const simpan = async () => {
    if (!fNomor.trim()) return setPesan({ tipe: 'err', teks: 'Nomor wajib diisi.' });
    if (!fPeriode.trim()) return setPesan({ tipe: 'err', teks: 'Periode wajib diisi.' });
    if (!fPihak2.trim()) return setPesan({ tipe: 'err', teks: 'Pihak kedua wajib diisi.' });
    for (const [i, ind] of fIndikator.entries()) {
      if (!ind.sasaran.trim()) return setPesan({ tipe: 'err', teks: `Indikator #${i + 1}: sasaran wajib diisi.` });
      if (!ind.indikator.trim()) return setPesan({ tipe: 'err', teks: `Indikator #${i + 1}: rumusan indikator wajib diisi.` });
      if (!ind.satuan.trim()) return setPesan({ tipe: 'err', teks: `Indikator #${i + 1}: satuan wajib diisi.` });
    }
    setSedangSimpan(true);
    try {
      const body = {
        nomor: fNomor.trim(),
        periode: fPeriode.trim(),
        pihakPertama: fPihak1.trim(),
        jabatanPertama: fJab1.trim(),
        pihakKedua: fPihak2.trim(),
        jabatanKedua: fJab2.trim(),
        tanggal: fTanggal ? new Date(fTanggal).toISOString() : undefined,
        status: fStatus,
        catatan: fCatatan.trim() || undefined,
        indikator: fIndikator.map((i) => ({
          ...i,
          sasaran: i.sasaran.trim(),
          indikator: i.indikator.trim(),
          satuan: i.satuan.trim(),
          target: Number(i.target) || 0,
        })),
      };
      const res = await fetch(editId ? `/api/perjanjian-kinerja/${editId}` : '/api/perjanjian-kinerja', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setIsOpen(false);
      setPesan({ tipe: 'ok', teks: editId ? 'Perjanjian Kinerja diperbarui.' : `Dokumen ${data.nomor} dibuat.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const hapus = async (p: PerjanjianKinerja) => {
    try {
      const res = await fetch(`/api/perjanjian-kinerja/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menghapus.');
      }
      setPesan({ tipe: 'ok', teks: `Dokumen ${p.nomor} dihapus.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus.' });
    }
  };

  const bukaRealisasi = (pk: PerjanjianKinerja, ind: IndikatorKinerja) => {
    setRealisasiUntuk({ pk, ind });
    setRNilai(ind.realisasi !== undefined ? String(ind.realisasi) : '');
    setRCatatan(ind.catatanRealisasi || '');
  };

  const simpanRealisasi = async () => {
    if (!realisasiUntuk) return;
    const nilai = Number(rNilai);
    if (!Number.isFinite(nilai) || nilai < 0) {
      return setPesan({ tipe: 'err', teks: 'Realisasi harus angka tidak negatif.' });
    }
    setSedangSimpan(true);
    try {
      const res = await fetch(`/api/perjanjian-kinerja/${realisasiUntuk.pk.id}/realisasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indikatorId: realisasiUntuk.ind.id, realisasi: nilai, catatanRealisasi: rCatatan.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencatat realisasi.');
      setRealisasiUntuk(null);
      setPesan({ tipe: 'ok', teks: 'Realisasi tercatat.' });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal mencatat realisasi.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const kartuRingkas = useMemo(
    () => [
      { label: 'Dokumen', nilai: String(ringkasan?.total ?? 0), ikon: <FileSignature className="w-4 h-4" />, warna: 'bg-brand' },
      { label: 'Indikator', nilai: String(ringkasan?.jumlahIndikator ?? 0), ikon: <ClipboardList className="w-4 h-4" />, warna: 'bg-ink' },
      { label: 'Indikator Tercapai', nilai: String(ringkasan?.indikatorTercapai ?? 0), ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-pos' },
      {
        label: 'Capaian Rata-rata',
        nilai: ringkasan?.capaianRataRata === null || ringkasan?.capaianRataRata === undefined ? '—' : `${ringkasan.capaianRataRata}%`,
        ikon: <TrendingUp className="w-4 h-4" />,
        warna: 'bg-warn',
      },
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
              <FileSignature className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink">Perjanjian Kinerja</h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Dokumen komitmen target kinerja (sasaran → indikator → target) beserta capaiannya
              </p>
              <p className="text-[11px] text-ink-3 mt-1">
                Dasar: PermenPANRB 53/2014 (Juknis Perjanjian Kinerja) · Permendagri 37/2018 — persentase capaian dihitung otomatis
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Perjanjian Kinerja</span>
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
          <h2 className="text-sm font-bold text-ink">Dokumen Perjanjian Kinerja</h2>
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
              {URUTAN_STATUS_PK.map((s) => (
                <option key={s} value={s}>
                  {LABEL_STATUS_PK[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-xs text-ink-3">Memuat…</div>
        ) : daftar.length === 0 ? (
          <div className="bg-surface p-10 rounded-card border border-line text-center">
            <FileSignature className="w-10 h-10 text-ink-3 mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink mb-1">Belum ada Perjanjian Kinerja</p>
            <p className="text-xs text-ink-3 max-w-md mx-auto mb-5">
              {bisaKelola
                ? 'Buat dokumen komitmen kinerja: sasaran, indikator, dan target. Capaian dicatat belakangan.'
                : 'Hubungi admin instansi untuk membuat Perjanjian Kinerja.'}
            </p>
            {bisaKelola && (
              <button
                onClick={bukaTambah}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Perjanjian Kinerja
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {daftar.map((p) => {
              const terbuka = bukaId === p.id;
              const jumlahTercapai = p.indikator.filter((i) => {
                const c = hitungCapaian(i);
                return c !== null && c >= 100;
              }).length;
              const jumlahTerealisasi = p.indikator.filter((i) => i.realisasi !== undefined).length;
              return (
                <div key={p.id} className="bg-surface rounded-card border border-line shadow-2xs overflow-hidden">
                  <div className="p-4 flex items-start gap-3">
                    <button
                      onClick={() => setBukaId(terbuka ? null : p.id)}
                      className="mt-0.5 shrink-0 text-ink-3 hover:text-ink"
                      aria-label={terbuka ? 'Tutup rincian' : 'Buka rincian'}
                    >
                      {terbuka ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-ink font-mono">{p.nomor}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${KELAS_STATUS[p.status]}`}>
                          {LABEL_STATUS_PK[p.status]}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-surface-2 text-ink-2 font-medium">
                          Periode {p.periode}
                        </span>
                      </div>
                      <p className="text-sm text-ink font-medium">
                        {p.pihakKedua}
                        {p.jabatanKedua ? <span className="text-ink-3 font-normal"> · {p.jabatanKedua}</span> : null}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-3 flex-wrap">
                        <span>Ditandatangani {tanggalRingkas(p.tanggal)}</span>
                        <span>
                          {p.indikator.length} indikator · {jumlahTerealisasi} terealisasi · {jumlahTercapai} tercapai
                        </span>
                      </div>
                    </div>
                    {bisaKelola && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => bukaUbah(p)}
                          className="p-1.5 text-ink-3 hover:text-brand-ink rounded-control hover:bg-brand/10 transition-colors"
                          aria-label="Ubah dokumen"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void hapus(p)}
                          className="p-1.5 text-ink-3 hover:text-neg rounded-control hover:bg-neg/10 transition-colors"
                          aria-label="Hapus dokumen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {terbuka && (
                    <div className="border-t border-line bg-surface-2/40">
                      {p.indikator.length === 0 ? (
                        <p className="p-4 text-xs text-ink-3 italic">Dokumen ini belum punya indikator.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-ink-3 border-b border-line">
                                <th className="py-2 px-3 font-semibold">Sasaran</th>
                                <th className="py-2 px-3 font-semibold">Indikator</th>
                                <th className="py-2 px-3 font-semibold text-right">Target</th>
                                <th className="py-2 px-3 font-semibold text-right">Realisasi</th>
                                <th className="py-2 px-3 font-semibold text-right">Capaian</th>
                                <th className="py-2 px-3 font-semibold text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.indikator.map((ind) => {
                                const c = hitungCapaian(ind);
                                const kat = kategoriCapaian(c);
                                return (
                                  <tr key={ind.id} className="border-b border-line/50 last:border-0">
                                    <td className="py-2 px-3 text-ink-2">{ind.sasaran}</td>
                                    <td className="py-2 px-3 text-ink">
                                      {ind.indikator}
                                      <span className="text-ink-3"> ({ind.satuan})</span>
                                      {ind.arah === 'minimal' && (
                                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border border-line bg-surface text-ink-3">
                                          ↓ semakin rendah semakin baik
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-ink-2">{angkaRingkas(ind.target)}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-ink">
                                      {ind.realisasi !== undefined ? angkaRingkas(ind.realisasi) : <span className="text-ink-3">—</span>}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold tabular-nums ${KELAS_CAPAIAN[kat]}`}>
                                        {c === null ? 'Belum ada' : `${c}%`}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                      <button
                                        onClick={() => bukaRealisasi(p, ind)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-ink bg-surface hover:bg-brand/10 border border-line rounded-control transition-colors"
                                      >
                                        <Target className="w-3 h-3" />
                                        Catat Realisasi
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {p.catatan && <p className="px-4 pb-3 text-[11px] text-ink-3">Catatan: {p.catatan}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Modal: Buat/Ubah Perjanjian Kinerja ===== */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-modal-pk"
            className="relative w-full max-w-3xl bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="judul-modal-pk" className="font-bold text-sm text-ink">
                {editId ? 'Ubah Perjanjian Kinerja' : 'Buat Perjanjian Kinerja'}
              </h3>
              <button onClick={() => setIsOpen(false)} aria-label="Tutup" className="text-ink-3 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-ink-2 mb-1">Nomor dokumen *</label>
                  <input
                    type="text"
                    value={fNomor}
                    onChange={(e) => setFNomor(e.target.value)}
                    placeholder="PK-01/DIR/2026"
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Periode *</label>
                  <input
                    type="text"
                    value={fPeriode}
                    onChange={(e) => setFPeriode(e.target.value)}
                    placeholder="2026"
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2 p-3 rounded-control bg-surface-2 border border-line">
                  <div className="font-semibold text-ink-2 text-[11px] uppercase tracking-wide">Pihak Pertama (Penilai)</div>
                  <input
                    type="text"
                    value={fPihak1}
                    onChange={(e) => setFPihak1(e.target.value)}
                    placeholder="Nama pejabat"
                    className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <input
                    type="text"
                    value={fJab1}
                    onChange={(e) => setFJab1(e.target.value)}
                    placeholder="Jabatan"
                    className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="space-y-2 p-3 rounded-control bg-surface-2 border border-line">
                  <div className="font-semibold text-ink-2 text-[11px] uppercase tracking-wide">Pihak Kedua (Yang Berjanji) *</div>
                  <input
                    type="text"
                    value={fPihak2}
                    onChange={(e) => setFPihak2(e.target.value)}
                    placeholder="Nama pejabat"
                    className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <input
                    type="text"
                    value={fJab2}
                    onChange={(e) => setFJab2(e.target.value)}
                    placeholder="Jabatan"
                    className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Tanggal penetapan</label>
                  <input
                    type="date"
                    value={fTanggal}
                    onChange={(e) => setFTanggal(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Status</label>
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value as StatusPerjanjianKinerja)}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {URUTAN_STATUS_PK.map((s) => (
                      <option key={s} value={s}>
                        {LABEL_STATUS_PK[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Indikator */}
              <div className="border-t border-line pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-ink text-xs">Indikator Kinerja ({fIndikator.length})</span>
                  <button
                    onClick={() => setFIndikator((l) => [...l, indikatorKosong()])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah indikator
                  </button>
                </div>
                <div className="space-y-3">
                  {fIndikator.map((ind, idx) => (
                    <div key={idx} className="p-3 rounded-control bg-surface-2 border border-line space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-ink-3">Indikator #{idx + 1}</span>
                        {fIndikator.length > 1 && (
                          <button
                            onClick={() => setFIndikator((l) => l.filter((_, k) => k !== idx))}
                            className="text-ink-3 hover:text-neg"
                            aria-label="Hapus indikator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={ind.sasaran}
                        onChange={(e) => ubahIndikator(idx, { sasaran: e.target.value })}
                        placeholder="Sasaran strategis"
                        className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <input
                        type="text"
                        value={ind.indikator}
                        onChange={(e) => ubahIndikator(idx, { indikator: e.target.value })}
                        placeholder="Rumusan indikator kinerja"
                        className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={ind.satuan}
                          onChange={(e) => ubahIndikator(idx, { satuan: e.target.value })}
                          placeholder="Satuan"
                          className="px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        <input
                          type="number"
                          value={ind.target}
                          onChange={(e) => ubahIndikator(idx, { target: Number(e.target.value) || 0 })}
                          placeholder="Target"
                          className="px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        <select
                          value={ind.arah}
                          onChange={(e) => ubahIndikator(idx, { arah: e.target.value as ArahIndikator })}
                          className="px-2.5 py-1.5 bg-surface border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                          title={LABEL_ARAH[ind.arah]}
                        >
                          <option value="maksimal">↑ Maksimal</option>
                          <option value="minimal">↓ Minimal</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Catatan</label>
                <textarea
                  value={fCatatan}
                  onChange={(e) => setFCatatan(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
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
                className="px-4 py-2 text-xs font-semibold text-on-brand bg-brand hover:bg-brand-ink rounded-control transition-colors disabled:opacity-60"
              >
                {sedangSimpan ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Catat Realisasi ===== */}
      {realisasiUntuk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setRealisasiUntuk(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-modal-realisasi"
            className="relative w-full max-w-lg bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="judul-modal-realisasi" className="font-bold text-sm text-ink">
                Catat Realisasi Kinerja
              </h3>
              <button onClick={() => setRealisasiUntuk(null)} aria-label="Tutup" className="text-ink-3 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-control bg-surface-2 border border-line mb-3">
              <p className="text-ink font-medium">{realisasiUntuk.ind.indikator}</p>
              <p className="text-[11px] text-ink-3 mt-1">
                Target {angkaRingkas(realisasiUntuk.ind.target)} {realisasiUntuk.ind.satuan} ·{' '}
                {realisasiUntuk.ind.arah === 'minimal' ? 'semakin rendah semakin baik' : 'semakin tinggi semakin baik'}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-ink-2 mb-1">
                  Realisasi ({realisasiUntuk.ind.satuan}) *
                </label>
                <input
                  type="number"
                  min={0}
                  value={rNilai}
                  onChange={(e) => setRNilai(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block font-semibold text-ink-2 mb-1">Catatan capaian</label>
                <textarea
                  value={rCatatan}
                  onChange={(e) => setRCatatan(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setRealisasiUntuk(null)}
                className="px-3.5 py-2 text-xs font-semibold text-ink-2 bg-surface-2 hover:bg-line/40 border border-line rounded-control transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => void simpanRealisasi()}
                disabled={sedangSimpan}
                className="px-4 py-2 text-xs font-semibold text-on-brand bg-brand hover:bg-brand-ink rounded-control transition-colors disabled:opacity-60"
              >
                {sedangSimpan ? 'Menyimpan…' : 'Catat Realisasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
