import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { AksiMitigasi, KategoriRisiko, LevelRisiko, RingkasanRisiko, Risiko, StatusRisiko, UserRole } from '../types';
import {
  LABEL_KATEGORI,
  LABEL_LEVEL,
  LABEL_STATUS_RISIKO,
  URUTAN_KATEGORI,
  URUTAN_LEVEL,
  levelDariSkor,
} from '../services/risiko/register';

interface ManajemenRisikoPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
  /** Peran pengguna aktif — menentukan tombol kelola register tampil. */
  peran?: UserRole;
}

/** Kelas badge per level risiko (warna dari token tema). */
const KELAS_LEVEL: Record<LevelRisiko, string> = {
  rendah: 'bg-pos/15 text-pos border-pos/30',
  sedang: 'bg-warn/15 text-warn border-warn/30',
  tinggi: 'bg-coral/15 text-coral border-coral/30',
  ekstrem: 'bg-neg/15 text-neg border-neg/30',
};

/** Warna latar sel heat map per level (dipakai di peta 5×5). */
const WARNA_SEL: Record<LevelRisiko, string> = {
  rendah: 'rgba(16, 185, 129, 0.18)',
  sedang: 'rgba(245, 158, 11, 0.20)',
  tinggi: 'rgba(244, 114, 92, 0.22)',
  ekstrem: 'rgba(239, 68, 68, 0.26)',
};

/** Kelas badge per status risiko. */
const KELAS_STATUS: Record<StatusRisiko, string> = {
  teridentifikasi: 'bg-surface-2 text-ink-2 border-line',
  dimitigasi: 'bg-brand/15 text-brand-ink border-brand/30',
  terkendali: 'bg-pos/15 text-pos border-pos/30',
  ditutup: 'bg-ink/10 text-ink-3 border-line',
};

const LEVEL_SEMUA: LevelRisiko[] = ['rendah', 'sedang', 'tinggi', 'ekstrem'];

function tanggalRingkas(iso?: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function lewatTenggat(risiko: Risiko): boolean {
  if (!risiko.batasWaktu) return false;
  if (risiko.status === 'terkendali' || risiko.status === 'ditutup') return false;
  const t = new Date(risiko.batasWaktu).getTime();
  return Number.isFinite(t) && t < Date.now();
}

export const ManajemenRisikoPage: React.FC<ManajemenRisikoPageProps> = ({
  tenantId,
  onBackToWorkspace,
  peran,
}) => {
  const [daftar, setDaftar] = useState<Risiko[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanRisiko | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'register' | 'peta'>('register');
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);
  const [filterKategori, setFilterKategori] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [bukaId, setBukaId] = useState<string | null>(null);

  const bisaKelola = peran === 'admin';

  // Modal tambah/ubah risiko.
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fKode, setFKode] = useState('');
  const [fKategori, setFKategori] = useState<KategoriRisiko>('operasional');
  const [fPernyataan, setFPernyataan] = useState('');
  const [fPenyebab, setFPenyebab] = useState('');
  const [fDampak, setFDampak] = useState('');
  const [fSasaran, setFSasaran] = useState('');
  const [fKemungkinan, setFKemungkinan] = useState(3);
  const [fDampakSkala, setFDampakSkala] = useState(3);
  const [fPemilik, setFPemilik] = useState('');
  const [fRencana, setFRencana] = useState('');
  const [fBatas, setFBatas] = useState('');
  const [sedangSimpan, setSedangSimpan] = useState(false);

  // Modal catat mitigasi.
  const [mitigasiUntuk, setMitigasiUntuk] = useState<Risiko | null>(null);
  const [mUraian, setMUraian] = useState('');
  const [mStatus, setMStatus] = useState<StatusRisiko>('dimitigasi');
  const [mAlasan, setMAlasan] = useState('');
  const [mLevelResidual, setMLevelResidual] = useState<string>('');
  const [mTanggal, setMTanggal] = useState('');

  const muat = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterKategori) qs.set('kategori', filterKategori);
      if (filterLevel) qs.set('level', filterLevel);
      const res = await fetch(`/api/risiko${qs.toString() ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Gagal memuat register risiko.');
      const data = await res.json();
      setDaftar(data.risiko || []);
      setRingkasan(data.ringkasan || null);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat register risiko.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, filterKategori, filterLevel]);

  const skorForm = fKemungkinan * fDampakSkala;
  const levelForm = levelDariSkor(skorForm);

  const bukaTambah = () => {
    setEditId(null);
    setFKode(`R-${String((ringkasan?.total || 0) + 1).padStart(2, '0')}`);
    setFKategori('operasional');
    setFPernyataan('');
    setFPenyebab('');
    setFDampak('');
    setFSasaran('');
    setFKemungkinan(3);
    setFDampakSkala(3);
    setFPemilik('');
    setFRencana('');
    setFBatas('');
    setIsOpen(true);
  };

  const bukaUbah = (r: Risiko) => {
    setEditId(r.id);
    setFKode(r.kode);
    setFKategori(r.kategori);
    setFPernyataan(r.pernyataan);
    setFPenyebab(r.penyebab || '');
    setFDampak(r.dampakUraian || '');
    setFSasaran(r.sasaran || '');
    setFKemungkinan(r.kemungkinan);
    setFDampakSkala(r.dampak);
    setFPemilik(r.pemilikRisiko || '');
    setFRencana(r.rencanaMitigasi || '');
    setFBatas(r.batasWaktu ? r.batasWaktu.slice(0, 10) : '');
    setIsOpen(true);
  };

  const simpan = async () => {
    if (!fKode.trim()) return setPesan({ tipe: 'err', teks: 'Kode risiko wajib diisi.' });
    if (!fPernyataan.trim()) return setPesan({ tipe: 'err', teks: 'Pernyataan risiko wajib diisi.' });
    setSedangSimpan(true);
    try {
      const body = {
        kode: fKode.trim(),
        kategori: fKategori,
        pernyataan: fPernyataan.trim(),
        penyebab: fPenyebab.trim() || undefined,
        dampakUraian: fDampak.trim() || undefined,
        sasaran: fSasaran.trim() || undefined,
        kemungkinan: fKemungkinan,
        dampak: fDampakSkala,
        pemilikRisiko: fPemilik.trim() || undefined,
        rencanaMitigasi: fRencana.trim() || undefined,
        batasWaktu: fBatas ? new Date(fBatas).toISOString() : undefined,
      };
      const res = await fetch(editId ? `/api/risiko/${editId}` : '/api/risiko', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan risiko.');
      setIsOpen(false);
      setPesan({ tipe: 'ok', teks: editId ? 'Risiko diperbarui.' : `Risiko ${data.kode} ditambahkan.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan risiko.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const hapus = async (r: Risiko) => {
    try {
      const res = await fetch(`/api/risiko/${r.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menghapus risiko.');
      }
      setPesan({ tipe: 'ok', teks: `Risiko ${r.kode} dihapus.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus risiko.' });
    }
  };

  const bukaMitigasi = (r: Risiko) => {
    setMitigasiUntuk(r);
    setMUraian('');
    setMStatus(r.status === 'teridentifikasi' ? 'dimitigasi' : 'terkendali');
    setMAlasan('');
    setMLevelResidual('');
    setMTanggal(new Date().toISOString().slice(0, 10));
  };

  const simpanMitigasi = async () => {
    if (!mitigasiUntuk) return;
    if (!mUraian.trim()) return setPesan({ tipe: 'err', teks: 'Uraian mitigasi wajib diisi.' });
    if (mStatus === 'ditutup' && !mAlasan.trim()) {
      return setPesan({ tipe: 'err', teks: 'Alasan wajib diisi bila risiko ditutup.' });
    }
    setSedangSimpan(true);
    try {
      const res = await fetch(`/api/risiko/${mitigasiUntuk.id}/mitigasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uraian: mUraian.trim(),
          statusSesudah: mStatus,
          alasan: mAlasan.trim() || undefined,
          levelResidual: mLevelResidual || undefined,
          tanggal: mTanggal ? new Date(mTanggal).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencatat mitigasi.');
      setMitigasiUntuk(null);
      setPesan({ tipe: 'ok', teks: `Mitigasi risiko ${data.kode} tercatat.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal mencatat mitigasi.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const matriks = ringkasan?.matriks || Array.from({ length: 5 }, () => Array(5).fill(0));

  const kartuRingkas = useMemo(
    () => [
      { label: 'Total Risiko', nilai: ringkasan?.total ?? 0, ikon: <ShieldAlert className="w-4 h-4" />, warna: 'bg-brand' },
      { label: 'Risiko Tinggi/Ekstrem', nilai: ringkasan?.risikoTinggi ?? 0, ikon: <AlertTriangle className="w-4 h-4" />, warna: 'bg-neg' },
      { label: 'Lewat Tenggat', nilai: ringkasan?.lewatTenggat ?? 0, ikon: <Clock className="w-4 h-4" />, warna: 'bg-warn' },
      { label: 'Rata Skor', nilai: ringkasan?.rataSkor ?? 0, ikon: <Target className="w-4 h-4" />, warna: 'bg-solid' },
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
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink">Manajemen Risiko</h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Register risiko &amp; heat map 5×5 — skor dihitung otomatis dari kemungkinan × dampak
              </p>
              <p className="text-[11px] text-ink-3 mt-1">
                Dasar: PP 60/2008 (SPIP) Pasal 13 — penilaian risiko wajib oleh pimpinan unit kerja · Permendagri 37/2018
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
                <span>Tambah Risiko</span>
              </button>
            )}
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

        {/* Tab */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="inline-flex gap-1 bg-surface-2 p-1 rounded-control border border-line">
            <button
              onClick={() => setActiveTab('register')}
              className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                activeTab === 'register' ? 'bg-brand text-on-brand shadow-sm' : 'text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
              }`}
            >
              Register ({daftar.length})
            </button>
            <button
              onClick={() => setActiveTab('peta')}
              className={`px-4 py-2 rounded-control text-xs font-bold transition-colors ${
                activeTab === 'peta' ? 'bg-brand text-on-brand shadow-sm' : 'text-ink-2 hover:bg-brand/10 hover:text-brand-ink'
              }`}
            >
              Peta Risiko (Heat Map)
            </button>
          </div>
          {activeTab === 'register' && (
            <div className="flex items-center gap-2">
              <select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="Filter kategori"
              >
                <option value="">Semua kategori</option>
                {URUTAN_KATEGORI.map((k) => (
                  <option key={k} value={k}>
                    {LABEL_KATEGORI[k]}
                  </option>
                ))}
              </select>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="Filter level"
              >
                <option value="">Semua level</option>
                {LEVEL_SEMUA.map((l) => (
                  <option key={l} value={l}>
                    {LABEL_LEVEL[l]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-xs text-ink-3">Memuat…</div>
        ) : activeTab === 'peta' ? (
          <PetaRisiko matriks={matriks} daftar={daftar} perLevel={ringkasan?.perLevel} />
        ) : daftar.length === 0 ? (
          <div className="bg-surface p-10 rounded-card border border-line text-center">
            <ShieldAlert className="w-10 h-10 text-ink-3 mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink mb-1">Belum ada risiko terdaftar</p>
            <p className="text-xs text-ink-3 max-w-md mx-auto mb-5">
              {bisaKelola
                ? 'Daftarkan risiko instansi (kategori, kemungkinan, dampak) — skor dan level dihitung otomatis.'
                : 'Hubungi admin instansi untuk mendaftarkan risiko.'}
            </p>
            {bisaKelola && (
              <button
                onClick={bukaTambah}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:brightness-95 text-on-brand rounded-control text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Risiko
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {daftar.map((r) => {
              const terbuka = bukaId === r.id;
              const lewat = lewatTenggat(r);
              return (
                <div key={r.id} className="bg-surface rounded-card border border-line shadow-2xs overflow-hidden">
                  <div className="p-4 flex items-start gap-3">
                    <button
                      onClick={() => setBukaId(terbuka ? null : r.id)}
                      className="mt-0.5 shrink-0 text-ink-3 hover:text-ink"
                      aria-label={terbuka ? 'Tutup rincian' : 'Buka rincian'}
                    >
                      {terbuka ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-ink font-mono">{r.kode}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${KELAS_LEVEL[r.level]}`}>
                          {LABEL_LEVEL[r.level]} · {r.skor}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${KELAS_STATUS[r.status]}`}>
                          {LABEL_STATUS_RISIKO[r.status]}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-line bg-surface-2 text-ink-2 font-medium">
                          {LABEL_KATEGORI[r.kategori]}
                        </span>
                        {lewat && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-neg/30 bg-neg/15 text-neg font-semibold">
                            Lewat tenggat
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink font-medium">{r.pernyataan}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-3 flex-wrap">
                        <span>
                          Kemungkinan {r.kemungkinan} × Dampak {r.dampak} = <strong className="text-ink-2">{r.skor}</strong>
                        </span>
                        {r.pemilikRisiko && <span>Pemilik: {r.pemilikRisiko}</span>}
                        {r.batasWaktu && <span>Batas: {tanggalRingkas(r.batasWaktu)}</span>}
                        {r.levelResidual && <span>Residual: {LABEL_LEVEL[r.levelResidual]}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => bukaMitigasi(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-brand-ink bg-surface-2 hover:bg-brand/10 border border-line rounded-control transition-colors"
                        title="Catat tindakan mitigasi"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Mitigasi</span>
                      </button>
                      {bisaKelola && (
                        <>
                          <button
                            onClick={() => bukaUbah(r)}
                            className="p-1.5 text-ink-3 hover:text-brand-ink rounded-control hover:bg-brand/10 transition-colors"
                            aria-label="Ubah risiko"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => void hapus(r)}
                            className="p-1.5 text-ink-3 hover:text-neg rounded-control hover:bg-neg/10 transition-colors"
                            aria-label="Hapus risiko"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {terbuka && (
                    <div className="border-t border-line bg-surface-2/50 p-4 text-xs space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        {r.penyebab && (
                          <div>
                            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Penyebab</div>
                            <p className="text-ink-2">{r.penyebab}</p>
                          </div>
                        )}
                        {r.dampakUraian && (
                          <div>
                            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Dampak</div>
                            <p className="text-ink-2">{r.dampakUraian}</p>
                          </div>
                        )}
                        {r.sasaran && (
                          <div>
                            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Sasaran terancam</div>
                            <p className="text-ink-2">{r.sasaran}</p>
                          </div>
                        )}
                        {r.rencanaMitigasi && (
                          <div>
                            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Rencana mitigasi</div>
                            <p className="text-ink-2">{r.rencanaMitigasi}</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
                          Jejak mitigasi ({r.aksiMitigasi.length})
                        </div>
                        {r.aksiMitigasi.length === 0 ? (
                          <p className="text-ink-3 italic">Belum ada tindakan mitigasi tercatat.</p>
                        ) : (
                          <ol className="space-y-2">
                            {r.aksiMitigasi.map((a: AksiMitigasi) => (
                              <li key={a.id} className="border-l-2 border-brand/40 pl-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-ink-2 font-medium">{tanggalRingkas(a.tanggal)}</span>
                                  <span className="text-ink-3">· {a.oleh}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${KELAS_STATUS[a.statusSesudah]}`}>
                                    → {LABEL_STATUS_RISIKO[a.statusSesudah]}
                                  </span>
                                  {a.levelResidual && (
                                    <span className="text-[10px] text-ink-3">residual: {LABEL_LEVEL[a.levelResidual]}</span>
                                  )}
                                </div>
                                <p className="text-ink-2 mt-0.5">{a.uraian}</p>
                                {a.bukti.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {a.bukti.map((b, i) => (
                                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3">
                                        📎 {b.nama}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rekap per kategori */}
        {!isLoading && activeTab === 'register' && ringkasan && ringkasan.perKategori.length > 0 && (
          <div className="bg-surface p-5 rounded-card border border-line mt-6">
            <h2 className="text-sm font-bold text-ink mb-3">Rekap per Kategori</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-3 border-b border-line">
                    <th className="py-2 pr-3 font-semibold">Kategori</th>
                    <th className="py-2 pr-3 font-semibold text-right">Jumlah</th>
                    <th className="py-2 font-semibold text-right">Level Tertinggi</th>
                  </tr>
                </thead>
                <tbody>
                  {ringkasan.perKategori.map((k) => (
                    <tr key={k.kategori} className="border-b border-line/60 last:border-0">
                      <td className="py-2 pr-3 text-ink-2">{LABEL_KATEGORI[k.kategori]}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink font-medium">{k.total}</td>
                      <td className="py-2 text-right">
                        {k.levelTertinggi ? (
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${KELAS_LEVEL[k.levelTertinggi]}`}>
                            {LABEL_LEVEL[k.levelTertinggi]}
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal: Tambah/Ubah Risiko ===== */}
      {isOpen && (
        <div className="modal-layer">
          <div className="scrim" onClick={() => setIsOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-modal-risiko"
            className="relative w-full max-w-2xl bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="judul-modal-risiko" className="font-bold text-sm text-ink">
                {editId ? 'Ubah Risiko' : 'Tambah Risiko'}
              </h3>
              <button onClick={() => setIsOpen(false)} aria-label="Tutup" className="text-ink-3 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-strong">Kode</label>
                  <input
                    type="text"
                    value={fKode}
                    onChange={(e) => setFKode(e.target.value)}
                    placeholder="R-01"
                    className="field"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label-strong">Kategori</label>
                  <select
                    value={fKategori}
                    onChange={(e) => setFKategori(e.target.value as KategoriRisiko)}
                    className="field"
                  >
                    {URUTAN_KATEGORI.map((k) => (
                      <option key={k} value={k}>
                        {LABEL_KATEGORI[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-strong">Pernyataan risiko *</label>
                <textarea
                  value={fPernyataan}
                  onChange={(e) => setFPernyataan(e.target.value)}
                  rows={2}
                  placeholder="Kemungkinan ... yang menyebabkan ..."
                  className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label-strong">Penyebab</label>
                  <textarea
                    value={fPenyebab}
                    onChange={(e) => setFPenyebab(e.target.value)}
                    rows={2}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                  />
                </div>
                <div>
                  <label className="label-strong">Dampak</label>
                  <textarea
                    value={fDampak}
                    onChange={(e) => setFDampak(e.target.value)}
                    rows={2}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                  />
                </div>
              </div>
              <div>
                <label className="label-strong">Sasaran/tujuan yang terancam</label>
                <input
                  type="text"
                  value={fSasaran}
                  onChange={(e) => setFSasaran(e.target.value)}
                  className="field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-strong">Kemungkinan (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={fKemungkinan}
                    onChange={(e) => setFKemungkinan(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label-strong">Dampak (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={fDampakSkala}
                    onChange={(e) => setFDampakSkala(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                    className="field"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-control bg-surface-2 border border-line">
                <span className="text-ink-3">Skor risiko (otomatis):</span>
                <span className="font-bold text-ink tabular-nums">
                  {fKemungkinan} × {fDampakSkala} = {skorForm}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${KELAS_LEVEL[levelForm]}`}>
                  {LABEL_LEVEL[levelForm]}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label-strong">Pemilik risiko (unit)</label>
                  <input
                    type="text"
                    value={fPemilik}
                    onChange={(e) => setFPemilik(e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label-strong">Batas waktu mitigasi</label>
                  <input
                    type="date"
                    value={fBatas}
                    onChange={(e) => setFBatas(e.target.value)}
                    className="field"
                  />
                </div>
              </div>
              <div>
                <label className="label-strong">Rencana mitigasi</label>
                <textarea
                  value={fRencana}
                  onChange={(e) => setFRencana(e.target.value)}
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
                className="px-4 py-2 text-xs font-semibold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60"
              >
                {sedangSimpan ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: Catat Mitigasi ===== */}
      {mitigasiUntuk && (
        <div className="modal-layer">
          <div className="scrim" onClick={() => setMitigasiUntuk(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-modal-mitigasi"
            className="relative w-full max-w-lg bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="judul-modal-mitigasi" className="font-bold text-sm text-ink">
                Catat Mitigasi · <span className="font-mono">{mitigasiUntuk.kode}</span>
              </h3>
              <button onClick={() => setMitigasiUntuk(null)} aria-label="Tutup" className="text-ink-3 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-ink-2 mb-3 line-clamp-2">{mitigasiUntuk.pernyataan}</p>
            <div className="space-y-3">
              <div>
                <label className="label-strong">Uraian tindakan mitigasi *</label>
                <textarea
                  value={mUraian}
                  onChange={(e) => setMUraian(e.target.value)}
                  rows={3}
                  placeholder="Apa yang sudah/akan dilakukan untuk menurunkan risiko ini?"
                  className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-strong">Status setelah aksi</label>
                  <select
                    value={mStatus}
                    onChange={(e) => setMStatus(e.target.value as StatusRisiko)}
                    className="field"
                  >
                    <option value="teridentifikasi">Teridentifikasi</option>
                    <option value="dimitigasi">Sedang Dimitigasi</option>
                    <option value="terkendali">Terkendali</option>
                    <option value="ditutup">Ditutup</option>
                  </select>
                </div>
                <div>
                  <label className="label-strong">Tanggal</label>
                  <input
                    type="date"
                    value={mTanggal}
                    onChange={(e) => setMTanggal(e.target.value)}
                    className="field"
                  />
                </div>
              </div>
              <div>
                <label className="label-strong">Level residual setelah mitigasi (opsional)</label>
                <select
                  value={mLevelResidual}
                  onChange={(e) => setMLevelResidual(e.target.value)}
                  className="field"
                >
                  <option value="">Tidak dinilai</option>
                  {URUTAN_LEVEL.map((l) => (
                    <option key={l} value={l}>
                      {LABEL_LEVEL[l]}
                    </option>
                  ))}
                </select>
              </div>
              {mStatus === 'ditutup' && (
                <div>
                  <label className="label-strong">Alasan ditutup *</label>
                  <textarea
                    value={mAlasan}
                    onChange={(e) => setMAlasan(e.target.value)}
                    rows={2}
                    placeholder="Wajib — tanpa alasan, risiko tidak boleh dihilangkan dari register."
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setMitigasiUntuk(null)}
                className="px-3.5 py-2 text-xs font-semibold text-ink-2 bg-surface-2 hover:bg-line/40 border border-line rounded-control transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => void simpanMitigasi()}
                disabled={sedangSimpan}
                className="px-4 py-2 text-xs font-semibold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60"
              >
                {sedangSimpan ? 'Menyimpan…' : 'Catat Mitigasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Peta risiko: matriks heat map 5×5 (baris = kemungkinan dari atas ke bawah 5→1,
 * kolom = dampak 1→5) + ringkasan per level.
 */
const PetaRisiko: React.FC<{ matriks: number[][]; daftar: Risiko[]; perLevel?: Record<LevelRisiko, number> }> = ({
  matriks,
  daftar,
  perLevel,
}) => {
  // Baris ditampilkan dari kemungkinan TERTINGGI (5) ke terendah (1) — konvensi
  // matriks risiko: kiri-atas = risiko paling gawat.
  const barisKemungkinan = [5, 4, 3, 2, 1];
  return (
    <div className="space-y-5">
      <div className="bg-surface p-5 rounded-card border border-line">
        <h2 className="text-sm font-bold text-ink mb-1">Peta Risiko (Heat Map 5×5)</h2>
        <p className="text-[11px] text-ink-3 mb-4">
          Sumbu mendatar = dampak, sumbu tegak = kemungkinan. Angka di tiap sel = jumlah risiko. Skor = kemungkinan × dampak.
        </p>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-[520px]">
            <div className="flex">
              <div className="w-24 shrink-0" />
              {[1, 2, 3, 4, 5].map((d) => (
                <div key={d} className="flex-1 text-center text-[11px] font-semibold text-ink-3 pb-1.5">
                  Dampak {d}
                </div>
              ))}
            </div>
            {barisKemungkinan.map((k) => (
              <div key={k} className="flex items-stretch">
                <div className="w-24 shrink-0 flex items-center text-[11px] font-semibold text-ink-3 pr-2">
                  Kemungkinan {k}
                </div>
                {[1, 2, 3, 4, 5].map((d) => {
                  const skor = k * d;
                  const level = levelDariSkor(skor);
                  const jumlah = matriks[k - 1]?.[d - 1] ?? 0;
                  return (
                    <div
                      key={d}
                      className="flex-1 h-14 m-0.5 rounded-control border border-line/60 flex flex-col items-center justify-center"
                      style={{ background: WARNA_SEL[level] }}
                      title={`Skor ${skor} (${LABEL_LEVEL[level]})`}
                    >
                      <span className={`text-lg font-extrabold tabular-nums ${jumlah > 0 ? 'text-ink' : 'text-ink-3'}`}>
                        {jumlah}
                      </span>
                      <span className="text-[9px] text-ink-3">skor {skor}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 flex-wrap text-[11px]">
          {URUTAN_LEVEL.map((l) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-line/60" style={{ background: WARNA_SEL[l] }} />
              <span className="text-ink-2">
                {LABEL_LEVEL[l]}
                {perLevel ? ` (${perLevel[l]})` : ''}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-surface p-5 rounded-card border border-line">
        <h2 className="text-sm font-bold text-ink mb-3">Risiko Prioritas (Level Tinggi &amp; Ekstrem)</h2>
        {daftar.filter((r) => r.level === 'tinggi' || r.level === 'ekstrem').length === 0 ? (
          <p className="text-xs text-ink-3 italic">Tidak ada risiko pada level tinggi/ekstrem.</p>
        ) : (
          <div className="space-y-2">
            {daftar
              .filter((r) => r.level === 'tinggi' || r.level === 'ekstrem')
              .sort((a, b) => b.skor - a.skor)
              .map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-control bg-surface-2 border border-line">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${KELAS_LEVEL[r.level]}`}>
                    {r.skor} · {LABEL_LEVEL[r.level]}
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] text-ink-3 mr-1.5">{r.kode}</span>
                    <span className="text-xs text-ink">{r.pernyataan}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
