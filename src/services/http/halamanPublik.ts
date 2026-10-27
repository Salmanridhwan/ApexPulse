/**
 * Halaman publik (tanpa login): paket & harga, serta syarat-ketentuan.
 *
 * ponytail: ini halaman marketing/legal yang harus bisa dibuka sebelum punya
 * akun. Menaruhnya di aplikasi React berarti menambah rute SPA + bundel untuk
 * sesuatu yang statis. Satu berkas HTML per halaman dari server sudah cukup,
 * dan tidak menambah dependensi.
 *
 * Harga SENGAJA tidak dicantumkan: penawaran BUMD berbeda per jumlah instansi,
 * pengguna, dan modul. Yang ditampilkan adalah isi paket + jalur kontak.
 */

export interface Kontak {
  email: string;
  whatsapp: string;
  situs: string;
}

export function konfigKontak(): Kontak {
  return {
    email: (process.env.KONTAK_EMAIL || 'kontak@aiones.app').trim(),
    whatsapp: (process.env.KONTAK_WHATSAPP || '').trim(),
    situs: (process.env.KONTAK_URL || 'https://aiones.app').trim(),
  };
}

const esc = (s: string): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const GAYA = `
  :root{--biru:#0b62c4;--biru-tua:#0a4a94;--tinta:#0f172a;--tinta2:#475569;--garis:#e2e8f0;--latar:#f6f8fc}
  *{box-sizing:border-box}
  body{margin:0;font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;color:var(--tinta);background:var(--latar);line-height:1.65}
  a{color:var(--biru);text-decoration:none}a:hover{text-decoration:underline}
  header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 28px;background:#fff;border-bottom:1px solid var(--garis)}
  header .merek{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.01em}
  header .merek img{height:28px;width:auto;display:block}
  header nav{display:flex;gap:18px;font-size:14px;font-weight:600}
  main{max-width:1060px;margin:0 auto;padding:44px 24px 72px}
  h1{font-size:clamp(26px,4vw,38px);line-height:1.2;margin:0 0 10px;letter-spacing:-.02em}
  .pembuka{color:var(--tinta2);font-size:16px;max-width:640px;margin:0 0 32px}
  .kisi{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
  .kartu{background:#fff;border:1px solid var(--garis);border-radius:16px;padding:22px;display:flex;flex-direction:column}
  .kartu.unggul{border-color:var(--biru);box-shadow:0 8px 24px rgba(11,98,196,.12)}
  .kartu h2{font-size:17px;margin:0 0 4px}
  .kartu .untuk{font-size:13px;color:var(--tinta2);margin:0 0 14px}
  .kartu ul{list-style:none;padding:0;margin:0 0 18px;font-size:14px}
  .kartu li{padding:5px 0 5px 22px;position:relative}
  .kartu li:before{content:"";position:absolute;left:2px;top:12px;width:8px;height:8px;border-radius:50%;background:var(--biru);opacity:.75}
  .kartu .harga{margin-top:auto;font-weight:800;font-size:15px;color:var(--biru-tua)}
  .tombol{display:inline-block;background:var(--biru);color:#fff;font-weight:700;padding:11px 18px;border-radius:10px;font-size:14px}
  .tombol:hover{background:var(--biru-tua);text-decoration:none}
  .tombol.garis{background:#fff;color:var(--biru);border:1px solid var(--biru)}
  section{margin-top:52px}
  section h2{font-size:20px;margin:0 0 14px}
  .langkah{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
  .langkah div{background:#fff;border:1px solid var(--garis);border-radius:14px;padding:18px;font-size:14px}
  .langkah b{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--biru);margin-bottom:6px}
  .sorot{background:#fff;border:1px solid var(--garis);border-radius:16px;padding:24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
  article{background:#fff;border:1px solid var(--garis);border-radius:16px;padding:26px}
  article h2{font-size:17px;margin:26px 0 8px}
  article h2:first-child{margin-top:0}
  article p,article li{font-size:14.5px;color:#1e293b}
  article ul{padding-left:20px}
  footer{border-top:1px solid var(--garis);background:#fff;padding:22px 28px;font-size:13px;color:var(--tinta2);display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between}
`;

function kerangka(judul: string, isi: string, kontak: Kontak): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(judul)} — Aiones Boards</title>
<style>${GAYA}</style></head><body>
<header>
  <div class="merek"><img src="/brand/logo-lockup.png" alt="Aiones Boards" width="109" height="28"></div>
  <nav>
    <a href="/paket">Paket</a>
    <a href="/syarat-ketentuan">Syarat &amp; ketentuan</a>
    <a href="/">Masuk</a>
  </nav>
</header>
<main>${isi}</main>
<footer>
  <span>© ${new Date().getFullYear()} Aiones. Seluruh hak dilindungi.</span>
  <span><a href="mailto:${esc(kontak.email)}">${esc(kontak.email)}</a> · <a href="${esc(kontak.situs)}">${esc(kontak.situs)}</a></span>
</footer>
</body></html>`;
}

/** Tautan kontak: WhatsApp bila diisi, kalau tidak email. */
function tautanKontak(kontak: Kontak, teks = 'Hubungi kami'): string {
  if (kontak.whatsapp) {
    const nomor = kontak.whatsapp.replace(/[^\d]/g, '');
    const pesan = encodeURIComponent('Halo, saya ingin menanyakan Aiones Boards untuk instansi kami.');
    return `<a class="tombol" href="https://wa.me/${nomor}?text=${pesan}">${esc(teks)}</a>`;
  }
  const subjek = encodeURIComponent('Permintaan penawaran Aiones Boards');
  return `<a class="tombol" href="mailto:${esc(kontak.email)}?subject=${subjek}">${esc(teks)}</a>`;
}

const PAKET = [
  {
    nama: 'Dasar',
    untuk: 'Satu instansi, tim kecil, fokus pemantauan kinerja',
    unggul: false,
    fitur: [
      'Dashboard interaktif & kanvas widget',
      'Asisten AI dari dokumen resmi instansi',
      'Manajemen berkas & basis dokumen',
      'Tautan bagikan (lihat saja / dengan PIN)',
      'Peran pengguna: admin & pengguna',
    ],
  },
  {
    nama: 'Profesional',
    untuk: 'Instansi dengan kebutuhan pelaporan & kepatuhan',
    unggul: true,
    fitur: [
      'Semua isi paket Dasar',
      'Perjanjian kinerja, LKjIP, dan pelaporan periodik',
      'Manajemen risiko, aset, dan tindak lanjut audit',
      'Peringatan otomatis & jejak audit lengkap',
      'Ekspor CSV/PDF dan mode presentasi',
    ],
  },
  {
    nama: 'Instansi / Grup',
    untuk: 'Holding, pemerintah daerah, atau beberapa instansi sekaligus',
    unggul: false,
    fitur: [
      'Semua isi paket Profesional',
      'Banyak instansi dalam satu langganan (isolasi data per instansi)',
      'Satu basis dokumen per instansi, tanpa tercampur',
      'Panel admin lintas instansi & pengelolaan pengguna terpusat',
      'Pendampingan implementasi dan pelatihan',
    ],
  },
];

/** Halaman paket & cara mulai (tanpa angka harga). */
export function halamanPaket(kontak: Kontak = konfigKontak()): string {
  const kartu = PAKET.map(
    (p) => `<div class="kartu${p.unggul ? ' unggul' : ''}">
      <h2>${esc(p.nama)}</h2>
      <p class="untuk">${esc(p.untuk)}</p>
      <ul>${p.fitur.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="harga">Penawaran sesuai kebutuhan instansi</div>
    </div>`
  ).join('\n');

  const isi = `
<h1>Pilih paket sesuai kebutuhan instansi</h1>
<p class="pembuka">Aiones Boards menyatukan dashboard kinerja, asisten AI dari dokumen resmi, pelaporan, dan kepatuhan dalam satu tempat. Harga ditentukan setelah kami tahu jumlah instansi, pengguna, dan modul yang dipakai — supaya Anda tidak membayar fitur yang tidak terpakai.</p>
<div class="kisi">${kartu}</div>

<section>
  <h2>Cara mulai</h2>
  <div class="langkah">
    <div><b>Langkah 1</b>Hubungi kami dan sebutkan instansi serta modul yang dibutuhkan. Kami kirim penawaran dan jadwal implementasi.</div>
    <div><b>Langkah 2</b>Instansi dibuatkan, basis dokumen dihubungkan, dan admin instansi menerima akses panel.</div>
    <div><b>Langkah 3</b>Admin mengundang pengguna lain. Pendaftaran mandiri bisa dibuka atau ditutup kapan saja, dan setiap akun baru menunggu persetujuan admin instansi.</div>
  </div>
</section>

<section>
  <div class="sorot">
    <div>
      <h2 style="margin:0 0 4px">Belum yakin paket mana yang pas?</h2>
      <p style="margin:0;color:var(--tinta2);font-size:14px">Kami bisa menunjukkan alur kerja dengan data contoh, tanpa perlu menyiapkan dokumen dulu.</p>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${tautanKontak(kontak)}
      <a class="tombol garis" href="/">Masuk ke aplikasi</a>
    </div>
  </div>
</section>`;
  return kerangka('Paket & harga', isi, kontak);
}

/** Halaman syarat & ketentuan. */
export function halamanSyarat(kontak: Kontak = konfigKontak()): string {
  const isi = `
<h1>Syarat &amp; ketentuan</h1>
<p class="pembuka">Ketentuan ini berlaku untuk penggunaan Aiones Boards. Dengan memakai layanan, instansi dan penggunanya menyetujui ketentuan di bawah. Ketentuan rinci bisa dituangkan dalam perjanjian tertulis terpisah.</p>
<article>
  <h2>1. Definisi</h2>
  <p><b>Layanan</b> adalah aplikasi Aiones Boards beserta dashboard, asisten AI, penyimpanan dokumen, dan fitur lain yang disediakan. <b>Instansi</b> adalah badan usaha atau organisasi yang memiliki akun langganan. <b>Pengguna</b> adalah orang yang diberi akses oleh admin instansi.</p>

  <h2>2. Akun dan keamanan</h2>
  <ul>
    <li>Satu akun dipakai oleh satu orang. Kredensial tidak boleh dibagikan.</li>
    <li>Pendaftaran mandiri menghasilkan akun berstatus menunggu; akses aktif setelah disetujui admin instansi.</li>
    <li>Admin instansi bertanggung jawab menetapkan peran, menonaktifkan akun yang tidak lagi berhak, dan menjaga kerahasiaan PIN tautan bagikan.</li>
    <li>Kegiatan masuk, perubahan data, dan tindakan administratif dicatat dalam jejak audit.</li>
  </ul>

  <h2>3. Penggunaan yang dilarang</h2>
  <ul>
    <li>Mengunggah dokumen yang bukan hak instansi, atau data pribadi tanpa dasar pemrosesan yang sah.</li>
    <li>Mencoba mengakses data instansi lain, menembus batas peran, atau menguji beban layanan tanpa izin tertulis.</li>
    <li>Menyalin, menjual, atau menyewakan layanan kepada pihak lain di luar perjanjian.</li>
    <li>Memakai layanan untuk menyebarkan konten melanggar hukum.</li>
  </ul>

  <h2>4. Data dan kerahasiaan</h2>
  <ul>
    <li>Dokumen dan data yang diunggah tetap milik instansi. Kami memprosesnya hanya untuk menjalankan layanan.</li>
    <li>Data antar-instansi diisolasi: setiap instansi memakai basis dokumennya sendiri.</li>
    <li>Asisten AI menyusun jawaban dari dokumen instansi. Bila dokumen tidak memuat jawabannya, sistem menyatakan tidak menemukan — bukan mengarang angka.</li>
    <li>Cadangan dibuat harian dan dapat disalin ke penyimpanan di luar server sesuai konfigurasi instansi.</li>
  </ul>

  <h2>5. Ketersediaan layanan</h2>
  <p>Kami menjaga layanan tetap tersedia dan memantau kesehatannya, tetapi tidak menjanjikan bebas gangguan sepenuhnya. Pemeliharaan yang berpotensi mengganggu akan diberitahukan lebih dulu bila memungkinkan.</p>

  <h2>6. Kekayaan intelektual</h2>
  <p>Perangkat lunak, tampilan, dan dokumentasi Aiones Boards dilindungi hak cipta dan merupakan milik Aiones. Penggunaan hanya berdasarkan perjanjian. Komponen pihak ketiga tetap tunduk pada lisensinya masing-masing.</p>

  <h2>7. Batasan tanggung jawab</h2>
  <p>Layanan disediakan sebagaimana adanya. Keputusan yang diambil berdasarkan dashboard atau jawaban asisten tetap menjadi tanggung jawab instansi. Kami tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari penggunaan layanan, sejauh diizinkan hukum.</p>

  <h2>8. Perubahan ketentuan</h2>
  <p>Ketentuan dapat diperbarui mengikuti perubahan fitur atau aturan yang berlaku. Perubahan penting diberitahukan lewat aplikasi atau email admin instansi.</p>

  <h2>9. Hukum yang berlaku</h2>
  <p>Ketentuan ini tunduk pada hukum Republik Indonesia. Perselisihan diselesaikan secara musyawarah terlebih dahulu.</p>

  <h2>10. Kontak</h2>
  <p>Pertanyaan tentang ketentuan ini: <a href="mailto:${esc(kontak.email)}">${esc(kontak.email)}</a>.</p>
</article>`;
  return kerangka('Syarat & ketentuan', isi, kontak);
}
