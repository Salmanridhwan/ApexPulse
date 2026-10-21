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
  pemetaanOtomatis?: boolean;
  projectKms?: string | null;
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
      // Instansi aktif dari sidebar. WAJIB dikirim: untuk admin, server memakai
      // tenantId ini; tanpa itu admin selalu melihat instansi miliknya sendiri.
      if (tenantId) qs.set('tenantId', tenantId);
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
  }, [tenantId]);

  // Admin: buat/hubungkan project Ragkms untuk instansi aktif (KB RAG ikut dibuat KMS).
  const [sedangHubung, setSedangHubung] = useState(false);
  const hubungkanKms = async () => {
    setSedangHubung(true);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/kms-hubungkan`, { method: 'POST' });
      const isi = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(isi?.error || 'Gagal menghubungkan ke repositori dokumen.');
      setPesan({
        tipe: 'ok',
        teks: `${isi.dibuat ? 'Repositori baru dibuat' : 'Terhubung'} di repositori dokumen: ${isi.organisasi?.name} (${isi.organisasi?.id}).${
          isi.basisDiselaraskan && isi.basisDokumen
            ? ` Repositori diselaraskan ke basis dokumen instansi (${isi.basisDokumen}), jadi dokumen yang sudah ada tetap dibaca asisten.`
            : ''
        }`,
      });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message });
    } finally {
      setSedangHubung(false);
    }
  };

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
          tenantId,
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
      const kb = balasan?.knowledgeBase;
      const cdn = balasan?.berkas?.cdnFileId;
      setPesan({
        tipe: 'ok',
        teks: `Berkas "${fJudul.trim()}" berhasil diunggah ke repositori dokumen${kb ? ` · basis dokumen ${kb}` : ''}${cdn ? ` · salinan media ✓` : ' · salinan media belum tercatat'}${status ? ` · status indeks: ${status}` : ''}.`,
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
    if (!window.confirm(`Hapus "${b.title}" dari repositori? Berkas juga dihapus dari salinan media dan indeks pencarian.`)) return;
    try {
      const res = await fetch(`/api/berkas/${encodeURIComponent(b.id)}?tenantId=${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
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
        warna: 'bg-solid',
      },
      {
        label: 'Terindeks',
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
              <h1 className="text-lg font-bold text-ink">Repositori Dokumen</h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Repositori dokumen instansi — unggah berkas ke basis dokumen instansi, lalu AI &amp; dashboard membacanya
              </p>
              <p className="text-[11px] text-ink-3 mt-1">
                Menerima semua jenis berkas (PDF, Word, Excel, PowerPoint, teks, gambar) · maksimal 50 MB per berkas ·
                terindeks otomatis untuk pencarian AI
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors shadow-xs"
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
            <p className="text-sm font-semibold text-ink mb-1">Instansi belum terhubung ke repositori dokumen</p>
            <p className="text-xs text-ink-3 max-w-xl mx-auto">{data.catatan}</p>
            {bisaHapus && (
              <button
                onClick={() => void hubungkanKms()}
                disabled={sedangHubung}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium disabled:opacity-60"
                data-testid="hubungkan-kms"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{sedangHubung ? 'Menghubungkan…' : 'Hubungkan instansi ini ke repositori dokumen'}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Pemetaan otomatis dari KB instansi — tunjukkan supaya admin tahu
                ke project KMS mana berkas ini akan pergi (bukan tersembunyi). */}
            {data?.pemetaanOtomatis && (
              <div
                className="mb-4 p-3 rounded-card border border-brand/30 bg-brand/5 text-xs text-ink-2 flex items-start gap-2"
                data-testid="info-pemetaan-otomatis"
              >
                <ShieldCheck className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>
                  Repositori dokumen dipetakan <strong>otomatis</strong> dari basis dokumen instansi
                  {data.projectKms ? (
                    <>
                      {' '}
                      → <strong>{data.projectKms}</strong>
                    </>
                  ) : null}
                  . Admin bisa menimpanya lewat panel admin (Instansi &amp; KB → Repositori Dokumen).
                </span>
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
                    <span className="label-strong">Judul *</span>
                    <input
                      value={fJudul}
                      onChange={(e) => setFJudul(e.target.value)}
                      placeholder="mis. Laporan Keuangan 2025"
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                      data-testid="input-judul"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="label-strong">Kategori *</span>
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
                    <span className="label-strong">Unit / Departemen</span>
                    <input
                      value={fDepartemen}
                      onChange={(e) => setFDepartemen(e.target.value)}
                      placeholder="mis. Divisi Keuangan"
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="label-strong">Tahun</span>
                    <input
                      type="number"
                      value={fTahun}
                      onChange={(e) => setFTahun(e.target.value)}
                      className="w-full bg-surface-2 border border-line rounded-control px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="label-strong">Jenis</span>
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
                    <span className="label-strong">Catatan</span>
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:brightness-95 disabled:opacity-60 text-on-brand rounded-control text-xs font-medium transition-colors"
                    data-testid="kirim-unggah"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {sedangUnggah ? 'Mengunggah…' : 'Unggah berkas'}
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
                          {Number(b.fileSizeKb) > 0 ? <span>· {formatUkuran(b.fileSizeKb)}</span> : null}
                          {b.halaman ? <span>· {b.halaman} halaman</span> : null}
                          <span>· {tanggalJam(b.uploadedAt)}</span>
                          {Number.isFinite(Number(b.chunksCount)) && Number(b.chunksCount) > 0 && (
                            <span>· {b.chunksCount} potongan teks terindeks</span>
                          )}
                          {Number(b.token) > 0 && (
                            <span>· {Number(b.token).toLocaleString('id-ID')} token</span>
                          )}
                        </div>
                        {!sudahTerindeks(b.ragStatus) && (
                          <p className="text-[11px] text-warn mt-1">
                            Belum siap dipakai AI — tunggu proses indeks selesai atau unggah ulang bila gagal.
                          </p>
                        )}
                        {b.hanyaBasis && (
                          <p className="text-[11px] text-ink-3 mt-1">
                            Sudah dibaca asisten. Berkas aslinya belum ada di repositori, jadi pratinjau menampilkan teks yang terindeks.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`/api/berkas/${encodeURIComponent(b.id)}/lihat?tenantId=${encodeURIComponent(tenantId)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-ink-3 hover:text-brand-ink rounded-control hover:bg-brand/10 transition-colors"
                          aria-label="Lihat berkas"
                          title="Lihat isi dokumen"
                          data-testid="lihat-berkas"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        {!b.hanyaBasis && (
                          <>
                        <a
                          href={`/api/berkas/${encodeURIComponent(b.id)}/unduh?tenantId=${encodeURIComponent(tenantId)}`}
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
                          </>
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
