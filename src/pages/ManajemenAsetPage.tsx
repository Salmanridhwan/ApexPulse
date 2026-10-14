import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  PackageX,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import {
  Aset,
  KategoriAset,
  KondisiAset,
  RingkasanAset,
  StatusPemanfaatan,
  UserRole,
} from '../types';
import {
  LABEL_KATEGORI_ASET,
  LABEL_KONDISI,
  LABEL_PEMANFAATAN,
  URUTAN_KATEGORI_ASET,
  URUTAN_KONDISI,
} from '../services/aset/daftarAset';

interface ManajemenAsetPageProps {
  tenantId: string;
  onBackToWorkspace: () => void;
  peran?: UserRole;
}

/** Aset + nilai turunan yang dihitung server (dilampirkan di respons API). */
type AsetTampil = Aset & { nilaiBuku?: number; akumulasiPenyusutan?: number };

/** Kelas badge per kondisi aset. */
const KELAS_KONDISI: Record<KondisiAset, string> = {
  baik: 'bg-pos/15 text-pos border-pos/30',
  rusak_ringan: 'bg-warn/15 text-warn border-warn/30',
  rusak_berat: 'bg-neg/15 text-neg border-neg/30',
};

/** Kelas badge per status pemanfaatan. */
const KELAS_PEMANFAATAN: Record<StatusPemanfaatan, string> = {
  digunakan: 'bg-pos/15 text-pos border-pos/30',
  idle: 'bg-warn/15 text-warn border-warn/30',
  disewakan: 'bg-brand/15 text-brand-ink border-brand/30',
  dilepas: 'bg-ink/10 text-ink-3 border-line',
};

/** Format Rupiah ringkas (mis. "Rp 1,2 M", "Rp 350 jt"). */
function rupiahRingkas(n: number | undefined): string {
  if (!Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000_000) return `Rp ${(v / 1_000_000_000_000).toFixed(2)} T`;
  if (abs >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(2)} M`;
  if (abs >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `Rp ${(v / 1_000).toFixed(0)} rb`;
  return `Rp ${v.toLocaleString('id-ID')}`;
}

/** Format Rupiah penuh. */
function rupiah(n: number | undefined): string {
  if (!Number.isFinite(Number(n))) return '—';
  return `Rp ${Number(n).toLocaleString('id-ID')}`;
}

export const ManajemenAsetPage: React.FC<ManajemenAsetPageProps> = ({ tenantId, onBackToWorkspace, peran }) => {
  const [daftar, setDaftar] = useState<AsetTampil[]>([]);
  const [ringkasan, setRingkasan] = useState<RingkasanAset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'err'; teks: string } | null>(null);
  const [filterKategori, setFilterKategori] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');
  const [filterPemanfaatan, setFilterPemanfaatan] = useState('');
  const [bukaId, setBukaId] = useState<string | null>(null);

  const bisaKelola = peran === 'admin';

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fKode, setFKode] = useState('');
  const [fNama, setFNama] = useState('');
  const [fKategori, setFKategori] = useState<KategoriAset>('mesin');
  const [fLokasi, setFLokasi] = useState('');
  const [fTahun, setFTahun] = useState(new Date().getFullYear());
  const [fPerolehan, setFPerolehan] = useState('');
  const [fUmur, setFUmur] = useState(10);
  const [fResidu, setFResidu] = useState('');
  const [fKondisi, setFKondisi] = useState<KondisiAset>('baik');
  const [fPemanfaatan, setFPemanfaatan] = useState<StatusPemanfaatan>('digunakan');
  const [fCatatan, setFCatatan] = useState('');
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const muat = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterKategori) qs.set('kategori', filterKategori);
      if (filterKondisi) qs.set('kondisi', filterKondisi);
      if (filterPemanfaatan) qs.set('pemanfaatan', filterPemanfaatan);
      const res = await fetch(`/api/aset${qs.toString() ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Gagal memuat daftar aset.');
      const data = await res.json();
      setDaftar(data.aset || []);
      setRingkasan(data.ringkasan || null);
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal memuat daftar aset.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, filterKategori, filterKondisi, filterPemanfaatan]);

  const bukaTambah = () => {
    setEditId(null);
    setFKode(`AST-${String((ringkasan?.total || 0) + 1).padStart(3, '0')}`);
    setFNama('');
    setFKategori('mesin');
    setFLokasi('');
    setFTahun(new Date().getFullYear());
    setFPerolehan('');
    setFUmur(10);
    setFResidu('');
    setFKondisi('baik');
    setFPemanfaatan('digunakan');
    setFCatatan('');
    setIsOpen(true);
  };

  const bukaUbah = (a: AsetTampil) => {
    setEditId(a.id);
    setFKode(a.kode);
    setFNama(a.nama);
    setFKategori(a.kategori);
    setFLokasi(a.lokasi || '');
    setFTahun(a.tahunPerolehan);
    setFPerolehan(String(a.nilaiPerolehan));
    setFUmur(a.umurEkonomis);
    setFResidu(String(a.nilaiResidu));
    setFKondisi(a.kondisi);
    setFPemanfaatan(a.pemanfaatan);
    setFCatatan(a.catatan || '');
    setIsOpen(true);
  };

  const simpan = async () => {
    if (!fKode.trim()) return setPesan({ tipe: 'err', teks: 'Kode aset wajib diisi.' });
    if (!fNama.trim()) return setPesan({ tipe: 'err', teks: 'Nama aset wajib diisi.' });
    setSedangSimpan(true);
    try {
      const body = {
        kode: fKode.trim(),
        nama: fNama.trim(),
        kategori: fKategori,
        lokasi: fLokasi.trim() || undefined,
        tahunPerolehan: fTahun,
        nilaiPerolehan: Number(fPerolehan) || 0,
        umurEkonomis: fUmur,
        nilaiResidu: Number(fResidu) || 0,
        kondisi: fKondisi,
        pemanfaatan: fPemanfaatan,
        catatan: fCatatan.trim() || undefined,
      };
      const res = await fetch(editId ? `/api/aset/${editId}` : '/api/aset', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan aset.');
      setIsOpen(false);
      setPesan({ tipe: 'ok', teks: editId ? 'Aset diperbarui.' : `Aset ${data.kode} ditambahkan.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menyimpan aset.' });
    } finally {
      setSedangSimpan(false);
    }
  };

  const hapus = async (a: AsetTampil) => {
    try {
      const res = await fetch(`/api/aset/${a.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menghapus aset.');
      }
      setPesan({ tipe: 'ok', teks: `Aset ${a.kode} dihapus.` });
      await muat();
    } catch (err: any) {
      setPesan({ tipe: 'err', teks: err.message || 'Gagal menghapus aset.' });
    }
  };

  const kartuRingkas = useMemo(
    () => [
      { label: 'Jumlah Aset', nilai: String(ringkasan?.total ?? 0), ikon: <Building2 className="w-4 h-4" />, warna: 'bg-brand' },
      { label: 'Nilai Buku', nilai: rupiahRingkas(ringkasan?.nilaiBukuTotal), ikon: <Coins className="w-4 h-4" />, warna: 'bg-pos' },
      { label: 'Rusak Berat', nilai: String(ringkasan?.jumlahRusakBerat ?? 0), ikon: <AlertTriangle className="w-4 h-4" />, warna: 'bg-neg' },
      { label: 'Idle / Tak Terpakai', nilai: String(ringkasan?.jumlahIdle ?? 0), ikon: <PackageX className="w-4 h-4" />, warna: 'bg-warn' },
    ],
    [ringkasan]
  );

  const tahun = ringkasan?.tahunPerhitungan || new Date().getFullYear();

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* Header */}
        <div className="bg-surface p-5 rounded-card border border-line mb-6 flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-control bg-brand flex items-center justify-center text-on-brand shrink-0 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink">Manajemen Aset</h1>
              <p className="text-xs sm:text-sm text-ink-2 mt-1.5">
                Daftar aset, nilai buku &amp; penyusutan garis lurus, kondisi, dan pemanfaatan
              </p>
              <p className="text-[11px] text-ink-3 mt-1">
                Dasar: Permendagri 19/2016 (pengelolaan Barang Milik Daerah) · Permendagri 37/2018 — nilai buku dihitung per tahun {tahun}
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
                <span>Tambah Aset</span>
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
              <div className="text-xl font-extrabold text-ink leading-tight tabular-nums break-words">{k.nilai}</div>
            </div>
          ))}
        </div>

        {/* Nilai perolehan vs buku */}
        {ringkasan && ringkasan.total > 0 && (
          <div className="bg-surface p-4 rounded-card border border-line mb-6">
            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="flex items-center gap-1.5 text-ink-3 mb-1">
                  <Banknote className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wide text-[11px]">Nilai Perolehan</span>
                </div>
                <div className="text-base font-bold text-ink tabular-nums">{rupiah(ringkasan.nilaiPerolehanTotal)}</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-ink-3 mb-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wide text-[11px]">Akumulasi Penyusutan</span>
                </div>
                <div className="text-base font-bold text-warn tabular-nums">{rupiah(ringkasan.akumulasiPenyusutanTotal)}</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-ink-3 mb-1">
                  <Coins className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wide text-[11px]">Nilai Buku (per {tahun})</span>
                </div>
                <div className="text-base font-bold text-pos tabular-nums">{rupiah(ringkasan.nilaiBukuTotal)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-bold text-ink">
            Daftar Aset {ringkasan ? `(${daftar.length})` : ''}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Filter kategori"
            >
              <option value="">Semua kategori</option>
              {URUTAN_KATEGORI_ASET.map((k) => (
                <option key={k} value={k}>
                  {LABEL_KATEGORI_ASET[k]}
                </option>
              ))}
            </select>
            <select
              value={filterKondisi}
              onChange={(e) => setFilterKondisi(e.target.value)}
              className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Filter kondisi"
            >
              <option value="">Semua kondisi</option>
              {URUTAN_KONDISI.map((k) => (
                <option key={k} value={k}>
                  {LABEL_KONDISI[k]}
                </option>
              ))}
            </select>
            <select
              value={filterPemanfaatan}
              onChange={(e) => setFilterPemanfaatan(e.target.value)}
              className="text-xs bg-surface-2 border border-line rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Filter pemanfaatan"
            >
              <option value="">Semua pemanfaatan</option>
              <option value="digunakan">Digunakan</option>
              <option value="idle">Idle</option>
              <option value="disewakan">Disewakan</option>
              <option value="dilepas">Dilepas</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-xs text-ink-3">Memuat…</div>
        ) : daftar.length === 0 ? (
          <div className="bg-surface p-10 rounded-card border border-line text-center">
            <Building2 className="w-10 h-10 text-ink-3 mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink mb-1">Belum ada aset terdaftar</p>
            <p className="text-xs text-ink-3 max-w-md mx-auto mb-5">
              {bisaKelola
                ? 'Daftarkan aset instansi (kategori, nilai perolehan, umur ekonomis) — nilai buku & penyusutan dihitung otomatis.'
                : 'Hubungi admin instansi untuk mendaftarkan aset.'}
            </p>
            {bisaKelola && (
              <button
                onClick={bukaTambah}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-ink text-on-brand rounded-control text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Aset
              </button>
            )}
          </div>
        ) : (
          <div className="bg-surface rounded-card border border-line overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-3 border-b border-line bg-surface-2/50">
                    <th className="py-2.5 px-3 font-semibold w-6"></th>
                    <th className="py-2.5 px-3 font-semibold">Kode</th>
                    <th className="py-2.5 px-3 font-semibold">Nama Aset</th>
                    <th className="py-2.5 px-3 font-semibold">Kategori</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Nilai Buku</th>
                    <th className="py-2.5 px-3 font-semibold">Kondisi</th>
                    <th className="py-2.5 px-3 font-semibold">Pemanfaatan</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((a) => {
                    const terbuka = bukaId === a.id;
                    return (
                      <React.Fragment key={a.id}>
                        <tr className="border-b border-line/60 hover:bg-surface-2/40">
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => setBukaId(terbuka ? null : a.id)}
                              className="text-ink-3 hover:text-ink"
                              aria-label={terbuka ? 'Tutup rincian' : 'Buka rincian'}
                            >
                              {terbuka ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-ink-2 whitespace-nowrap">{a.kode}</td>
                          <td className="py-2.5 px-3 text-ink font-medium">{a.nama}</td>
                          <td className="py-2.5 px-3 text-ink-2 whitespace-nowrap">{LABEL_KATEGORI_ASET[a.kategori]}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-ink font-medium whitespace-nowrap">
                            {rupiahRingkas(a.nilaiBuku)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${KELAS_KONDISI[a.kondisi]}`}>
                              {LABEL_KONDISI[a.kondisi]}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${KELAS_PEMANFAATAN[a.pemanfaatan]}`}>
                              {LABEL_PEMANFAATAN[a.pemanfaatan]}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {bisaKelola ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => bukaUbah(a)}
                                  className="p-1.5 text-ink-3 hover:text-brand-ink rounded-control hover:bg-brand/10 transition-colors"
                                  aria-label="Ubah aset"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => void hapus(a)}
                                  className="p-1.5 text-ink-3 hover:text-neg rounded-control hover:bg-neg/10 transition-colors"
                                  aria-label="Hapus aset"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-ink-3">—</span>
                            )}
                          </td>
                        </tr>
                        {terbuka && (
                          <tr className="border-b border-line/60 bg-surface-2/40">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Lokasi/Unit</div>
                                  <p className="text-ink-2">{a.lokasi || '—'}</p>
                                </div>
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Tahun Perolehan</div>
                                  <p className="text-ink-2">{a.tahunPerolehan}</p>
                                </div>
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Nilai Perolehan</div>
                                  <p className="text-ink-2 tabular-nums">{rupiah(a.nilaiPerolehan)}</p>
                                </div>
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Nilai Residu</div>
                                  <p className="text-ink-2 tabular-nums">{rupiah(a.nilaiResidu)}</p>
                                </div>
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Umur Ekonomis</div>
                                  <p className="text-ink-2">{a.umurEkonomis} tahun</p>
                                </div>
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Akumulasi Penyusutan</div>
                                  <p className="text-ink-2 tabular-nums">{rupiah(a.akumulasiPenyusutan)}</p>
                                </div>
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Nilai Buku ({tahun})</div>
                                  <p className="text-pos font-semibold tabular-nums">{rupiah(a.nilaiBuku)}</p>
                                </div>
                                <div>
                                  <div className="font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Catatan</div>
                                  <p className="text-ink-2">{a.catatan || '—'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rekap per kategori */}
        {!isLoading && ringkasan && ringkasan.perKategori.length > 0 && (
          <div className="bg-surface p-5 rounded-card border border-line mt-6">
            <h2 className="text-sm font-bold text-ink mb-3">Rekap per Kategori</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-3 border-b border-line">
                    <th className="py-2 pr-3 font-semibold">Kategori</th>
                    <th className="py-2 pr-3 font-semibold text-right">Jumlah</th>
                    <th className="py-2 font-semibold text-right">Nilai Buku</th>
                  </tr>
                </thead>
                <tbody>
                  {ringkasan.perKategori.map((k) => (
                    <tr key={k.kategori} className="border-b border-line/60 last:border-0">
                      <td className="py-2 pr-3 text-ink-2">{LABEL_KATEGORI_ASET[k.kategori]}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink font-medium">{k.total}</td>
                      <td className="py-2 text-right tabular-nums text-ink">{rupiah(k.nilaiBuku)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal: Tambah/Ubah Aset ===== */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-scrim/50 backdrop-blur-xs" onClick={() => setIsOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-modal-aset"
            className="relative w-full max-w-2xl bg-surface rounded-card shadow-2xl border border-line p-5 z-10 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="judul-modal-aset" className="font-bold text-sm text-ink">
                {editId ? 'Ubah Aset' : 'Tambah Aset'}
              </h3>
              <button onClick={() => setIsOpen(false)} aria-label="Tutup" className="text-ink-3 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Kode</label>
                  <input
                    type="text"
                    value={fKode}
                    onChange={(e) => setFKode(e.target.value)}
                    placeholder="AST-001"
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-ink-2 mb-1">Nama aset *</label>
                  <input
                    type="text"
                    value={fNama}
                    onChange={(e) => setFNama(e.target.value)}
                    placeholder="Pompa air 75 kW"
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Kategori</label>
                  <select
                    value={fKategori}
                    onChange={(e) => setFKategori(e.target.value as KategoriAset)}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {URUTAN_KATEGORI_ASET.map((k) => (
                      <option key={k} value={k}>
                        {LABEL_KATEGORI_ASET[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Lokasi / unit pemakai</label>
                  <input
                    type="text"
                    value={fLokasi}
                    onChange={(e) => setFLokasi(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Tahun perolehan</label>
                  <input
                    type="number"
                    value={fTahun}
                    onChange={(e) => setFTahun(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Umur ekonomis (tahun)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={fUmur}
                    onChange={(e) => setFUmur(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Nilai perolehan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={fPerolehan}
                    onChange={(e) => setFPerolehan(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Nilai residu (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={fResidu}
                    onChange={(e) => setFResidu(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Kondisi</label>
                  <select
                    value={fKondisi}
                    onChange={(e) => setFKondisi(e.target.value as KondisiAset)}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {URUTAN_KONDISI.map((k) => (
                      <option key={k} value={k}>
                        {LABEL_KONDISI[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">Pemanfaatan</label>
                  <select
                    value={fPemanfaatan}
                    onChange={(e) => setFPemanfaatan(e.target.value as StatusPemanfaatan)}
                    className="w-full px-2.5 py-1.5 bg-surface-2 border border-line rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="digunakan">Digunakan Operasional</option>
                    <option value="idle">Idle / Tak Termanfaatkan</option>
                    <option value="disewakan">Disewakan</option>
                    <option value="dilepas">Dilepas/Dihapuskan</option>
                  </select>
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
              {fKategori === 'tanah' && (
                <p className="text-[11px] text-ink-3 bg-surface-2 border border-line rounded-control p-2">
                  Tanah tidak disusutkan — nilai buku = nilai perolehan.
                </p>
              )}
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
    </div>
  );
};
