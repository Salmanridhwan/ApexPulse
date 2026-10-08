/**
 * Analitik prediktif & preskriptif — SEMUA dihitung dari angka dokumen.
 *
 * Aturan yang tidak boleh dilanggar: fungsi di berkas ini tidak pernah mengarang
 * angka. Kalau data tidak cukup, kembalikan `null` / penanda "tidak cukup" supaya
 * pemanggil bisa menolak tipe itu dengan alasan (lihat `tipeSelaras.ts`).
 *
 * Setiap hasil menyertakan `metode` — dipakai sebagai label di grafik supaya
 * pembaca tahu angkanya hasil hitungan apa, bukan angka dokumen langsung.
 */

export interface Titik {
  x: number;
  y: number;
}

/** Regresi linier kuadrat terkecil: y = a + b·x (x = indeks 0..n-1). */
export interface HasilRegresi {
  a: number;
  b: number;
  /** Koefisien determinasi 0..1 — seberapa cocok garis dengan datanya. */
  r2: number;
  n: number;
  /** Simpangan baku residual (standard error). */
  se: number;
  rataX: number;
  /** Σ(x-x̄)² — dipakai menghitung pita prediksi. */
  sxx: number;
  /** nilai y pada x tertentu. */
  nilai: (x: number) => number;
  metode: string;
}

export function regresiLinier(y: number[]): HasilRegresi | null {
  const n = y?.length ?? 0;
  if (n < 3) return null;
  const rataX = (n - 1) / 2;
  const rataY = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  y.forEach((v, i) => {
    sxy += (i - rataX) * (v - rataY);
    sxx += (i - rataX) ** 2;
  });
  if (sxx === 0) return null;
  const b = sxy / sxx;
  const a = rataY - b * rataX;
  const nilai = (x: number) => a + b * x;
  let sse = 0;
  let sst = 0;
  y.forEach((v, i) => {
    sse += (v - nilai(i)) ** 2;
    sst += (v - rataY) ** 2;
  });
  const r2 = sst === 0 ? 1 : Math.max(0, 1 - sse / sst);
  const se = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  return {
    a,
    b,
    r2,
    n,
    se,
    rataX,
    sxx,
    nilai,
    metode: `Regresi linier kuadrat terkecil dari ${n} titik data dokumen`,
  };
}

/** Satu angka diringkas jadi teks gaya Indonesia. */
export function angka(v: number, desimal = 1): string {
  return v.toLocaleString('id-ID', { maximumFractionDigits: desimal });
}

/** Persamaan garis untuk label: "y = 3,2x + 40,1". */
export function teksPersamaan(reg: HasilRegresi): string {
  const tanda = reg.b >= 0 ? '+' : '−';
  return `y = ${angka(reg.b, 2)}x ${tanda} ${angka(Math.abs(reg.a), 2)}`;
}

/**
 * Pita prediksi 95%: ŷ ± 1,96·se·√(1 + 1/n + (x−x̄)²/Sxx).
 * Ini rumus baku pita prediksi individu, bukan angka dokumen — karena itu
 * grafiknya wajib menyebut "pita prediksi".
 */
export function pitaPrediksi(reg: HasilRegresi, x: number): { bawah: number; atas: number } {
  const faktor = Math.sqrt(Math.max(0, 1 + 1 / reg.n + (x - reg.rataX) ** 2 / reg.sxx));
  const lebar = 1.96 * reg.se * faktor;
  const tengah = reg.nilai(x);
  return { bawah: tengah - lebar, atas: tengah + lebar };
}

export interface HasilProyeksi {
  /** Jumlah titik aktual (data dokumen). */
  n: number;
  /** Indeks pertama yang merupakan proyeksi. */
  mulaiProyeksi: number;
  /** Nilai aktual + proyeksi (panjang n + langkah). */
  nilai: number[];
  bawah: number[];
  atas: number[];
  reg: HasilRegresi;
  arah: 'naik' | 'turun' | 'datar';
  metode: string;
}

/**
 * Proyeksi `langkah` titik berikutnya dengan regresi linier + pita prediksi.
 * Titik aktual dikembalikan apa adanya (tidak dihaluskan).
 */
export function proyeksi(y: number[], langkah = 3): HasilProyeksi | null {
  const reg = regresiLinier(y);
  // Minimal 4 titik: dengan 3 titik sisa derajat kebebasan hanya 1, sehingga pita
  // prediksinya tidak bermakna. Syarat ini sengaja di sini (bukan hanya di UI)
  // supaya tidak ada dua tempat yang bisa berbeda pendapat.
  if (!reg || langkah < 1 || (y?.length ?? 0) < 4) return null;
  const n = y.length;
  const nilai = [...y];
  const bawah: number[] = [...y];
  const atas: number[] = [...y];
  for (let k = 1; k <= langkah; k++) {
    const x = n - 1 + k;
    const yhat = reg.nilai(x);
    const pita = pitaPrediksi(reg, x);
    nilai.push(yhat);
    // Pita hanya digambar di bagian proyeksi; bagian aktual diisi nilai aktual
    // supaya area pita tidak menutupi data dokumen.
    bawah.push(pita.bawah);
    atas.push(pita.atas);
  }
  const arah = Math.abs(reg.b) < Math.max(1e-9, Math.abs(reg.nilai(0)) * 0.002)
    ? 'datar'
    : reg.b > 0
      ? 'naik'
      : 'turun';
  return {
    n,
    mulaiProyeksi: n - 1,
    nilai,
    bawah,
    atas,
    reg,
    arah,
    metode: `Proyeksi linier ${langkah} periode dari ${n} titik data dokumen (pita prediksi 95%)`,
  };
}

export interface HasilAnomali {
  /** Indeks titik yang menyimpang. */
  indeks: number[];
  /** z-score tiap titik (urut sesuai data). */
  z: number[];
  rata: number;
  simpangan: number;
  ambang: number;
  metode: string;
}

/** Deteksi titik menyimpang dengan z-score (|z| > 2,5). Butuh ≥ 5 titik. */
export function deteksiAnomali(y: number[], ambang = 2.5): HasilAnomali | null {
  const n = y?.length ?? 0;
  if (n < 5) return null;
  const rata = y.reduce((a, b) => a + b, 0) / n;
  const varians = y.reduce((a, b) => a + (b - rata) ** 2, 0) / (n - 1);
  const simpangan = Math.sqrt(varians);
  if (simpangan === 0) {
    return { indeks: [], z: y.map(() => 0), rata, simpangan, ambang, metode: `Semua ${n} nilai dokumen seragam (tidak ada yang menyimpang)` };
  }
  const z = y.map((v) => (v - rata) / simpangan);
  const indeks = z.map((v, i) => (Math.abs(v) > ambang ? i : -1)).filter((i) => i >= 0);
  return {
    indeks,
    z,
    rata,
    simpangan,
    ambang,
    metode: indeks.length
      ? `Deteksi simpangan z-score (|z| > ${ambang}) dari ${n} nilai dokumen: ${indeks.length} titik menyimpang`
      : `Deteksi simpangan z-score (|z| > ${ambang}) dari ${n} nilai dokumen: tidak ada yang menyimpang`,
  };
}

export interface HasilKlaster {
  /** Nomor klaster per titik (0..k-1, urut naik menurut centroid). */
  label: number[];
  /** Nilai tengah tiap klaster, urut menaik. */
  centroid: number[];
  k: number;
  metode: string;
}

/**
 * k-means 1 dimensi, inisialisasi kuantil (deterministik supaya hasil uji stabil).
 * Butuh ≥ 6 titik dan minimal 3 nilai berbeda.
 */
export function klaster1D(y: number[], kDiminta = 3): HasilKlaster | null {
  const n = y?.length ?? 0;
  if (n < 6) return null;
  const unik = [...new Set(y)].sort((a, b) => a - b);
  const k = Math.max(2, Math.min(kDiminta, unik.length));
  if (unik.length < 3) return null;

  // Inisialisasi: bagi data terurut jadi k bagian, ambil rata-rata tiap bagian.
  const urut = [...y].sort((a, b) => a - b);
  let centroid = Array.from({ length: k }, (_, i) => {
    const mulai = Math.floor((i * urut.length) / k);
    const akhir = Math.floor(((i + 1) * urut.length) / k);
    const bagian = urut.slice(mulai, Math.max(akhir, mulai + 1));
    return bagian.reduce((a, b) => a + b, 0) / bagian.length;
  });

  let label = y.map(() => 0);
  for (let iterasi = 0; iterasi < 50; iterasi++) {
    const baru = y.map((v) => {
      let terdekat = 0;
      let jarak = Infinity;
      centroid.forEach((c, i) => {
        const d = Math.abs(v - c);
        if (d < jarak) {
          jarak = d;
          terdekat = i;
        }
      });
      return terdekat;
    });
    const sama = baru.every((v, i) => v === label[i]);
    label = baru;
    const berikut = centroid.map((c, i) => {
      const anggota = y.filter((_, idx) => label[idx] === i);
      return anggota.length ? anggota.reduce((a, b) => a + b, 0) / anggota.length : c;
    });
    centroid = berikut;
    if (sama) break;
  }

  // Urutkan klaster menaik supaya warnanya konsisten (klaster 0 = terendah).
  const urutan = centroid.map((c, i) => ({ c, i })).sort((a, b) => a.c - b.c);
  const peta = new Map<number, number>();
  urutan.forEach((u, baru) => peta.set(u.i, baru));
  const labelBaru = label.map((l) => peta.get(l) ?? l);
  return {
    label: labelBaru,
    centroid: urutan.map((u) => u.c),
    k,
    metode: `Pengelompokan k-means (k=${k}) dari ${n} nilai dokumen`,
  };
}

export interface HasilDekomposisi {
  total: number;
  bagian: Array<{ indeks: number; nilai: number; porsi: number }>;
  /** Perubahan total antar titik pertama→terakhir (null kalau bukan deret). */
  perubahan: number;
  /** Kontribusi tiap bagian terhadap perubahan (sebagai selisih titik-ke-titik). */
  kontribusi: number[];
  metode: string;
}

/**
 * Dekomposisi kontribusi: seberapa besar tiap kategori menyusun total, dan
 * seberapa besar andil tiap langkah terhadap PERUBAHAN BERSIH (titik pertama →
 * terakhir). Ini definisi baku "contribution to change": jumlah semua andil = 100%,
 * dan langkah yang berlawanan arah memberi angka negatif (atau >100% bila
 * gerakan total kecil) — itu memang wajar, bukan kesalahan hitung.
 *
 * Kalau perubahan bersihnya nol, andil diukur terhadap total gerakan (kotor),
 * dan metodenya menyebut hal itu supaya tidak menyesatkan.
 */
export function dekomposisi(y: number[]): HasilDekomposisi | null {
  const n = y?.length ?? 0;
  if (n < 3) return null;
  const total = y.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const langkah = y.map((v, i) => (i === 0 ? 0 : v - y[i - 1]));
  const perubahan = y[n - 1] - y[0];
  const kotor = langkah.reduce((a, b) => a + Math.abs(b), 0);
  const dasar = perubahan !== 0 ? perubahan : kotor;
  return {
    total,
    bagian: y.map((v, i) => ({ indeks: i, nilai: v, porsi: (v / total) * 100 })),
    perubahan,
    kontribusi: dasar === 0 ? langkah : langkah.map((l) => (l / dasar) * 100),
    metode:
      `Dekomposisi kontribusi dari ${n} titik data dokumen — andil tiap langkah terhadap ` +
      `${perubahan !== 0 ? 'perubahan bersih (jumlah andil = 100%)' : 'total gerakan (perubahan bersih nol)'}`,
  };
}

export interface Skenario {
  nama: 'Pesimis' | 'Dasar' | 'Optimis';
  nilai: number;
  /** Faktor pengali yang dipakai (transparan, ditampilkan di grafik). */
  faktor: number;
}

/**
 * Tiga skenario dari laju pertumbuhan dokumen (rata-rata perubahan titik-ke-titik).
 * Jelas SIMULASI: rumusnya ditampilkan di grafik. Butuh ≥ 2 titik dan laju ≠ 0.
 */
export function skenario(y: number[]): { dasar: number; laju: number; daftar: Skenario[]; metode: string } | null {
  const n = y?.length ?? 0;
  if (n < 2) return null;
  const terakhir = y[n - 1];
  if (terakhir === 0) return null;
  const perubahan = y.map((v, i) => (i === 0 ? 0 : (v - y[i - 1]) / Math.abs(y[i - 1] || 1)));
  const laju = perubahan.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, n - 1);
  const daftar: Skenario[] = [
    { nama: 'Pesimis', faktor: 1 + laju * 0.5, nilai: terakhir * (1 + laju * 0.5) },
    { nama: 'Dasar', faktor: 1 + laju, nilai: terakhir * (1 + laju) },
    { nama: 'Optimis', faktor: 1 + laju * 1.5, nilai: terakhir * (1 + laju * 1.5) },
  ];
  return {
    dasar: terakhir,
    laju,
    daftar,
    metode: `SIMULASI dari laju perubahan dokumen (${angka(laju * 100, 2)}% per periode); bukan angka RKAP`,
  };
}

/** Kurva sensitivitas (what-if statis): nilai awal berubah sebesar rentang persen. */
export function sensitivitas(
  nilaiAwal: number,
  langkahPersen = 10
): { persen: number[]; nilai: number[]; metode: string } | null {
  if (!Number.isFinite(nilaiAwal) || nilaiAwal === 0) return null;
  const persen = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map((f) => f * langkahPersen);
  return {
    persen,
    nilai: persen.map((p) => nilaiAwal * (1 + p / 100)),
    metode: `Analisis sensitivitas (what-if statis) dari nilai dokumen ${angka(nilaiAwal, 2)}; rentang ±${langkahPersen * 2}%`,
  };
}
