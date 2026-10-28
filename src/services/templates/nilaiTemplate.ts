import React from 'react';
import { Droplets, CreditCard, Landmark, Wallet } from 'lucide-react';
import type { WidgetSpec } from '../../types';

/**
 * Jembatan DATA → TAMPILAN TEMPLATE.
 *
 * Prinsipnya: desain template TIDAK boleh dihitung ulang dari widget. Komponen
 * replika template (`DashboardReferensi`) sudah memegang seluruh susunan, warna,
 * dan bentuk kartu. Yang boleh berubah hanyalah ANGKA — jadi widget hasil
 * pengisian dokumen hanya dipakai sebagai sumber nilai untuk slot yang sudah
 * ada di replika.
 *
 * Kalau dokumen tidak punya nilai untuk sebuah slot, slot itu memakai angka
 * contoh template (bukan dikosongkan), supaya tampilan tetap utuh.
 */

const WARNA_CINCIN = ['#ff8a1f', '#2dd4bf', '#a78bfa', '#f5a524', '#ef4444'];

export interface NilaiKpi {
  label: string;
  nilai: string;
  satuan?: string;
  delta: number;
  deltaTeks: string;
  naikBagus: boolean;
  seri: number[];
  Ikon?: React.ComponentType<{ className?: string }>;
}

export interface NilaiBeban {
  nama: string;
  nilai: number;
  warna: string;
}

export interface NilaiTransaksi {
  nama: string;
  ket: string;
  nilai: string;
  naik: boolean;
  Ikon: React.ComponentType<{ className?: string }>;
}

export interface NilaiTarget {
  nama: string;
  capai: number;
  status: string;
  warna: string;
}

export interface NilaiTemplate {
  kpi?: NilaiKpi[];
  batang?: { label: string[]; nilai: number[] };
  cincin?: NilaiBeban[];
  /** Total nilai cincin apa adanya dari dokumen (mis. "3.184.720.000.000 Miliar Rp"). */
  cincinTotal?: string;
  transaksi?: NilaiTransaksi[];
  area?: number[];
  target?: NilaiTarget[];
  insight?: string;
  /** Subjudul grafik batang menyesuaikan isi data (per tahun / per bulan). */
  batangSub?: string;
  /** Judul cincin menyesuaikan isi data (komposisi pendapatan vs beban). */
  cincinJudul?: string;
  cincinSub?: string;
  /** Judul daftar menyesuaikan isi tabel dokumen. */
  tabelJudul?: string;
}

const IKON_TRANSAKSI = [Droplets, CreditCard, Landmark, Wallet];

const angka = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const bersih = v.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(bersih);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** Angka dokumen diseragamkan ke gaya Indonesia (450.00 → 450,00). */
const rapiAngka = (v: unknown): string => {
  const mentah = typeof v === 'string' ? v.trim() : v;
  if (typeof mentah === 'number' && Number.isFinite(mentah)) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(mentah);
  }
  const t = String(mentah ?? '');
  const n = angka(t);
  if (!t || !Number.isFinite(n)) return t;
  // hanya rapikan bila teksnya memang angka murni (boleh titik/koma pemisah)
  return /^[-+]?[\d.,]+$/.test(t)
    ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)
    : t;
};

const teks = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Persen capaian → warna & keterangan status, sama seperti contoh template. */
const statusTarget = (persen: number): { status: string; warna: string } => {
  if (persen >= 90) return { status: 'sesuai target', warna: '#22c55e' };
  if (persen >= 70) return { status: 'mendekati target', warna: '#ff8a1f' };
  return { status: 'perlu perhatian', warna: '#ef4444' };
};

/**
 * Ubah widget hasil pengisian dokumen menjadi nilai untuk slot template.
 * Pencocokan memakai TIPE kartu (bukan judul), jadi judul kartu boleh berubah.
 */
export function nilaiDariWidgets(widgets: WidgetSpec[] | undefined | null): NilaiTemplate {
  const daftar = Array.isArray(widgets) ? widgets : [];
  const hasil: NilaiTemplate = {};

  // ── KPI: ambil sampai 4 kartu pertama ──────────────────────────────────────
  const kpi = daftar.filter((w) => w.type === 'kpi').slice(0, 4);
  if (kpi.length) {
    hasil.kpi = kpi.map((w) => {
      const d = angka(w.kpi?.delta);
      const seri = (w.kpi?.sparkline || []).map((x: number) => angka(x)).filter((x: number) => Number.isFinite(x));
      return {
        label: teks(w.title),
        nilai: rapiAngka(w.kpi?.value),
        satuan: teks(w.kpi?.unit) || undefined,
        delta: d,
        // Label TETAP seperti template — hanya angkanya yang boleh berubah.
        deltaTeks: 'vs bulan lalu',
        // Naik = hijau, turun = merah (sama seperti contoh template).
        naikBagus: d >= 0,
        seri: seri.length >= 2 ? seri : [],
      };
    });
  }

  // ── Grafik batang: label + nilai dari dokumen ──────────────────────────────
  const batang = daftar.find((w) => w.type === 'bar' || w.type === 'line' || w.type === 'combo');
  if (batang?.chart) {
    const label = (batang.chart.xAxis || []).map((x) => teks(x));
    const nilai = (batang.chart.series?.[0]?.data || []).map((x) => angka(x));
    if (label.length && nilai.length) {
      hasil.batang = { label, nilai };
      const tahunan = label.every((l) => /^\d{4}$/.test(l));
      hasil.batangSub = tahunan
        ? `Pendapatan usaha per tahun, ${label[0]}–${label[label.length - 1]}`
        : 'Pendapatan usaha per bulan';
    }
  }

  // ── Cincin: komposisi (persen dihitung dari nilai) ─────────────────────────
  const cincin = daftar.find((w) => w.type === 'donut' || w.type === 'pie');
  if (cincin?.chart) {
    const label = (cincin.chart.xAxis || []).map((x) => teks(x));
    const nilai = (cincin.chart.series?.[0]?.data || []).map((x) => angka(x));
    const total = nilai.reduce((a, b) => a + b, 0) || 1;
    const isi = label
      .map((nama, i) => ({
        nama,
        nilai: Math.round(((nilai[i] || 0) / total) * 1000) / 10,
        warna: WARNA_CINCIN[i % WARNA_CINCIN.length],
      }))
      .filter((x) => x.nilai > 0);
    if (isi.length) {
      hasil.cincin = isi;
      const nama = label.join(' ').toLowerCase();
      const pendapatan = /rekening|sambungan|denda|retribusi|pendapatan/.test(nama);
      hasil.cincinJudul = pendapatan ? 'Komposisi Pendapatan' : 'Rincian Beban';
      hasil.cincinSub = pendapatan ? 'Nilai tiap sumber pendapatan' : 'Komposisi beban operasional';
      const totalMentah = nilai.reduce((a, b) => a + b, 0);
      const satuan = teks(cincin.chart.unit).trim();
      hasil.cincinTotal = `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(totalMentah)}${satuan ? ` ${satuan}` : ''}`;
    }
  }

  // ── Daftar transaksi: dari tabel (kolom keterangan & jumlah) ───────────────
  const tabel = daftar.find((w) => w.type === 'table' && w.table?.rows?.length);
  if (tabel?.table) {
    const kolom = tabel.table.columns || [];
    const kunciJumlah =
      kolom.find((k) => /jumlah|nilai|nominal|amount/i.test(k.label))?.key || kolom[1]?.key;
    const kunciNama = kolom[0]?.key;
    const baris = (tabel.table.rows || []).slice(0, 4).map((r: any, i: number) => {
      const mentah = teks(r?.[kunciJumlah as string]);
      const turun = /^-/.test(mentah.trim());
      return {
        nama: teks(r?.[kunciNama as string]),
        ket: teks(kolom[2] ? r?.[kolom[2].key as string] : ''),
        nilai: mentah.replace(/^[+-]\s*/, ''),
        naik: !turun,
        Ikon: IKON_TRANSAKSI[i % IKON_TRANSAKSI.length],
      };
    });
    if (baris.length) {
      hasil.transaksi = baris;
      const labelKolom = kolom.map((k) => k.label).join(' ');
      hasil.tabelJudul = /bulan|nrW|m³|m3/i.test(labelKolom) ? 'Data Bulanan' : 'Transaksi Terbaru';
    }
  }

  // ── Area arus kas ─────────────────────────────────────────────────────────
  const area = daftar.find((w) => w.type === 'area');
  if (area?.chart?.series?.[0]?.data?.length) {
    hasil.area = (area.chart.series[0].data || []).map((x) => angka(x));
  }

  // ── Progres target ────────────────────────────────────────────────────────
  // Bentuk kartu template SELALU tiga baris. Dokumen kadang hanya menyebut satu
  // capaian; baris yang tidak ada angkanya tetap ditampilkan dengan nilai 0
  // (batang kosong) supaya tinggi & susunan kartu sama dengan contoh.
  const LABEL_TARGET = ['Target Pendapatan', 'Efisiensi Beban', 'Target Laba Bersih'];
  const target = daftar.find((w) => w.type === 'bullet-target');
  const daftarTarget = target?.kpi?.targets || [];
  const isiTarget: NilaiTarget[] = [];
  if (daftarTarget.length) {
    for (const t of daftarTarget.slice(0, 3)) {
      const persen = Math.round(Math.max(0, Math.min(100, angka(t.persen))));
      const st = statusTarget(persen);
      isiTarget.push({ nama: teks(t.label), capai: persen, status: st.status, warna: st.warna });
    }
  } else if (target?.kpi?.value != null) {
    const persen = Math.round(Math.max(0, Math.min(100, angka(target.kpi.value))));
    const st = statusTarget(persen);
    isiTarget.push({ nama: LABEL_TARGET[0], capai: persen, status: st.status, warna: st.warna });
  }
  // Hanya target yang benar-benar ada di dokumen. Tidak ada angka → kartu kosong.
  if (isiTarget.length) hasil.target = isiTarget;

  // ── Insight ───────────────────────────────────────────────────────────────
  const narasi = daftar.find((w) => w.type === 'narasi');
  const isi = teks(narasi?.narasi?.text).trim();
  if (isi) hasil.insight = isi;

  /**
   * Sparkline KPI. Template selalu menampilkan garis + area bergradasi; kalau
   * dokumen tidak menyertakan deret untuk sebuah KPI, bentuknya diambil dari
   * deret dokumen yang ada (mis. tren pendapatan tahunan) lalu diskalakan agar
   * berakhir tepat di angka KPI itu — jadi bentuknya bukan karangan, tetap
   * mengikuti pergerakan angka dokumen.
   */
  if (hasil.kpi?.length) {
    const acuan = hasil.batang?.nilai || [];
    hasil.kpi = hasil.kpi.map((k) => {
      if (k.seri.length >= 3 && k.seri.some((v) => v !== 0)) return k;
      const akhir = angka(k.nilai);
      if (k.delta) {
        const awal = akhir / (1 + k.delta / 100);
        return {
          ...k,
          seri: Array.from({ length: 10 }, (_, i) => awal + (akhir - awal) * (i / 9)),
        };
      }
      if (acuan.length >= 3 && akhir) {
        const puncakAcuan = acuan[acuan.length - 1] || 1;
        return { ...k, seri: acuan.map((v) => (v / puncakAcuan) * akhir) };
      }
      return k;
    });
  }

  return hasil;
}
