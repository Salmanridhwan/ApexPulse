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
  areaLabel?: string[];
  areaSub?: string;
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
      const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
      const besar = /rupiah|rp|idr/i.test(String(satuan || ''));
      hasil.cincinTotal =
        besar && totalMentah >= 1e9
          ? `${fmt.format(totalMentah / 1e9)} M`
          : `${fmt.format(totalMentah)}${satuan ? ` ${satuan}` : ''}`;
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
  if (area?.chart?.series?.length) {
    // Ambil seri terakhir (periode terbaru) supaya angka yang tampil paling baru.
    const seri = area.chart.series[area.chart.series.length - 1];
    if (seri?.data?.length) {
      hasil.area = (seri.data || []).map((x) => angka(x));
      const sumbu = area.chart.xAxis || [];
      const kategori = sumbu.some((l) => /kas|modal|laba|pendapatan|beban|belanja/i.test(String(l)));
      if (kategori && sumbu.length === hasil.area.length) {
        hasil.areaLabel = sumbu.map((l) =>
          String(l)
            .replace(/…|\.\.\.$/, '')
            .replace(/\s+(tahun|berjalan|operasional|lainnya)$/i, '')
            .trim()
            .split(/\s+/)
            .slice(0, 1)
            .join(' ')
            .slice(0, 9),
        );
        hasil.areaSub = `Nilai tiap komponen, ${seri.name || 'periode terbaru'}`;
      } else if (sumbu.length === hasil.area.length) {
        hasil.areaLabel = sumbu.map(String);
      }
    }
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

// ============================================================================
// T2 — ANALITIK BISNIS HARIAN (DashboardAnalitik)
// ============================================================================
/**
 * Jembatan DATA → TAMPILAN untuk template T2.
 *
 * T2 punya kartu yang tidak ada di T1 (pesanan per status, kategori, per jam,
 * metode pembayaran, tren konversi), jadi `nilaiDariWidgets` tidak cukup: ia
 * hanya mengambil grafik PERTAMA. Di sini setiap slot T2 dicocokkan dengan
 * kartunya sendiri lewat JUDUL (judul selalu dipertahankan dari template oleh
 * `isiTemplateDariRag`), sehingga angka tiap kartu berasal dari kartunya.
 *
 * Aturan yang sama seperti T1: kartu yang ditandai `dataKosong` TIDAK
 * menyumbang angka apa pun — slotnya dibiarkan kosong oleh komponen, bukan
 * diisi angka contoh.
 */

export interface NilaiAnalitikKpi {
  label: string;
  nilai: string;
  satuan?: string;
  /** '+12,5%' siap tampil; string kosong = dokumen tidak menyebut perubahan. */
  delta: string;
  deltaTeks: string;
  naik: boolean;
  seri: number[];
}

export interface NilaiAnalitikDeret {
  label: string[];
  nilai: number[];
}

export interface NilaiAnalitikBagian {
  nama: string;
  nilai: number;
}

export interface NilaiAnalitikBaris {
  id: string;
  nama: string;
  inisial: string;
  tanggal: string;
  jumlah: string;
  status: string;
  warna?: string;
}

export interface NilaiAnalitik {
  kpi?: NilaiAnalitikKpi[];
  /** Grafik area "Ikhtisar Pendapatan" (deret pendapatan dari dokumen). */
  pendapatan?: NilaiAnalitikDeret;
  pendapatanSatuan?: string;
  /** Rentang periode apa adanya dari label dokumen (mis. "Jan – Des"). */
  pendapatanRentang?: string;
  /** Batang pesanan per status, urut seperti kartu: selesai…dikembalikan. */
  status?: Array<number | null>;
  /** Cincin sumber kunjungan (persen, dihitung dari angka dokumen). */
  sumber?: NilaiAnalitikBagian[];
  sumberTotal?: string;
  /** Judul kartu cincin mengikuti isi dokumen (mis. "Komposisi Air"). */
  sumberJudul?: string;
  kategoriJudul?: string;
  jamJudul?: string;
  konversiJudul?: string;
  statusJudul?: string;
  pendapatanJudul?: string;
  /** Label kecil di bawah total cincin (template: "Total Kunjungan"). */
  sumberLabelTotal?: string;
  pesanan?: NilaiAnalitikBaris[];
  kategori?: NilaiAnalitikBagian[];
  jam?: NilaiAnalitikDeret;
  bayar?: NilaiAnalitikBagian[];
  bayarJudul?: string;
  /** Total ringkas siap tampil (mis. "3.184,72 M"). */
  bayarTotal?: string;
  bayarLabel?: string;
  konversi?: NilaiAnalitikDeret;
}

/** Urutan status pada kartu "Pesanan per Status" (sama dengan komponennya). */
const URUTAN_STATUS = ['selesai', 'diproses', 'dikirim', 'dibatalkan', 'dikembalikan'];

/** Angka + satuan apa adanya dari dokumen ("Rp 128.430", "25,9 Juta Rp"). */
export const teksNilai = (jumlah: number, satuan?: string): string => {
  const s = teks(satuan).trim();
  const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
  const besar = /juta|miliar|milyar|triliun|ribu/i.exec(s)?.[0];
  if (/rp|rupiah|idr/i.test(s)) {
    // Rupiah besar diringkas supaya muat di kartu (3.184.720.000.000 -> 3.184,72 M).
    if (!besar && jumlah >= 1e9) return `${fmt.format(jumlah / 1e9)} M`;
    if (!besar && jumlah >= 1e6) return `${fmt.format(jumlah / 1e6)} jt`;
    return `Rp ${fmt.format(jumlah)}${besar ? ` ${besar.toLowerCase()}` : ''}`;
  }
  return `${fmt.format(jumlah)}${s ? ` ${s}` : ''}`;
};

/** Deret berkategori (label sumbu X + seri pertama) dari sebuah kartu grafik. */
const deretKartu = (w?: WidgetSpec): NilaiAnalitikDeret | undefined => {
  const label = (w?.chart?.xAxis || []).map((x) => teks(x));
  const nilai = (w?.chart?.series?.[0]?.data || []).map((x) => angka(x));
  if (!label.length || !nilai.length) return undefined;
  return { label, nilai };
};

/** Nilai mentah per kategori (bukan persen) — untuk batang & tabel. */
const bagianKartu = (w?: WidgetSpec): NilaiAnalitikBagian[] | undefined => {
  const label = (w?.chart?.xAxis || []).map((x) => teks(x));
  const nilai = (w?.chart?.series?.[0]?.data || []).map((x) => angka(x));
  if (!label.length || !nilai.length) return undefined;
  return label.map((nama, i) => ({ nama, nilai: nilai[i] ?? 0 }));
};

/**
 * Ubah widget hasil pengisian dokumen menjadi nilai untuk slot template T2.
 * Kartu ber-`dataKosong` diabaikan; slot yang tidak punya sumber tetap kosong.
 */
export function nilaiAnalitikDariWidgets(widgets: WidgetSpec[] | undefined | null): NilaiAnalitik {
  const semua = Array.isArray(widgets) ? widgets : [];
  const daftar = semua.filter((w) => w && !w.dataKosong);
  const hasil: NilaiAnalitik = {};

  const judul = (w: WidgetSpec) => teks(w.title).toLowerCase();
  /**
   * Judul kartu saat memakai data dokumen: ambil dari NAMA SERI dokumen, karena
   * isinya sering bukan lagi sesuai judul template (mis. kartu "Pesanan per Jam"
   * berisi air terjual per bulan). Satuan dalam tanda kurung dibuang.
   */
  const judulSeri = (w?: WidgetSpec): string | undefined => {
    const nama = (w?.chart?.series || [])
      .map((sr) => teks(sr?.name))
      .filter(Boolean)
      .join(' vs ');
    if (!nama) return undefined;
    return nama.replace(/\s*\([^)]*\)\s*$/, '').trim() || undefined;
  };
  /** Hanya kartu yang benar-benar membawa deret angka. */
  const bergrafik = daftar.filter((w) => Array.isArray(w.chart?.series) && w.chart!.series.length > 0);

  /**
   * Bentuk grafik sebuah kartu. Dipakai saat mencocokkan slot: dokumen instansi
   * jarang memakai judul kartu yang sama seperti template, jadi isi boleh masuk
   * ke slot yang BENTUKNYA cocok selama judul kartu ikut diganti.
   */
  const jenisGrafik = (w: WidgetSpec): 'garis' | 'batang' | 'donat' | 'lain' => {
    const t = teks(w.type).toLowerCase();
    if (t === 'donut' || t === 'pie' || t === 'cincin') return 'donat';
    if (t === 'bar' || t === 'hbar' || t === 'batang') return 'batang';
    if (t === 'line' || t === 'area') return 'garis';
    return 'lain';
  };
  /** Kartu grafik yang sudah dipakai satu slot; sisanya boleh mengisi slot kosong. */
  const terpakai = new Set<WidgetSpec>();
  const ambilSisa = (jenis: 'garis' | 'batang' | 'donat'): WidgetSpec | undefined => {
    const w = bergrafik.find((x) => !terpakai.has(x) && jenisGrafik(x) === jenis);
    if (w) terpakai.add(w);
    return w;
  };

  // ── KPI: sampai 4 kartu pertama (label & angka dari dokumen) ───────────────
  const kpi = daftar.filter((w) => w.type === 'kpi').slice(0, 4);
  if (kpi.length) {
    hasil.kpi = kpi.map((w) => {
      const mentah = w.kpi?.delta;
      const d = typeof mentah === 'number' && Number.isFinite(mentah) ? mentah : undefined;
      const seri = (w.kpi?.sparkline || []).map((x) => angka(x)).filter((x) => Number.isFinite(x));
      return {
        label: teks(w.title),
        nilai: rapiAngka(w.kpi?.value),
        satuan: teks(w.kpi?.unit) || undefined,
        delta:
          d == null
            ? ''
            : `${d > 0 ? '+' : ''}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(d)}%`,
        deltaTeks: d == null ? '' : 'vs periode lalu',
        naik: (d ?? 0) >= 0,
        // Sparkline hanya bila dokumen menyertakan deretnya — tidak dikarang.
        seri: seri.length >= 2 ? seri : [],
      };
    });
  }

  // ── Area "Ikhtisar Pendapatan" ─────────────────────────────────────────────
  const wPendapatan =
    bergrafik.find((w) => /ikhtisar|pendapatan|revenue|omzet/i.test(judul(w))) ?? bergrafik[0];
  if (wPendapatan) terpakai.add(wPendapatan);
  const pendapatan = deretKartu(wPendapatan);
  if (pendapatan) {
    hasil.pendapatan = pendapatan;
    hasil.pendapatanSatuan = teks(wPendapatan?.chart?.unit).trim() || undefined;
    hasil.pendapatanRentang = `${pendapatan.label[0]} – ${pendapatan.label[pendapatan.label.length - 1]}`;
    hasil.pendapatanJudul = judulSeri(wPendapatan);
  }

  // ── Batang "Pesanan per Status" ────────────────────────────────────────────
  const wStatus = bergrafik.find((w) => /status/i.test(judul(w)));
  if (wStatus) terpakai.add(wStatus);
  if (wStatus) {
    const label = (wStatus.chart?.xAxis || []).map((x) => teks(x).toLowerCase());
    const nilai = (wStatus.chart?.series?.[0]?.data || []).map((x) => angka(x));
    // Urutan & warna batang milik template; angkanya dicocokkan per nama status.
    const isi = URUTAN_STATUS.map((s) => {
      const i = label.findIndex((l) => l.includes(s));
      return i >= 0 ? nilai[i] ?? null : null;
    });
    if (isi.some((v) => v != null)) hasil.status = isi;
    hasil.statusJudul = judulSeri(wStatus) || teks(wStatus?.title);
  }

  // ── Cincin "Sumber Kunjungan" (persen) & batang "Metode Pembayaran" ────────
  const donat = daftar.filter((w) => w.type === 'donut' || w.type === 'pie');

  const wSumber = donat.find((w) => /sumber|kunjungan|trafik|traffic|kanal|channel/i.test(judul(w)));
  if (wSumber) terpakai.add(wSumber);
  const sumber = bagianKartu(wSumber);
  if (sumber) {
    const total = sumber.reduce((a, b) => a + b.nilai, 0);
    if (total > 0) {
      hasil.sumber = sumber.map((d) => ({
        nama: d.nama,
        nilai: Math.round((d.nilai / total) * 1000) / 10,
      }));
      hasil.sumberTotal = teksNilai(total, wSumber?.chart?.unit);
      // Judul mengikuti isi dokumen — kalau dokumen berisi komposisi air, jangan
      // tetap berjudul "Sumber Kunjungan".
      hasil.sumberJudul = judulSeri(wSumber) || teks(wSumber?.title) || 'Komposisi';
      hasil.sumberLabelTotal = 'Total';
    }
  }

  const wBayar = donat.find((w) => /bayar|pembayaran|payment/i.test(judul(w)));
  if (wBayar) terpakai.add(wBayar);
  const bayar = bagianKartu(wBayar);
  if (bayar) {
    hasil.bayar = bayar;
    const totalBayar = bayar.reduce((a, b) => a + b.nilai, 0);
    hasil.bayarJudul = judulSeri(wBayar) || teks(wBayar?.title) || 'Komposisi';
    hasil.bayarTotal = teksNilai(totalBayar, wBayar?.chart?.unit);
    hasil.bayarLabel = `komposisi · ${bayar.length} bagian`;
  }

  // ── Batang "Nilai Pesanan per Kategori" ────────────────────────────────────
  const wKategori = bergrafik.find((w) => /kategori|category/i.test(judul(w)));
  if (wKategori) terpakai.add(wKategori);
  const kategori = bagianKartu(wKategori);
  if (kategori) {
    hasil.kategori = kategori;
    hasil.kategoriJudul = judulSeri(wKategori) || teks(wKategori?.title);
  }

  // ── Batang "Pesanan per Jam" ───────────────────────────────────────────────
  const wJam = bergrafik.find((w) => /per jam|\bjam\b|hour/i.test(judul(w)));
  const jam = deretKartu(wJam);
  if (jam) {
    hasil.jam = jam;
    hasil.jamJudul = judulSeri(wJam) || teks(wJam?.title);
  }

  // ── Garis "Tren Konversi" ──────────────────────────────────────────────────
  const wKonversi = bergrafik.find((w) => /konversi|conversion/i.test(judul(w)));
  if (wKonversi) terpakai.add(wKonversi);
  const konversi = deretKartu(wKonversi);
  if (konversi) {
    hasil.konversi = konversi;
    hasil.konversiJudul = judulSeri(wKonversi) || teks(wKonversi?.title);
  }

  // ── Tabel "Pesanan Terbaru" (hanya bila template punya kartu tabel) ────────
  const tabel = daftar.find((w) => w.type === 'table' && Array.isArray(w.table?.rows) && w.table!.rows.length > 0);
  if (tabel?.table) {
    const kolom = tabel.table.columns || [];
    const kunci = (pola: RegExp, cadangan?: number) =>
      kolom.find((k) => pola.test(k.label))?.key ?? (cadangan == null ? undefined : kolom[cadangan]?.key);
    const kNama = kunci(/pelanggan|nama|customer|uraian|keterangan/i, 0);
    const kId = kunci(/\bid\b|kode|nomor|no\./i);
    const kTanggal = kunci(/tanggal|tgl|periode|date/i);
    const kJumlah = kunci(/jumlah|nilai|nominal|amount|total/i, 1);
    const kStatus = kunci(/status/i);
    const baris = (tabel.table.rows || []).slice(0, 8).map((r: any) => {
      const nama = teks(r?.[kNama as string]);
      const inisial = nama
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => x[0]?.toUpperCase() ?? '')
        .join('');
      return {
        id: teks(r?.[kId as string]),
        nama,
        inisial,
        tanggal: teks(r?.[kTanggal as string]),
        jumlah: teks(r?.[kJumlah as string]),
        status: teks(r?.[kStatus as string]),
      };
    });
    if (baris.length) hasil.pesanan = baris;
  }

  // ── Slot kosong diisi kartu grafik sisa yang bentuknya cocok ───────────────
  // Dokumen instansi tidak selalu memakai judul kartu seperti template (mis.
  // tidak ada kartu "Pesanan per Jam"). Selama bentuk grafiknya sama, isinya
  // tetap boleh masuk dan judul kartu mengikuti nama seri dokumen.
  const isiDeret = (
    kunciSlot: 'pendapatan' | 'jam' | 'konversi',
    sudahAda: boolean
  ) => {
    if (sudahAda) return;
    const w = ambilSisa('garis');
    const d = deretKartu(w);
    if (!d) return;
    hasil[kunciSlot] = d;
    const judulSlot = judulSeri(w) || teks(w?.title) || undefined;
    if (kunciSlot === 'pendapatan') {
      hasil.pendapatanSatuan = teks(w?.chart?.unit).trim() || undefined;
      hasil.pendapatanRentang = `${d.label[0]} – ${d.label[d.label.length - 1]}`;
      hasil.pendapatanJudul = judulSlot;
    } else if (kunciSlot === 'jam') {
      hasil.jamJudul = judulSlot;
    } else {
      hasil.konversiJudul = judulSlot;
    }
  };
  isiDeret('pendapatan', !!hasil.pendapatan);
  isiDeret('jam', !!hasil.jam);
  isiDeret('konversi', !!hasil.konversi);

  if (!hasil.kategori) {
    const w = ambilSisa('batang');
    const bagian = bagianKartu(w);
    if (bagian) {
      hasil.kategori = bagian;
      hasil.kategoriJudul = judulSeri(w) || teks(w?.title);
    }
  }

  const isiDonat = (kunciSlot: 'sumber' | 'bayar', sudahAda: boolean) => {
    if (sudahAda) return;
    const w = ambilSisa('donat');
    const bagian = bagianKartu(w);
    if (!bagian) return;
    const total = bagian.reduce((a, b) => a + b.nilai, 0);
    if (total <= 0) return;
    const persen = bagian.map((d) => ({ nama: d.nama, nilai: Math.round((d.nilai / total) * 1000) / 10 }));
    const judulSlot = judulSeri(w) || teks(w?.title) || 'Komposisi';
    const teksTotal = teksNilai(total, w?.chart?.unit);
    if (kunciSlot === 'sumber') {
      hasil.sumber = persen;
      hasil.sumberTotal = teksTotal;
      hasil.sumberJudul = judulSlot;
      hasil.sumberLabelTotal = 'Total';
    } else {
      hasil.bayar = bagian;
      hasil.bayarJudul = judulSlot;
      hasil.bayarTotal = teksTotal;
      hasil.bayarLabel = `komposisi · ${bagian.length} bagian`;
    }
  };
  isiDonat('sumber', !!hasil.sumber);
  isiDonat('bayar', !!hasil.bayar);

  // ── Sparkline KPI ─────────────────────────────────────────────────────────
  // Aturan yang sama seperti T1: kartu KPI template selalu bergaris dan berarea.
  // Bila dokumen hanya menyebut satu angka, bentuk garis diturunkan dari DELTA
  // dokumen saja (garis berakhir tepat di angka KPI). Tanpa delta tidak ada
  // pembanding, jadi tidak ada tren: komponen menggambar garis datar abu-abu.
  if (hasil.kpi?.length) {
    hasil.kpi = hasil.kpi.map((k) => {
      if (k.seri.length >= 3 && k.seri.some((v) => v !== 0)) return k;
      const akhir = angka(k.nilai);
      const d = parseFloat(String(k.delta).replace('+', '').replace('%', '').replace(',', '.'));
      if (Number.isFinite(d) && d !== 0 && akhir) {
        const awal = akhir / (1 + d / 100);
        return { ...k, seri: Array.from({ length: 10 }, (_, i) => awal + (akhir - awal) * (i / 9)) };
      }
      return k;
    });
  }

  return hasil;
}

// ============================================================================
// T3 — TRAFIK WEB & PERILAKU (DashboardTrafik)
// ============================================================================
/**
 * Jembatan DATA → TAMPILAN untuk template T3.
 *
 * T3 punya sembilan kartu yang bentuknya khas (5 KPI bersparkline, batang
 * bertumpuk sumber trafik, garis relevansi, komposisi usia, daftar halaman,
 * batang perangkat, cincin perilaku, daftar OS, daftar frasa). Karena itu tiap
 * slot dicocokkan dengan kartunya sendiri, bukan memakai `nilaiDariWidgets`
 * (yang hanya mengambil grafik pertama).
 *
 * Aturan yang sama seperti T1/T2: kartu ber-`dataKosong` tidak menyumbang angka
 * apa pun. Slot yang tidak punya sumber di dokumen TIDAK diisi angka contoh —
 * komponen membiarkannya kosong.
 */

export interface NilaiTrafikKpi {
  /** Label kartu dari dokumen; kosong = komponen memakai label template. */
  label?: string;
  /** Angka siap tampil (mis. "57%" atau "1.120"). */
  nilai: string;
  /** Perubahan dalam persen; undefined = dokumen tidak menyebut perubahan. */
  delta?: number;
  /** Deret sparkline dokumen; undefined = tidak ada deret. */
  seri?: number[];
}

export interface NilaiTrafikSeri {
  nama: string;
  data: number[];
}

export interface NilaiTrafikUsia {
  label: string;
  penuh?: string;
  persen: number;
  jumlah?: number;
}

export interface NilaiTrafikHalaman {
  path: string;
  persen: number;
  delta?: number;
}

export interface NilaiTrafikPerangkat {
  nama: string;
  persen: number;
  jumlah?: number;
}

export interface NilaiTrafikPerilaku {
  nama: string;
  persen: number;
}

export interface NilaiTrafikOs {
  nama: string;
  persen: number;
  delta?: number;
  seri?: number[];
}

export interface NilaiTrafikFrasa {
  teks: string;
  persen: number;
}

export interface NilaiTrafik {
  /** Sampai 5 kartu KPI, urut seperti kartu template. */
  kpi?: NilaiTrafikKpi[];
  /** Batang bertumpuk "Sumber Trafik": label sumbu + seri dari dokumen. */
  sumber?: { label: string[]; seri: NilaiTrafikSeri[] };
  sumberJudul?: string;
  relevansiJudul?: string;
  perangkatJudul?: string;
  /** Garis "Dinamika Relevansi". */
  relevansi?: { label?: string[]; data: number[] };
  usia?: NilaiTrafikUsia[];
  usiaTotal?: string;
  usiaDelta?: number;
  halaman?: NilaiTrafikHalaman[];
  perangkat?: NilaiTrafikPerangkat[];
  perangkatTotal?: string;
  perilaku?: NilaiTrafikPerilaku[];
  os?: NilaiTrafikOs[];
  frasa?: NilaiTrafikFrasa[];
}

/** Akhiran satuan KPI mengikuti gaya template ("%", " mnt", atau kosong). */
const akhiranSatuan = (satuan?: string): string => {
  const s = teks(satuan).trim().toLowerCase();
  if (!s) return '';
  if (s === '%' || s === 'persen' || s === 'percent') return '%';
  if (/^(menit|mnt|min|minute|minutes)$/.test(s)) return ' mnt';
  if (/^(detik|dtk|sec|second|seconds)$/.test(s)) return ' dtk';
  return '';
};

/** Angka KPI + satuan yang aman: persen tetap persen, angka polos diberi akhiran. */
const nilaiKpiTrafik = (v: unknown, satuan?: string): string => {
  const rapi = rapiAngka(v).trim();
  if (!rapi) return '';
  // Sudah membawa satuannya sendiri ("57%", "4,9 menit") → pakai apa adanya.
  if (!/^[-+]?[\d.,]+$/.test(rapi)) return rapi;
  return `${rapi}${akhiranSatuan(satuan)}`;
};

/**
 * Ubah widget hasil pengisian dokumen menjadi nilai untuk slot template T3.
 * Kartu ber-`dataKosong` diabaikan; slot tanpa sumber tetap kosong.
 */
export function nilaiTrafikDariWidgets(widgets: WidgetSpec[] | undefined | null): NilaiTrafik {
  const daftar = (Array.isArray(widgets) ? widgets : []).filter((w) => w && !w.dataKosong);
  const hasil: NilaiTrafik = {};
  const judul = (w: WidgetSpec) => teks(w.title).toLowerCase();
  const bergrafik = daftar.filter((w) => Array.isArray(w.chart?.series) && w.chart!.series.length > 0);
  /** Judul kartu dari nama seri dokumen (isinya sering beda dari judul template). */
  const judulSeri = (w?: WidgetSpec): string | undefined => {
    const nama = (w?.chart?.series || [])
      .map((sr) => teks(sr?.name))
      .filter(Boolean)
      .join(' vs ');
    if (!nama) return undefined;
    return nama.replace(/\s*\([^)]*\)\s*$/, '').trim() || undefined;
  };

  // ── 5 KPI bersparkline ─────────────────────────────────────────────────────
  const kpi = daftar.filter((w) => w.type === 'kpi').slice(0, 5);
  if (kpi.length) {
    hasil.kpi = kpi.map((w) => {
      const mentah = w.kpi?.delta;
      const d = typeof mentah === 'number' && Number.isFinite(mentah) ? mentah : undefined;
      const seri = (w.kpi?.sparkline || []).map((x) => angka(x)).filter((x) => Number.isFinite(x));
      return {
        label: teks(w.title),
        nilai: nilaiKpiTrafik(w.kpi?.value, w.kpi?.unit),
        delta: d,
        // Sparkline hanya bila dokumen menyertakan deretnya — tidak dikarang.
        seri: seri.length >= 2 ? seri : undefined,
      };
    });
  }

  // Total kunjungan dokumen — dipakai menurunkan jumlah per perangkat.
  const kpiPengunjung = kpi.find(
    (w) => /pengunjung|visitor|pengguna/i.test(judul(w)) && !/baru|new/i.test(judul(w)),
  );
  const totalKunjungan = kpiPengunjung ? angka(kpiPengunjung.kpi?.value) : 0;

  // ── Batang bertumpuk "Sumber Trafik" ──────────────────────────────────────
  const wSumber = bergrafik.find((w) => w.type === 'bar' || w.type === 'hbar');
  if (wSumber?.chart) {
    const label = (wSumber.chart.xAxis || []).map((x) => teks(x));
    const seri = (wSumber.chart.series || [])
      .map((s) => ({ nama: teks(s.name), data: (s.data || []).map((x) => angka(x)) }))
      .filter((s) => s.data.length > 0);
    if (seri.length) {
      hasil.sumber = { label, seri };
      hasil.sumberJudul = judulSeri(wSumber) || teks(wSumber.title);
    }
  }

  // ── Garis "Dinamika Relevansi" ────────────────────────────────────────────
  const wRelevansi = bergrafik.find((w) => w.type === 'line' || w.type === 'area');
  if (wRelevansi?.chart) {
    const seri = wRelevansi.chart.series[wRelevansi.chart.series.length - 1];
    const data = (seri?.data || []).map((x) => angka(x));
    if (data.length) {
      const sumbu = (wRelevansi.chart.xAxis || []).map((x) => teks(x));
      hasil.relevansi = { data, label: sumbu.length === data.length ? sumbu : undefined };
      hasil.relevansiJudul = judulSeri(wRelevansi) || teks(wRelevansi.title);
    }
  }

  // ── Donut "Jenis Perangkat" ───────────────────────────────────────────────
  const donat = bergrafik.find((w) => w.type === 'donut' || w.type === 'pie');
  if (donat?.chart) {
    const nama = (donat.chart.xAxis || []).map((x) => teks(x));
    const nilai = (donat.chart.series[0]?.data || []).map((x) => angka(x));
    const total = nilai.reduce((a, b) => a + b, 0);
    // Donut dokumen bisa berisi persen (69,7 / 29 / 1,3) atau jumlah kunjungan.
    const sudahPersen = teks(donat.chart.unit).trim() === '%' || (total > 0 && Math.abs(total - 100) <= 1);
    const isi = nama
      .map((n, i) => ({
        nama: n,
        persen: sudahPersen ? nilai[i] ?? 0 : total > 0 ? Math.round(((nilai[i] ?? 0) / total) * 1000) / 10 : 0,
      }))
      .filter((x) => x.nama && x.persen > 0);
    if (isi.length) {
      hasil.perangkat = isi.map((x) => ({
        ...x,
        // Jumlah kunjungan hanya bila totalnya memang ada di dokumen.
        jumlah: totalKunjungan > 0 ? Math.round((x.persen / 100) * totalKunjungan) : undefined,
      }));
      if (totalKunjungan > 0) hasil.perangkatTotal = new Intl.NumberFormat('id-ID').format(totalKunjungan);
      hasil.perangkatJudul = judulSeri(donat) || teks(donat.title);
    }
  }

  // ── Tabel "Halaman Populer" (hanya bila kartunya memang daftar halaman) ────
  const tabel = daftar.find((w) => w.type === 'table' && Array.isArray(w.table?.rows) && w.table!.rows.length > 0);
  if (tabel?.table) {
    const kolom = tabel.table.columns || [];
    const kNama = kolom[0]?.key;
    const kAngka =
      kolom.find((k) => /persen|porsi|kunjungan|jumlah|nilai/i.test(k.label))?.key ?? kolom[1]?.key;
    const kDelta = kolom.find((k) => /delta|perubahan|tren/i.test(k.label))?.key;
    const baris = (tabel.table.rows || [])
      .slice(0, 10)
      .map((r: any) => ({
        path: teks(r?.[kNama as string]),
        nilai: angka(r?.[kAngka as string]),
        delta: kDelta ? angka(r?.[kDelta as string]) : undefined,
      }))
      .filter((x) => x.path && x.nilai > 0);
    const berupaHalaman = /halaman|page|url|path/i.test(judul(tabel)) || baris.some((x) => x.path.startsWith('/'));
    if (berupaHalaman && baris.length) {
      const total = baris.reduce((a, b) => a + b.nilai, 0);
      // Kolom bisa berisi persen (40,3) atau jumlah kunjungan (403).
      const persen = total <= 100.5;
      hasil.halaman = baris.map((x) => ({
        path: x.path,
        persen: persen ? Math.round(x.nilai * 10) / 10 : Math.round((x.nilai / total) * 1000) / 10,
        delta: x.delta,
      }));
    }
  }

  return hasil;
}
