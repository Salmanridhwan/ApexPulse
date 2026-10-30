import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Table2,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react';
import type { WidgetSpec, WidgetType } from '../types';

/**
 * ImportDataModal — ubah berkas Excel/CSV menjadi widget dashboard.
 *
 * Alur 2 langkah:
 *   1. Pilih berkas & periksa pratinjau tabel (server yang mengurai, bukan browser).
 *   2. Petakan kolom → widget (tipe, judul, label, nilai, target, satuan).
 *
 * Server mengembalikan `WidgetSpec` yang sudah lolos skema; modal ini hanya
 * memanggil `onAddWidget` supaya penyimpanan tetap lewat alur dashboard yang ada.
 * Angka dari berkas ditandai `manual` (bukan hasil dokumen RAG) — tidak ada
 * sitasi palsu yang ditempelkan.
 */

interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Dipanggil dengan widget hasil impor yang sudah tervalidasi server. */
  onAddWidget: (widget: WidgetSpec) => void | Promise<void>;
}

/** Kelompok tipe visualisasi yang masuk akal dibangun dari tabel datar. */
const TIPE_IMPOR: { grup: string; tipe: { type: WidgetType; label: string }[] }[] = [
  {
    grup: 'Kartu',
    tipe: [
      { type: 'kpi', label: 'KPI Card' },
      { type: 'bullet-target', label: 'Bullet (Aktual vs Target)' },
      { type: 'gauge', label: 'Gauge' },
      { type: 'table', label: 'Tabel Rekap' },
    ],
  },
  {
    grup: 'Grafik',
    tipe: [
      { type: 'bar', label: 'Diagram Kolom' },
      { type: 'hbar', label: 'Batang Horizontal' },
      { type: 'line', label: 'Diagram Garis' },
      { type: 'area', label: 'Area Chart' },
      { type: 'combo', label: 'Combo (Dual Axis)' },
      { type: 'waterfall', label: 'Waterfall' },
    ],
  },
  {
    grup: 'Komposisi',
    tipe: [
      { type: 'pie', label: 'Diagram Pai' },
      { type: 'donut', label: 'Diagram Donat' },
      { type: 'treemap', label: 'Treemap' },
      { type: 'funnel', label: 'Funnel' },
    ],
  },
  {
    grup: 'Analitik',
    tipe: [
      { type: 'trend-line', label: 'Garis Tren + Regresi' },
      { type: 'forecast', label: 'Forecast' },
      { type: 'anomaly', label: 'Deteksi Anomali' },
      { type: 'cluster', label: 'Clustering' },
    ],
  },
];

/** Tipe yang butuh kolom label/kategori (bukan sekadar nilai). */
const TIPE_BUTUH_LABEL: WidgetType[] = [
  'bar', 'hbar', 'line', 'area', 'combo', 'waterfall',
  'pie', 'donut', 'treemap', 'funnel', 'trend-line', 'forecast', 'anomaly', 'cluster',
];

interface Pratinjau {
  namaSheet: string;
  daftarSheet: string[];
  kolom: string[];
  kolomNumerik: string[];
  barisPreview: Record<string, string | number | null>[];
  totalBaris: number;
  dipotong: boolean;
}

export const ImportDataModal: React.FC<ImportDataModalProps> = ({
  isOpen,
  onClose,
  onAddWidget,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [langkah, setLangkah] = useState<1 | 2>(1);
  const [namaBerkas, setNamaBerkas] = useState('');
  const [isiBase64, setIsiBase64] = useState('');
  const [sheetTerpilih, setSheetTerpilih] = useState('');
  const [pratinjau, setPratinjau] = useState<Pratinjau | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState('');
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const [sukses, setSukses] = useState(false);
  /** Tipe MIME berkas asal — dipakai server saat menyimpan ke Repositori Dokumen. */
  const [tipeBerkas, setTipeBerkas] = useState('');
  /** Hasil penyimpanan berkas ke repositori (null = belum/tidak tersimpan). */
  const [repositori, setRepositori] = useState<{ nama: string; kb?: string | null; rag?: string; galat?: string } | null>(null);
  const [seretAktif, setSeretAktif] = useState(false);

  // Konfigurasi pemetaan.
  const [tipe, setTipe] = useState<WidgetType>('bar');
  const [judul, setJudul] = useState('');
  const [kolomLabel, setKolomLabel] = useState('');
  const [kolomNilai, setKolomNilai] = useState<string[]>([]);
  const [kolomTarget, setKolomTarget] = useState('');
  const [satuan, setSatuan] = useState('');
  const [ringkasKpi, setRingkasKpi] = useState<'langsung' | 'jumlah' | 'rata-rata'>('langsung');

  const reset = useCallback(() => {
    setLangkah(1);
    setNamaBerkas('');
    setIsiBase64('');
    setSheetTerpilih('');
    setPratinjau(null);
    setMemuat(false);
    setMenyimpan(false);
    setGalat('');
    setPeringatan([]);
    setSukses(false);
    setSeretAktif(false);
    setTipe('bar');
    setJudul('');
    setKolomLabel('');
    setKolomNilai([]);
    setKolomTarget('');
    setSatuan('');
    setRingkasKpi('langsung');
  }, []);

  const tutup = () => {
    reset();
    onClose();
  };

  /** Baca berkas sebagai base64 lalu kirim ke server untuk diurai. */
  const prosesBerkas = async (file: File) => {
    setGalat('');
    setPeringatan([]);
    if (file.size > 25 * 1024 * 1024) {
      setGalat('Berkas terlalu besar (maksimum 25 MB).');
      return;
    }
    setMemuat(true);
    setNamaBerkas(file.name);
    setTipeBerkas(file.type || '');
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
        reader.readAsDataURL(file);
      });
      setIsiBase64(b64);
      await mintaPratinjau(b64, '');
    } catch (err) {
      setGalat((err as Error).message || 'Gagal memproses berkas.');
    } finally {
      setMemuat(false);
    }
  };

  const mintaPratinjau = async (b64: string, sheet: string) => {
    setMemuat(true);
    setGalat('');
    try {
      const res = await fetch('/api/impor/pratinjau', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isi: b64, sheet: sheet || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.kolom) {
        throw new Error(data?.error || 'Berkas tidak bisa dibaca.');
      }
      setPratinjau(data as Pratinjau);
      setSheetTerpilih(data.namaSheet);
      // Tebak pemetaan awal supaya pengguna tidak mulai dari nol.
      const numerik: string[] = data.kolomNumerik || [];
      const labelTebak: string = (data.kolom || []).find((k: string) => !numerik.includes(k)) || '';
      setKolomLabel(labelTebak);
      setKolomNilai(numerik.length > 0 ? [numerik[0]] : []);
      setKolomTarget('');
      setJudul(data.namaSheet || 'Data Impor');
      setLangkah(2);
    } catch (err) {
      setGalat((err as Error).message || 'Gagal membaca berkas.');
    } finally {
      setMemuat(false);
    }
  };

  const gantiSheet = async (sheet: string) => {
    setSheetTerpilih(sheet);
    await mintaPratinjau(isiBase64, sheet);
  };

  const bangun = async () => {
    setGalat('');
    setPeringatan([]);
    if (kolomNilai.length === 0) {
      setGalat('Pilih minimal satu kolom nilai.');
      return;
    }
    if (TIPE_BUTUH_LABEL.includes(tipe) && !kolomLabel) {
      setGalat('Tipe ini memerlukan kolom label/kategori.');
      return;
    }
    setMenyimpan(true);
    try {
      const res = await fetch('/api/impor/widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isi: isiBase64,
          sheet: sheetTerpilih || undefined,
          nama: namaBerkas || undefined,
          tipe: tipeBerkas || undefined,
          konfig: {
            tipe,
            judul,
            kolomLabel: kolomLabel || undefined,
            kolomNilai,
            kolomTarget: kolomTarget || undefined,
            satuan: satuan || undefined,
            ringkasKpi: tipe === 'kpi' || tipe === 'bullet-target' ? ringkasKpi : undefined,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.widget) {
        throw new Error(data?.error || 'Gagal membangun widget dari berkas.');
      }
      setPeringatan(Array.isArray(data.peringatan) ? data.peringatan : []);
      setRepositori(
        data.berkas
          ? { nama: data.berkas.nama, kb: data.knowledgeBase, rag: data.berkas.ragStatus }
          : data.peringatanBerkas
            ? { nama: namaBerkas, galat: String(data.peringatanBerkas) }
            : null
      );
      await onAddWidget(data.widget as WidgetSpec);
      setSukses(true);
      // Beri waktu membaca status penyimpanan berkas sebelum modal menutup.
      setTimeout(() => tutup(), 2200);
    } catch (err) {
      setGalat((err as Error).message || 'Gagal menyimpan widget.');
    } finally {
      setMenyimpan(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setSeretAktif(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void prosesBerkas(file);
  };

  const toggleNilai = (kolom: string) => {
    setKolomNilai((prev) =>
      prev.includes(kolom) ? prev.filter((k) => k !== kolom) : [...prev, kolom]
    );
  };

  const butuhLabel = TIPE_BUTUH_LABEL.includes(tipe);
  const butuhTarget = tipe === 'bullet-target' || tipe === 'kpi';
  const semuaTipe = useMemo(() => TIPE_IMPOR.flatMap((g) => g.tipe), []);

  if (!isOpen) return null;

  return (
    <div className="modal-layer">
      <div className="scrim" onClick={tutup} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="impor-title"
        className="relative w-full max-w-3xl bg-surface rounded-card shadow-2xl border border-line overflow-hidden z-10 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-solid flex items-center justify-center text-on-solid">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 id="impor-title" className="text-sm font-semibold text-ink">
                Impor Data Excel / CSV
              </h2>
              <p className="text-xs text-ink-2">
                Ubah berkas tabel menjadi widget dashboard — angka dibaca apa adanya.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Indikator langkah */}
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-ink-3">
              <span className={langkah === 1 ? 'text-brand font-bold' : ''}>1. Berkas</span>
              <span>›</span>
              <span className={langkah === 2 ? 'text-brand font-bold' : ''}>2. Pemetaan</span>
            </span>
            <button
              onClick={tutup}
              className="p-1 rounded-chip text-ink-3 hover:text-ink-2 hover:bg-line transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-surface">
          {galat && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-control bg-danger/10 border border-danger/30 text-[12px] text-danger">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{galat}</span>
            </div>
          )}

          {sukses && (
            <div className="mb-4 space-y-1.5 p-3 rounded-control bg-success/10 border border-success/30 text-[12px] text-success">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Widget berhasil ditambahkan ke dashboard.</span>
              </div>
              {repositori?.galat ? (
                <div className="flex items-start gap-2 text-warn">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{repositori.galat}</span>
                </div>
              ) : repositori ? (
                <div className="flex items-start gap-2 text-ink-2">
                  <Archive className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Berkas <span className="font-semibold text-ink">{repositori.nama}</span> juga tersimpan di Repositori
                    Dokumen{repositori.kb ? ` · basis dokumen ${repositori.kb}` : ''}
                    {repositori.rag ? ` · status indeks: ${repositori.rag}` : ''}.
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* ---------- LANGKAH 1: pilih berkas ---------- */}
          {langkah === 1 && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setSeretAktif(true);
                }}
                onDragLeave={() => setSeretAktif(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-card p-10 text-center transition-colors ${
                  seretAktif ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/50 hover:bg-surface-2'
                }`}
              >
                {memuat ? (
                  <div className="flex flex-col items-center gap-3 text-ink-2">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                    <span className="text-sm">Membaca berkas…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-card bg-surface-2 border border-line flex items-center justify-center">
                      <UploadCloud className="w-7 h-7 text-ink-3" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        Seret berkas ke sini, atau klik untuk memilih
                      </p>
                      <p className="text-xs text-ink-3 mt-1">
                        Format: .xlsx, .xls, .csv — maksimum 25 MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void prosesBerkas(file);
                  e.target.value = '';
                }}
              />
              <p className="mt-3 text-[11px] text-ink-3 leading-relaxed">
                Berkas diurai di server. Baris pertama dianggap judul kolom. Angka gaya
                Indonesia (1.234,56) maupun internasional (1,234.56) dikenali; nilai yang tidak
                jelas TIDAK ditebak.
              </p>
            </div>
          )}

          {/* ---------- LANGKAH 2: pemetaan ---------- */}
          {langkah === 2 && pratinjau && (
            <div className="space-y-4">
              {/* Info berkas + pilih sheet */}
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-2 bg-surface-2 border border-line rounded-control px-3 py-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-brand" />
                  {namaBerkas}
                </span>
                <span className="text-line-strong">·</span>
                <span>
                  {pratinjau.totalBaris} baris · {pratinjau.kolom.length} kolom
                </span>
                {pratinjau.daftarSheet.length > 1 && (
                  <>
                    <span className="text-line-strong">·</span>
                    <label className="inline-flex items-center gap-1.5">
                      <span className="text-ink-3">Sheet:</span>
                      <select
                        value={sheetTerpilih}
                        onChange={(e) => void gantiSheet(e.target.value)}
                        className="bg-surface border border-line rounded-chip px-2 py-1 text-[11px] text-ink"
                      >
                        {pratinjau.daftarSheet.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <button
                  onClick={() => {
                    setLangkah(1);
                    setPratinjau(null);
                    setNamaBerkas('');
                    setIsiBase64('');
                  }}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink"
                >
                  <ArrowLeft className="w-3 h-3" /> Ganti berkas
                </button>
              </div>

              {pratinjau.dipotong && (
                <p className="text-[11px] text-warn flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Berkas sangat besar — hanya 20.000 baris pertama yang diproses.
                </p>
              )}

              {/* Pratinjau tabel */}
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-ink-2 uppercase tracking-wider">
                  <Table2 className="w-3.5 h-3.5" /> Pratinjau (50 baris pertama)
                </div>
                <div className="overflow-auto border border-line rounded-control max-h-48">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-surface-2">
                      <tr>
                        {pratinjau.kolom.map((k) => (
                          <th
                            key={k}
                            className={`text-left px-2.5 py-1.5 font-semibold border-b border-line whitespace-nowrap ${
                              pratinjau.kolomNumerik.includes(k) ? 'text-brand' : 'text-ink'
                            }`}
                          >
                            {k}
                            {pratinjau.kolomNumerik.includes(k) && (
                              <span className="ml-1 text-[9px] text-ink-3">#</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pratinjau.barisPreview.map((row, i) => (
                        <tr key={i} className="hover:bg-surface-2/60">
                          {pratinjau.kolom.map((k) => (
                            <td
                              key={k}
                              className="px-2.5 py-1.5 border-b border-line/60 text-ink-2 whitespace-nowrap"
                            >
                              {row[k] === null || row[k] === undefined ? '' : String(row[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pemetaan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-ink-2 mb-1">
                    Tipe visualisasi
                  </span>
                  <select
                    value={tipe}
                    onChange={(e) => setTipe(e.target.value as WidgetType)}
                    className="w-full bg-surface border border-line rounded-control px-2.5 py-2 text-[12px] text-ink"
                  >
                    {TIPE_IMPOR.map((g) => (
                      <optgroup key={g.grup} label={g.grup}>
                        {g.tipe.map((t) => (
                          <option key={t.type} value={t.type}>
                            {t.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-ink-2 mb-1">
                    Judul widget
                  </span>
                  <input
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder="mis. Realisasi Pendapatan per Wilayah"
                    className="w-full bg-surface border border-line rounded-control px-2.5 py-2 text-[12px] text-ink"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-ink-2 mb-1">
                    Kolom label / kategori {butuhLabel && <span className="text-danger">*</span>}
                  </span>
                  <select
                    value={kolomLabel}
                    onChange={(e) => setKolomLabel(e.target.value)}
                    className="w-full bg-surface border border-line rounded-control px-2.5 py-2 text-[12px] text-ink"
                  >
                    <option value="">— Tidak ada (pakai nomor baris) —</option>
                    {pratinjau.kolom.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-ink-2 mb-1">
                    Satuan (opsional)
                  </span>
                  <input
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    placeholder="mis. juta Rp, %, orang"
                    className="w-full bg-surface border border-line rounded-control px-2.5 py-2 text-[12px] text-ink"
                  />
                </label>
              </div>

              {/* Kolom nilai (multi) */}
              <div>
                <span className="block text-[11px] font-semibold text-ink-2 mb-1.5">
                  Kolom nilai <span className="text-danger">*</span>
                  {tipe !== 'table' && (
                    <span className="ml-1 font-normal text-ink-3">
                      (boleh lebih dari satu → seri ganda)
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {pratinjau.kolom.map((k) => {
                    const aktif = kolomNilai.includes(k);
                    const numerik = pratinjau.kolomNumerik.includes(k);
                    return (
                      <button
                        key={k}
                        onClick={() => toggleNilai(k)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-chip text-[11px] font-medium border transition-colors ${
                          aktif
                            ? 'bg-brand text-on-brand border-brand'
                            : numerik
                              ? 'bg-surface-2 text-ink-2 border-line hover:border-brand/50'
                              : 'bg-surface text-ink-3 border-line/60 hover:border-line'
                        }`}
                        title={numerik ? 'Terdeteksi berisi angka' : 'Kolom ini tidak terdeteksi numerik'}
                      >
                        {aktif && <CheckCircle2 className="w-3 h-3" />}
                        {k}
                        {numerik && !aktif && <span className="text-[9px] text-brand">#</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target & ringkas KPI */}
              {butuhTarget && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-ink-2 mb-1">
                      Kolom target (opsional)
                    </span>
                    <select
                      value={kolomTarget}
                      onChange={(e) => setKolomTarget(e.target.value)}
                      className="w-full bg-surface border border-line rounded-control px-2.5 py-2 text-[12px] text-ink"
                    >
                      <option value="">— Tanpa target —</option>
                      {pratinjau.kolom.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-ink-2 mb-1">
                      Ringkas nilai (baris banyak)
                    </span>
                    <select
                      value={ringkasKpi}
                      onChange={(e) =>
                        setRingkasKpi(e.target.value as 'langsung' | 'jumlah' | 'rata-rata')
                      }
                      className="w-full bg-surface border border-line rounded-control px-2.5 py-2 text-[12px] text-ink"
                    >
                      <option value="langsung">Nilai baris pertama</option>
                      <option value="jumlah">Jumlah semua baris</option>
                      <option value="rata-rata">Rata-rata semua baris</option>
                    </select>
                  </label>
                </div>
              )}

              {peringatan.length > 0 && (
                <ul className="space-y-1">
                  {peringatan.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-warn">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-3">
            {langkah === 2 && pratinjau
              ? `Widget akan dibuat dari ${pratinjau.totalBaris} baris data.`
              : 'Pilih berkas untuk memulai.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={tutup}
              className="px-3 py-1.5 text-[12px] font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors"
            >
              Batal
            </button>
            {langkah === 2 && (
              <button
                onClick={() => void bangun()}
                disabled={menyimpan || kolomNilai.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {menyimpan ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                Buat Widget
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
