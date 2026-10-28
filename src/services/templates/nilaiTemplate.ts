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
  Ikon?: React.ComponentType<{ className?: string }>;
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
        nilai: teks(w.kpi?.value),
        satuan: teks(w.kpi?.unit) || undefined,
        delta: d,
        deltaTeks: teks(w.kpi?.deltaLabel) || 'vs periode sebelumnya',
        // Naik = hijau, turun = merah (sama seperti contoh template).
        naikBagus: d >= 0,
        seri: seri.length >= 2 ? seri : [0, 0],
      };
    });
  }

  // ── Grafik batang: label + nilai dari dokumen ──────────────────────────────
  const batang = daftar.find((w) => w.type === 'bar' || w.type === 'line' || w.type === 'combo');
  if (batang?.chart) {
    const label = (batang.chart.xAxis || []).map((x) => teks(x));
    const nilai = (batang.chart.series?.[0]?.data || []).map((x) => angka(x));
    if (label.length && nilai.length) hasil.batang = { label, nilai };
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
    if (baris.length) hasil.transaksi = baris;
  }

  // ── Area arus kas ─────────────────────────────────────────────────────────
  const area = daftar.find((w) => w.type === 'area');
  if (area?.chart?.series?.[0]?.data?.length) {
    hasil.area = (area.chart.series[0].data || []).map((x) => angka(x));
  }

  // ── Progres target ────────────────────────────────────────────────────────
  const target = daftar.find((w) => w.type === 'bullet-target');
  const daftarTarget = target?.kpi?.targets || [];
  if (daftarTarget.length) {
    hasil.target = daftarTarget.slice(0, 3).map((t) => {
      const persen = Math.max(0, Math.min(100, angka(t.persen)));
      const s = statusTarget(persen);
      return { nama: teks(t.label), capai: persen, status: s.status, warna: s.warna };
    });
  } else if (target?.kpi?.value != null) {
    const persen = Math.max(0, Math.min(100, angka(target.kpi.value)));
    const s = statusTarget(persen);
    hasil.target = [
      { nama: teks(target.title) || 'Capaian target', capai: persen, status: s.status, warna: s.warna },
    ];
  }

  // ── Insight ───────────────────────────────────────────────────────────────
  const narasi = daftar.find((w) => w.type === 'narasi');
  const isi = teks(narasi?.narasi?.text).trim();
  if (isi) hasil.insight = isi;

  return hasil;
}
