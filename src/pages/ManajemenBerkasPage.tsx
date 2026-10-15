import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FolderOpen,
  HardDrive,
  Info,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import { BerkasKMS, RingkasanBerkas, UserRole } from '../types';
import { daftarTipeBerkas, formatUkuran, labelStatusRag, sudahTerindeks } from '../services/berkas/kms';

interface ManajemenBerkasPageProps {
  tenantId: string;
  onBackToWorkspace?: () => void;
  peran?: UserRole;
}

/** Balasan `GET /api/berkas`. */
type BalasanBerkas = {
  berkas: BerkasKMS[];
  ringkasan: RingkasanBerkas;
  terpetakan: boolean;
  organizationId?: string | null;
  cakupan?: string;
  instansi?: string | null;
  catatan?: string;
};

const LABEL_STATUS_RAG: Record<string, string> = {
  Terindeks: 'bg-pos/15 text-pos border-pos/30',
  'Sedang diproses': 'bg-warn/15 text-warn border-warn/30',
  'Gagal terindeks': 'bg-neg/15 text-neg border-neg/30',
};

function tanggalJam(iso?: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Ubah berkas pilihan menjadi base64 (tanpa awalan data URL). */
function bacaBase64(berkas: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const hasil = String(reader.result || '');
      const i = hasil.indexOf(',');
      resolve(i >= 0 ? hasil.slice(i + 1) : hasil);
    };
    reader.onerror = () => reject(new Error('Berkas gagal dibaca dari perangkat.'));
    reader.readAsDataURL(berkas);
  });
}

export const ManajemenBerkasPage: React.FC<ManajemenBerkasPageProps> = ({ tenantId, peran }) => {
  const bisaHapus = peran === 'admin';

  const [data, setData] = useState<BalasanBerkas | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);
  const [cari, setCari] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const [cakupanAll, setCakupanAll] = useState(false);

  // Form unggah
  const [panelUnggah, setPanelUnggah] = useState(false);
  const [berkasPilih, setBerkasPilih] = useState<File | null>(null);
  const [fJudul, setFJudul] = useState('');
  const [fKategori, setFKategori] = useState('');
  const [fDepartemen, setFDepartemen] = useState('');
  const [fTahun, setFTahun] = useState(String(new Date().getFullYear()));
  const [fCatatan, setFCatatan] = useState('');
  const [fTipe, setFTipe] = useState<'document' | 'photo'>('document');
  const [sedangUnggah, setSedangUnggah] = useState(false);
  const [seretAktif, setSeretAktif] = useState(false);
  const inputBerkas = useRef<HTMLInputElement | null>(null);

  const muat = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (cakupanAll) qs.set('cakupan', 'all');
      const res = await fetch(`/api/berkas${qs.toString() ? `?${qs}` : ''}`);
      const isi = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(isi?.error || 'Gagal memuat daftar berkas.');
      setData(isi);
    } catch (err: any) {
      setData(null);
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat daftar berkas.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, cakupanAll]);

  const semuaBerkas = useMemo(() => data?.berkas || [], [data]);
  const tipeTersedia = useMemo(() => daftarTipeBerkas(semuaBerkas), [semuaBerkas]);

  /** Saringan sisi klien supaya mengetik terasa langsung (server tetap menyaring). */
  const berkasTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return semuaBerkas.filter((b) => {
      if (filterTipe && String(b.fileType || '').toUpperCase() !== filterTipe) return false;
      if (q) {
        const teks = `${b.title || ''} ${b.category || ''} ${b.department || ''}`.toLowerCase();
        if (!teks.includes(q)) return false;
      }
      return true;
    });
  }, [semuaBerkas, cari, filterTipe]);

  const ringkas = data?.ringkasan;

  const pilihBerkas = (f: File | null) => {
    setBerkasPilih(f);
    if (f && !fJudul.trim()) {
      setFJudul(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
    }
  };

  const resetForm = () => {
    setBerkasPilih(null);
    setFJudul('');
    setFKategori('');
    setFDepartemen('');
    setFTahun(String(new Date().getFullYear()));
    setFCatatan('');
    setFTipe('document');
    if (inputBerkas.current) inputBerkas.current.value = '';
  };

  const unggah = async () => {
    if (!berkasPilih) {
      setPesan({ tipe: 'err', teks: 'Pilih berkas terlebih dahulu.' });
      return;
    }
    if (!fJudul.trim()) {
      setPesan({ tipe: 'err', teks: 'Judul berkas wajib diisi.' });
      return;
    }
    if (!fKategori.trim()) {
      setPesan({ tipe: 'err', teks: 'Kategori wajib diisi.' });
      return;
    }
    setSedangUnggah(true);
    setPesan(null);
    try {
      const isiBase64 = await bacaBase64(berkasPilih);
      const res = await fetch('/api/berkas/unggah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: berkasPilih.name,
          ukuran: berkasPilih.size,
          tipe: berkasPilih.type,
          isiBase64,
          judul: fJudul.trim(),
          kategori: fKategori.trim(),
          departemen: fDepartemen.trim() || undefined,
          tahun: fTahun ? Number(fTahun) : undefined,
          catatan: fCatatan.trim() || undefined,
          tipeRepositori: fTipe,
        }),
      });
      const balasan = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(balasan?.error || 'Berkas gagal diunggah.');
      const status = balasan?.berkas?.ragStatus;
      setPesan({
        tipe: 'ok',
        teks: `Berkas "${fJudul.trim()}" berhasil diunggah${status ? ` · status RAG: ${status}` : ''}.`,
      });
      resetForm();
      setPanelUnggah(false);
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Berkas gagal diunggah.' });
    } finally {
      setSedangUnggah(false);
    }
  };

  const hapus = async (b: BerkasKMS) => {
    if (!window.confirm(`Hapus "${b.title}" dari repositori? Berkas juga dihapus dari CDN & RAG.`)) return;
    try {
      const res = await fetch(`/api/berkas/${encodeURIComponent(b.id)}`, { method: 'DELETE' });
      const balasan = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(balasan?.error || 'Berkas gagal dihapus.');
      setPesan({ tipe: 'ok', teks: `Berkas "${b.title}" dihapus.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Berkas gagal dihapus.' });
    }
  };

  const kartuRingkas = useMemo(
    () => [
      {
        label: 'Total Berkas',
        nilai: String(ringkas?.total ?? 0),
        ikon: <FolderOpen className="w-4 h-4" />,
        warna: 'bg-brand',
      },
      {
        label: 'Total Ukuran',
        nilai: formatUkuran(ringkas?.totalKb),
        ikon: <HardDrive className="w-4 h-4" />,
        warna: 'bg-ink',
      },
      {
        label: 'Terindeks RAG',
        nilai: String(ringkas?.terindeks ?? 0),
        ikon: <ShieldCheck className="w-4 h-4" />,
        warna: 'bg-pos',
      },
      {
        label: 'Belum Terindeks',
        nilai: String(ringkas?.belumTerindeks ?? 0),
        ikon: <Layers className="w-4 h-4" />,
        warna: 'bg-warn',
      },
    ],
    [ringkas]
  );

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col" data-testid="halaman-manajemen-berkas">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Header */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0 shadow-sm">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink">Manajemen Berkas</h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Repositori dokumen instansi — unggah berkas ke knowledge base, lalu AI &amp; dashboard membacanya
              </p>
              <p className="text-[11px] text-ink-3 mt-1">
                Menerima semua jenis berkas (PDF, Word, Excel, PowerPoint, teks, gambar) · maksimal 50 MB per berkas ·
                terindeks otomatis ke RAG
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void muat()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors"
              data-testid="segarkan-berkas"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
            {data?.terpetakan && (
              <button
                onClick={() => setPanelUnggah((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
                data-testid="buka-panel-unggah"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah Berkas</span>
              </button>
            )}
          </div>
        </div>

        {pesan && (
          <div
            className={`mb-6 p-3 rounded-card border text-xs flex items-start gap-2 ${
              pesan.tipe === 'ok' ? 'bg-pos/15 border-pos/30 text-pos' : 'bg-neg/15 border-neg/30 text-neg'
            }`}
            data-testid="pesan-berkas"
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
        ) : data && !data.terpetakan ? (
          /* Belum dipetakan ke project KMS — jujur, bukan "0 berkas". */
          <div className="bg-surface p-8 rounded-card border border-line text-center" data-testid="berkas-belum-terpetakan">
            <Info className="w-9 h-9 text-warn mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink mb-1">Instansi belum dipetakan ke project KMS</p>
            <p className="text-xs text-ink-3 max-w-xl mx-auto">{data.catatan}</p>
          </div>
        ) : (
          <>
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

            {/* Panel unggah */}
            {panelUnggah && (
              <div className="bg-surface p-5 rounded-card border border-line mb-6" data-testid="panel-unggah">
                <h2 className="text-sm font-bold text-ink mb-3">Unggah Berkas Baru</h2>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSeretAktif(true);
                  }}
                  onDragLeave={() => setSeretAktif(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSeretAktif(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) pilihBerkas(f);
                  }}
                  className={`border-2 border-dashed rounded-card p-6 text-center mb-4 transition-colors ${
                    seretAktif ? 'border-brand bg-brand/5' : 'border-line bg-surface-2/40'
                  }`}
                >
                  <UploadCloud className="w-8 h-8 text-ink-3 mx-auto mb-2" />
                  {berkasPilih ? (
                    <p className="text-xs text-ink font-medium">
                      {berkasPilih.name} · {formatUkuran(berkasPilih.size / 1024)}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-3">Seret berkas ke sini, atau</p>
                  )}
                  <button
                    type="button"
                    onClick={() => inputBerkas.current?.click()}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-ink bg-surface hover:bg-brand/10 border border-line rounded-control transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Pilih Berkas
                  </button>
                  <input
                    ref={inputBerkas}
                    type="file"
                    className="hidden"
                    data-testid="input-berkas"
                    onChange={(e) => pilihBerkas(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs">
                    <span className="block font-semibold text-ink-2 mb-1">Judul *</span>
                    <input
                      value={fJudul}
                      onChange={(e) => setFJudul(e.target.value)}
                      placeholder="mis. Laporan Keuangan 2025"
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                      data-testid="input-judul"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block font-semibold text-ink-2 mb-1">Kategori *</span>
                    <input
                      value={fKategori}
                      onChange={(e) => setFKategori(e.target.value)}
                      placeholder="mis. Laporan Keuangan"
                      list="kategori-berkas"
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                      data-testid="input-kategori"
                    />
                    <datalist id="kategori-berkas">
                      <option value="Laporan Keuangan" />
                      <option value="Laporan Operasional" />
                      <option value="Dokumen Legal" />
                      <option value="SOP & Kebijakan" />
                      <option value="Rencana Kerja" />
                      <option value="Dokumentasi Foto" />
                    </datalist>
                  </label>
                  <label className="text-xs">
                    <span className="block font-semibold text-ink-2 mb-1">Unit / Departemen</span>
                    <input
                      value={fDepartemen}
                      onChange={(e) => setFDepartemen(e.target.value)}
                      placeholder="mis. Divisi Keuangan"
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block font-semibold text-ink-2 mb-1">Tahun</span>
                    <input
                      type="number"
                      value={fTahun}
                      onChange={(e) => setFTahun(e.target.value)}
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block font-semibold text-ink-2 mb-1">Jenis</span>
                    <select
                      value={fTipe}
                      onChange={(e) => setFTipe(e.target.value as 'document' | 'photo')}
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="document">Dokumen</option>
                      <option value="photo">Foto / Gambar</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="block font-semibold text-ink-2 mb-1">Catatan</span>
                    <input
                      value={fCatatan}
                      onChange={(e) => setFCatatan(e.target.value)}
                      placeholder="Keterangan singkat (opsional)"
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => void unggah()}
                    disabled={sedangUnggah}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-ink disabled:opacity-60 text-on-brand rounded-control text-xs font-medium transition-colors"
                    data-testid="kirim-unggah"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {sedangUnggah ? 'Mengunggah…' : 'Unggah ke Knowledge Base'}
                  </button>
                  <button
                    onClick={() => {
                      resetForm();
                      setPanelUnggah(false);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-ink-2 bg-surface-2 hover:bg-line border border-line rounded-control transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {/* Filter */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-sm font-bold text-ink">Daftar Berkas</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    placeholder="Cari judul…"
                    className="text-xs bg-surface-2 border border-line rounded-control pl-8 pr-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    data-testid="cari-berkas"
                  />
                </div>
                <select
                  value={filterTipe}
                  onChange={(e) => setFilterTipe(e.target.value)}
                  className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  aria-label="Filter jenis berkas"
                >
                  <option value="">Semua jenis</option>
                  {tipeTersedia.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {peran === 'admin' && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                    <input
                      type="checkbox"
                      checked={cakupanAll}
                      onChange={(e) => setCakupanAll(e.target.checked)}
                      data-testid="cakupan-all"
                    />
                    Semua project
                  </label>
                )}
              </div>
            </div>

            {berkasTampil.length === 0 ? (
              <div className="bg-surface p-10 rounded-card border border-line text-center" data-testid="berkas-kosong">
                <FolderOpen className="w-10 h-10 text-ink-3 mx-auto mb-3" />
                <p className="text-sm font-semibold text-ink mb-1">
                  {semuaBerkas.length === 0 ? 'Belum ada berkas' : 'Tidak ada berkas yang cocok'}
                </p>
                <p className="text-xs text-ink-3 max-w-md mx-auto">
                  {semuaBerkas.length === 0
                    ? 'Unggah dokumen instansi (PDF, Word, Excel, gambar) — berkas akan terindeks otomatis sehingga bisa dipakai AI & dashboard.'
                    : 'Ubah kata kunci pencarian atau filter jenis berkas.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {berkasTampil.map((b) => {
                  const label = labelStatusRag(b.ragStatus);
                  const kelas = LABEL_STATUS_RAG[label] || 'bg-surface-2 text-ink-2 border-line';
                  return (
                    <div
                      key={b.id}
                      className="bg-surface rounded-card border border-line shadow-2xs p-4 flex items-start gap-3"
                      data-testid="baris-berkas"
                    >
                      <span className="w-9 h-9 rounded-control bg-surface-2 border border-line flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-ink-2" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-ink truncate">{b.title}</span>
                          {b.fileType && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-surface-2 text-ink-2 font-semibold">
                              {b.fileType}
                            </span>
                          )}
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${kelas}`}>
                            {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-ink-3 flex-wrap">
                          {b.category && <span>{b.category}</span>}
                          {b.department && <span>· {b.department}</span>}
                          {b.year ? <span>· {b.year}</span> : null}
                          <span>· {formatUkuran(b.fileSizeKb)}</span>
                          <span>· {tanggalJam(b.uploadedAt)}</span>
                          {Number.isFinite(Number(b.chunksCount)) && Number(b.chunksCount) > 0 && (
                            <span>· {b.chunksCount} potongan RAG</span>
                          )}
                          {b.organizationName && cakupanAll && <span>· {b.organizationName}</span>}
                        </div>
                        {!sudahTerindeks(b.ragStatus) && (
                          <p className="text-[11px] text-warn mt-1">
                            Belum siap dipakai AI — tunggu proses indeks selesai atau unggah ulang bila gagal.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`/api/berkas/${encodeURIComponent(b.id)}/lihat`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-ink-3 hover:text-brand-ink rounded-control hover:bg-brand/10 transition-colors"
                          aria-label="Lihat berkas"
                          title="Lihat"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`/api/berkas/${encodeURIComponent(b.id)}/unduh`}
                          className="p-1.5 text-ink-3 hover:text-brand-ink rounded-control hover:bg-brand/10 transition-colors"
                          aria-label="Unduh berkas"
                          title="Unduh"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {bisaHapus && (
                          <button
                            onClick={() => void hapus(b)}
                            className="p-1.5 text-ink-3 hover:text-neg rounded-control hover:bg-neg/10 transition-colors"
                            aria-label="Hapus berkas"
                            title="Hapus"
                            data-testid="hapus-berkas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {ringkas && ringkas.perTipe.length > 0 && (
              <div className="mt-6 bg-surface p-4 rounded-card border border-line">
                <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-2">Sebaran Jenis Berkas</div>
                <div className="flex flex-wrap gap-2">
                  {ringkas.perTipe.map((t) => (
                    <span
                      key={t.tipe}
                      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-control border border-line bg-surface-2 text-ink-2"
                    >
                      <span className="font-semibold">{t.tipe}</span>
                      <span className="text-ink-3">· {t.jumlah}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
