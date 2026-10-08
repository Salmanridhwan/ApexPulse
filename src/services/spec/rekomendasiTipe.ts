import { WidgetType } from '../../types';
import { SYARAT_TITIK_ANALITIK } from './tipeSelaras';

/**
 * Rekomendasi pemakaian tiap tipe visualisasi.
 *
 * Dipakai halaman "Template Chart" di sidebar: menjelaskan chart ini menjawab
 * pertanyaan apa, kapan dipakai, kapan JANGAN dipakai, dan contoh indikator BUMD
 * yang cocok. Batas "kapan jangan dipakai" mengikuti aturan mesin yang benar-benar
 * dipakai aplikasi (SYARAT_TITIK_ANALITIK + syarat bentuk data), bukan karangan.
 */
export interface RekomendasiTipe {
  /** Pertanyaan yang dijawab chart ini. */
  menjawab: string;
  /** Kapan tipe ini tepat dipakai. */
  pakai: string[];
  /** Kapan sebaiknya tidak dipakai (batas data / salah pilih bentuk). */
  hindari: string;
  /** Contoh indikator BUMD yang cocok. */
  contoh: string;
}

/** Syarat minimal jumlah titik data pada deret dokumen untuk tipe analitik. */
const titik = (t: WidgetType): number => SYARAT_TITIK_ANALITIK[t] ?? 3;

export const REKOMENDASI_TIPE: Record<WidgetType, RekomendasiTipe> = {
  // ================= KARTU & TEKS =================
  kpi: {
    menjawab: 'Berapa nilainya sekarang, dan naik atau turun dibanding periode lalu?',
    pakai: [
      'Satu metrik kunci yang jadi perhatian pimpinan (tidak lebih dari 2-3 kartu di satu baris).',
      'Butuh perbandingan terhadap target atau periode sebelumnya.',
    ],
    hindari: 'Jangan dipakai untuk membandingkan banyak kategori — pakai diagram kolom atau batang horizontal.',
    contoh: 'Pendapatan usaha, NRW (%), jumlah pelanggan aktif, cakupan layanan (%).',
  },
  'bullet-target': {
    menjawab: 'Sudah seberapa jauh capaian dibanding target?',
    pakai: [
      'Satu indikator dengan target resmi yang jelas (RKAP/KPI kontrak manajemen).',
      'Perlu terlihat sekaligus: aktual, target, dan ambang batasnya.',
    ],
    hindari: 'Kalau target tidak ada di dokumen, jangan paksakan — angka target tidak boleh dikarang.',
    contoh: 'Realisasi pendapatan vs target RKAP, volume produksi vs target.',
  },
  gauge: {
    menjawab: 'Berapa persen pencapaian pada skala tertentu?',
    pakai: [
      'Indikator berskala 0-100% yang mudah dibaca sekilas.',
      'Indikator mutu pelayanan atau tingkat pemanfaatan kapasitas.',
    ],
    hindari: 'Tidak cocok untuk nilai yang bisa melewati 100% tanpa konteks, atau untuk deret waktu.',
    contoh: 'Tingkat kepatuhan SOP (%), pemanfaatan kapasitas instalasi (%).',
  },
  table: {
    menjawab: 'Apa angka tepatnya, per baris dan per kolom?',
    pakai: [
      'Data yang perlu dibaca persis (bukan sekadar pola), apalagi kalau audiens akan mengutip angkanya.',
      'Detail pendukung di balik satu angka ringkasan.',
    ],
    hindari: 'Jangan taruh tabel besar sebagai isi utama dashboard — pimpinan membaca pola lebih dulu.',
    contoh: 'Rincian pendapatan per unit kerja, rekap gangguan per kecamatan.',
  },
  narasi: {
    menjawab: 'Apa kesimpulan pentingnya, dan kenapa itu penting?',
    pakai: [
      'Menutup dashboard dengan temuan pokok dan tindak lanjut yang disarankan.',
      'Menjelaskan hubungan antar-indikator yang tidak terbaca dari satu chart.',
    ],
    hindari: 'Narasi tidak boleh memuat angka yang tidak ada di dokumen — harus bisa dirujuk ke sumbernya.',
    contoh: 'Ringkasan kinerja triwulan, catatan penyebab kenaikan NRW.',
  },

  // ================= KARTESIUS =================
  line: {
    menjawab: 'Bagaimana kecenderungannya dari waktu ke waktu?',
    pakai: [
      'Deret waktu berurutan (bulan, triwulan, tahun) dengan satu sampai tiga seri.',
      'Melihat perubahan arah: naik, datar, atau menurun.',
    ],
    hindari: 'Jangan pakai untuk kategori yang tidak berurutan (mis. nama unit kerja) — pakai kolom.',
    contoh: 'Volume air terjual per bulan 2025, NRW bulanan.',
  },
  area: {
    menjawab: 'Seberapa besar totalnya sekaligus bagaimana trennya?',
    pakai: [
      'Tren deret waktu yang sekaligus ingin ditekankan besaran volumenya.',
      'Beberapa komponen yang jumlahnya membentuk total.',
    ],
    hindari: 'Kalau ada lebih dari 3 seri bertumpuk, area mudah menyesatkan — pakai garis atau kolom bertumpuk.',
    contoh: 'Akumulasi volume produksi air per bulan, komposisi pemakaian per kelompok pelanggan.',
  },
  bar: {
    menjawab: 'Kategori mana yang paling besar dan paling kecil?',
    pakai: [
      'Membandingkan nilai antar kategori (unit kerja, wilayah, jenis layanan).',
      'Umumnya 3 sampai 12 kategori.',
    ],
    hindari: 'Jangan dipakai untuk deret waktu rapat (mis. 36 bulan) — pakai garis.',
    contoh: 'Pendapatan per unit kerja, jumlah gangguan per jenis.',
  },
  hbar: {
    menjawab: 'Kategori mana yang teratas, kalau namanya panjang-panjang?',
    pakai: [
      'Sama seperti diagram kolom, tapi label kategori panjang sehingga lebih terbaca mendatar.',
      'Peringkat (ranking) dari yang terbesar ke terkecil.',
    ],
    hindari: 'Hindari lebih dari sekitar 15 baris — potong ke kategori terpenting saja.',
    contoh: 'Peringkat cabang menurut jumlah pelanggan, 10 keluhan terbanyak.',
  },
  combo: {
    menjawab: 'Bagaimana hubungan dua metrik dengan satuan berbeda?',
    pakai: [
      'Dua metrik berbeda satuan (mis. volume dalam m3 dan persentase dalam %).',
      'Ingin melihat apakah kenaikan satu metrik diikuti perubahan metrik lain.',
    ],
    hindari: 'Maksimal dua sumbu. Tiga metrik satu sumbu sekunder membuat grafik sulit dibaca.',
    contoh: 'Volume air terjual (m3) dengan persentase NRW (%), pendapatan dengan jumlah pelanggan.',
  },
  waterfall: {
    menjawab: 'Faktor apa saja yang membuat nilai berubah dari awal ke akhir?',
    pakai: [
      'Menjelaskan selisih: dari posisi awal menuju posisi akhir lewat serangkaian penambahan dan pengurangan.',
      'Membedah penyebab naik atau turunnya satu indikator.',
    ],
    hindari: 'Bukan untuk deret waktu rutin — itu tugas diagram garis.',
    contoh: 'Dari laba tahun lalu ke laba tahun ini: kenaikan pendapatan, kenaikan beban, selisih kurs.',
  },

  // ================= KOMPOSISI =================
  pie: {
    menjawab: 'Bagaimana komposisi keseluruhan terbagi?',
    pakai: ['Proporsi satu total yang terbagi habis (100%), dengan maksimal sekitar 5 potong.'],
    hindari: 'Jangan dipakai untuk lebih dari 5-6 kategori, dan jangan untuk membandingkan dua periode sekaligus.',
    contoh: 'Komposisi sumber air baku, pangsa pelanggan per golongan tarif.',
  },
  donut: {
    menjawab: 'Sama seperti pai: bagaimana komposisinya?',
    pakai: [
      'Komposisi dengan ruang tengah untuk menaruh angka total.',
      'Alternatif pai yang biasanya lebih enak dibaca saat potongannya sedikit.',
    ],
    hindari: 'Sama seperti pai: hindari banyak kategori atau perbandingan antar periode.',
    contoh: 'Struktur biaya operasional, komposisi piutang menurut umur.',
  },
  treemap: {
    menjawab: 'Bagian mana yang paling besar porsinya, kalau kategorinya banyak?',
    pakai: [
      'Komposisi dengan banyak kategori yang masih ingin ditampilkan semuanya.',
      'Melihat hierarki: kotak besar berisi kotak-kotak kecil.',
    ],
    hindari: 'Angka di dalam kotak kecil sulit dibaca; kalau hanya 4-5 kategori, pakai pai atau kolom.',
    contoh: 'Komposisi belanja per kelompok anggaran, sebaran aset per kategori.',
  },
  funnel: {
    menjawab: 'Di tahap mana prosesnya menyusut?',
    pakai: [
      'Proses bertahap yang jumlahnya mengecil tiap tahap (tahapan layanan, tahapan penyelesaian keluhan).',
      'Melihat tahap dengan kebocoran terbesar.',
    ],
    hindari: 'Bukan untuk data yang naik-turun atau tidak berurutan tahap.',
    contoh: 'Aduan masuk, diverifikasi, dikerjakan, selesai, ditutup.',
  },
  sankey: {
    menjawab: 'Ke mana saja aliran itu bergerak antar kategori?',
    pakai: [
      'Perpindahan volume atau nilai dari satu kelompok ke kelompok lain.',
      'Data dokumen yang memang memuat hubungan antar-kategori (pasangan sumber-tujuan).',
    ],
    hindari: 'Butuh data relasi antar-kategori. Kalau dokumen hanya memuat satu daftar kategori, tampilan ini tidak bisa dibuat.',
    contoh: 'Aliran air dari sumber ke wilayah layanan, alokasi anggaran dari pos ke kegiatan.',
  },

  // ================= SEBARAN =================
  scatter: {
    menjawab: 'Apakah dua variabel bergerak searah, dan adakah yang menyimpang?',
    pakai: [
      'Melihat hubungan antara dua besaran pada banyak titik pengamatan.',
      'Menemukan titik yang jauh dari pola umum (outlier).',
    ],
    hindari: 'Tidak cocok untuk deret waktu berurutan; gunakan garis.',
    contoh: 'Hubungan angka kehilangan air dengan umur jaringan per zona, hubungan tarif dengan pemakaian.',
  },
  bubble: {
    menjawab: 'Selain hubungannya, mana yang paling berdampak?',
    pakai: [
      'Seperti scatter, tapi setiap titik punya ukuran ketiga (mis. jumlah pelanggan).',
      'Membandingkan tiga besaran sekaligus dalam satu pandangan.',
    ],
    hindari: 'Ukuran gelembung adalah kesan visual, bukan angka presisi — jangan jadikan satu-satunya sumber pembacaan.',
    contoh: 'Unit kerja: pemakaian (x), kebocoran (y), jumlah pelanggan (besar gelembung).',
  },
  histogram: {
    menjawab: 'Bagaimana sebaran frekuensinya, dan di mana nilai terbanyak?',
    pakai: [
      'Melihat bentuk sebaran satu variabel: memusat, melebar, atau miring.',
      'Menilai konsentrasi pada rentang nilai tertentu.',
    ],
    hindari: 'Untuk jumlah data yang sangat sedikit, bentuk sebaran menyesatkan.',
    contoh: 'Sebaran umur jaringan pipa, sebaran waktu penyelesaian gangguan.',
  },
  boxplot: {
    menjawab: 'Seberapa seragam datanya, dan adakah nilai ekstrem?',
    pakai: [
      'Membandingkan sebaran antar kelompok: median, rentang, dan pencilan.',
      'Menilai konsistensi kinerja antar unit kerja.',
    ],
    hindari: 'Tidak cocok untuk data kurang dari sekitar 8-10 pengamatan per kelompok.',
    contoh: 'Sebaran NRW antar cabang, konsistensi waktu tanggap penanganan gangguan.',
  },

  // ================= MATRIKS & GEOMETRI =================
  heatmap: {
    menjawab: 'Di kombinasi mana intensitasnya paling tinggi?',
    pakai: [
      'Dua dimensi sekaligus, mis. wilayah versus bulan.',
      'Mencari pola terang-gelap: titik yang paling padat atau paling kosong.',
    ],
    hindari: 'Membutuhkan sel dengan intensitas yang benar-benar berbeda secara signifikan untuk terlihat polanya.',
    contoh: 'Gangguan per wilayah per bulan, jam puncak pemakaian air per hari.',
  },
  radar: {
    menjawab: 'Bagaimana profil satu unit dibanding beberapa indikator sekaligus?',
    pakai: [
      'Membandingkan profil beberapa indikator pada skala bersamaan (mis. mutu layanan).',
      'Membandingkan dua-tiga unit kerja pada indikator yang sama.',
    ],
    hindari: 'Lebih dari 3 objek sekaligus, atau indikator lebih dari 8, membuat gambar sulit dibaca.',
    contoh: 'Profil layanan cabang: cakupan, tekanan, kontinuitas, kualitas, keluhan.',
  },
  map: {
    menjawab: 'Bagaimana nilai itu tersebar menurut wilayah?',
    pakai: [
      'Hanya bila dokumen memang memuat rincian per wilayah/provinsi.',
      'Membandingkan capaian antar wilayah layanan atau antar daerah kerja.',
    ],
    hindari: 'Kalau dokumen hanya memuat angka tingkat instansi (bukan per wilayah), peta tidak bisa dibuat — dan angka per wilayah tidak boleh dikarang.',
    contoh: 'NRW per kota/kabupaten, jumlah pelanggan per provinsi.',
  },

  // ================= LAINNYA =================
  gantt: {
    menjawab: 'Apa saja kegiatan yang berjalan, dan kapan selesainya?',
    pakai: [
      'Jadwal program atau proyek: mulai, durasi, dan tumpang tindih antar kegiatan.',
      'Memantau tahapan pekerjaan terhadap garis waktu.',
    ],
    hindari: 'Bukan untuk data kinerja angka; pakai KPI atau tren bila yang dibahas capaian, bukan jadwal.',
    contoh: 'Jadwal perbaikan jaringan, tahapan pembangunan instalasi.',
  },

  // ================= ANALITIK PREDIKTIF =================
  'trend-line': {
    menjawab: 'Ke arah mana datanya bergerak, dan seberapa kuat kecenderungan itu?',
    pakai: [
      'Menegaskan arah tren deret waktu, sekaligus menampilkan kemiringan dan R² dari data dokumen.',
      'Melihat apakah kenaikan atau penurunan konsisten atau hanya kebetulan.',
    ],
    hindari: `Butuh minimal ${titik('trend-line')} titik data. Kecenderungan tidak boleh dipakai untuk mengklaim sebab-akibat.`,
    contoh: 'Tren NRW 12 bulan, kecenderungan jumlah pelanggan baru per bulan.',
  },
  forecast: {
    menjawab: 'Berapa kemungkinan nilainya di periode berikutnya?',
    pakai: [
      'Proyeksi periode berikutnya beserta rentang kemungkinannya (pita prediksi), dihitung dari laju data dokumen.',
      'Dasar perencanaan: menyiapkan anggaran atau kapasitas berdasarkan arah data yang ada.',
    ],
    hindari: `Butuh minimal ${titik('forecast')} titik data dan selalu ditandai putus-putus: ini proyeksi, bukan realisasi. Jangan kutip sebagai angka pasti.`,
    contoh: 'Perkiraan pendapatan triwulan depan, perkiraan volume air terjual bulan depan.',
  },
  anomaly: {
    menjawab: 'Nilai mana yang menyimpang dari kebiasaan?',
    pakai: [
      'Menandai titik yang menyimpang jauh (z-score) untuk diperiksa lebih lanjut.',
      'Menemukan bulan atau unit kerja yang perlu penjelasan tambahan.',
    ],
    hindari: `Butuh minimal ${titik('anomaly')} titik data. Anomali adalah sinyal untuk diperiksa, bukan bukti kesalahan.`,
    contoh: 'Lonjakan kehilangan air di bulan tertentu, penurunan pendapatan yang tidak wajar.',
  },
  cluster: {
    menjawab: 'Kelompok mana yang serupa dan mana yang berbeda?',
    pakai: [
      'Mengelompokkan nilai yang berdekatan supaya terlihat tingkatan (rendah, sedang, tinggi).',
      'Menyusun prioritas penanganan berdasarkan pengelompokan, bukan perasaan.',
    ],
    hindari: `Butuh minimal ${titik('cluster')} titik data. Jumlah kelompok dihitung dari data, jadi hasilnya bisa berbeda bila datanya ditambah.`,
    contoh: 'Pengelompokan zona menurut tingkat kebocoran, pengelompokan cabang menurut kinerja.',
  },

  // ================= ANALITIK PRESKRIPTIF =================
  dekomposisi: {
    menjawab: 'Kategori mana yang paling menyumbang perubahan?',
    pakai: [
      'Membagi total perubahan menjadi andil tiap kategori, sehingga terlihat penyumbang terbesar.',
      'Memutuskan prioritas: kategori mana yang paling menentukan kenaikan atau penurunan.',
    ],
    hindari: `Butuh minimal ${titik('dekomposisi')} titik data. Andil dihitung dari perubahan pada data dokumen, bukan taksiran.`,
    contoh: 'Siapa penyumbang utama kenaikan biaya operasional, penyumbang utama penurunan pendapatan.',
  },
  skenario: {
    menjawab: 'Bagaimana hasilnya kalau keadaannya pesimis, dasar, atau optimis?',
    pakai: [
      'Menampilkan tiga kemungkinan (pesimis, dasar, optimis) dari laju data yang ada.',
      'Bahan pengambilan keputusan saat menyusun target atau anggaran.',
    ],
    hindari: `Semua angkanya ditandai SIMULASI. Butuh minimal ${titik('skenario')} titik data, dan tidak boleh dilaporkan sebagai angka realisasi.`,
    contoh: 'Simulasi pendapatan pada tiga skenario pertumbuhan pelanggan.',
  },
  sensitivitas: {
    menjawab: 'Kalau satu nilai diubah, seberapa besar pengaruhnya ke hasil?',
    pakai: [
      'Melihat seberapa peka hasil terhadap perubahan satu faktor utama.',
      'Menentukan faktor mana yang paling layak dijaga atau diperbaiki lebih dulu.',
    ],
    hindari: `Butuh minimal ${titik('sensitivitas')} titik data. Hasilnya simulasi, bukan janji capaian.`,
    contoh: 'Dampak kenaikan tarif terhadap pendapatan, dampak penurunan kehilangan air terhadap margin.',
  },
};

/** Kelompok tipe (mengikuti urutan tampil di galeri). */
export const URUTAN_GRUP_GALERI = [
  'Kartu', 'Kartesius', 'Komposisi', 'Sebaran', 'Matriks', 'Prediktif', 'Preskriptif', 'Lainnya',
] as const;

/** Terjemahan kelompok untuk judul di galeri. */
export const LABEL_GRUP: Record<string, string> = {
  Kartu: 'Kartu & teks ringkas',
  Kartesius: 'Tren, perbandingan, dan komposisi deret',
  Komposisi: 'Bagian dari keseluruhan',
  Sebaran: 'Hubungan dan sebaran data',
  Matriks: 'Pola, profil, dan wilayah',
  Prediktif: 'Analitik prediktif — apa yang mungkin terjadi',
  Preskriptif: 'Analitik preskriptif — apa yang sebaiknya dilakukan',
  Lainnya: 'Jadwal dan lainnya',
};

/** Satu kalimat ringkas: tipe ini menjawab apa. */
export function ringkasRekomendasi(type: WidgetType): string {
  return REKOMENDASI_TIPE[type]?.menjawab ?? '';
}
