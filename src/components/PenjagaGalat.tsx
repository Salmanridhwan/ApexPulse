import React from 'react';

/**
 * PENJAGA GALAT HALAMAN.
 *
 * Tanpa penjaga, satu galat render (atau satu potongan bundel yang gagal
 * diunduh setelah aplikasi diperbarui) membuat React membongkar seluruh pohon
 * dan pengguna hanya melihat layar kosong tanpa keterangan apa pun.
 *
 * Dua perlakuan:
 * - Galat unduh potongan bundel: halaman dimuat ulang otomatis SEKALI, karena
 *   penyebabnya bundel lama menunjuk berkas yang sudah tidak ada. Penanda waktu
 *   mencegah muat ulang berulang saat server benar-benar bermasalah.
 * - Galat lain: pesan + tombol muat ulang, dan teks galatnya ditampilkan supaya
 *   bisa dilaporkan tanpa membuka konsol.
 */

const KUNCI = 'pemulihan-bundel';

/** Pesan galat unduhan modul dari berbagai peramban. */
const GALAT_BUNDEL =
  /dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module|Failed to fetch/i;

interface Keadaan {
  galat: string;
  bundel: boolean;
}

export class PenjagaGalat extends React.Component<{ children: React.ReactNode }, Keadaan> {
  state: Keadaan = { galat: '', bundel: false };

  static getDerivedStateFromError(e: unknown): Keadaan {
    const teks = e instanceof Error ? e.message : String(e);
    return { galat: teks, bundel: GALAT_BUNDEL.test(teks) };
  }

  componentDidCatch(e: unknown) {
    const teks = e instanceof Error ? e.message : String(e);
    if (!GALAT_BUNDEL.test(teks)) return;
    // Satu pemulihan per 30 detik: kalau berkasnya memang hilang, muat ulang
    // berulang hanya membuat layar berkedip tanpa hasil.
    try {
      const terakhir = Number(sessionStorage.getItem(KUNCI) || 0);
      if (Date.now() - terakhir < 30_000) return;
      sessionStorage.setItem(KUNCI, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  }

  render() {
    if (!this.state.galat) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2 p-6">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-5 text-center">
          <p className="text-sm font-bold text-ink">Halaman gagal dimuat</p>
          <p className="mt-1 text-xs text-ink-3">
            {this.state.bundel
              ? 'Aplikasi baru saja diperbarui. Muat ulang untuk memakai versi terbaru.'
              : 'Terjadi kesalahan saat menampilkan halaman ini.'}
          </p>
          <p className="mt-2 text-[10px] text-ink-3 break-all">{this.state.galat}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-control bg-brand text-on-brand text-xs font-bold"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}
