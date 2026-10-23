#!/usr/bin/env python3
"""
Menyiapkan aset logo Aiones Boards dari berkas desain asli.

Sumber (PNG transparan, diberikan desainer):
  brand-src/aionesboard.png       -> lockup: ikon + wordmark "aionesboard."
  brand-src/logo-aionesboard.png  -> mark: ikon tiga bentuk saja

Keluaran di public/brand/:
  logo-lockup.png          lockup untuk latar terang
  logo-lockup-terang.png   lockup untuk latar gelap (navy -> putih, aksen tetap)
  logo-mark.png            ikon saja, kanvas persegi, latar terang
  logo-mark-terang.png     ikon saja untuk latar gelap
  favicon-32.png           32 px, untuk tab browser
  apple-touch-icon.png     180 px, latar putih (iOS tidak mendukung transparan)

Alasan versi terang: sidebar aplikasi berlatar navy gelap. Wordmark navy di atas
navy tidak terbaca, dan menaruh kotak putih di sidebar merusak tampilan — jadi
hanya warna navy yang diganti putih; aksen azure dipertahankan.

Pakai: python scripts/siapkan-logo.py
"""

from pathlib import Path

from PIL import Image

AKAR = Path(__file__).resolve().parent.parent
SUMBER = AKAR / "brand-src"
KELUAR = AKAR / "public" / "brand"

# Warna navy logo. Piksel yang "cukup gelap" dianggap bagian wordmark/ikon gelap
# dan diganti putih pada versi terang; aksen azure (terang) dibiarkan.
BATAS_GELAP = 110


def potong_transparan(im: Image.Image) -> Image.Image:
    """Buang margin transparan di sekeliling logo."""
    kotak = im.getbbox()
    if kotak:
        im = im.crop(kotak)
    return im


def versi_terang(im: Image.Image) -> Image.Image:
    """Navy -> putih, alpha & aksen azure dipertahankan."""
    hasil = im.copy()
    px = hasil.load()
    for y in range(hasil.height):
        for x in range(hasil.width):
            r, g, b, a = px[x, y]
            if a and r < BATAS_GELAP and g < BATAS_GELAP and b < BATAS_GELAP + 40:
                px[x, y] = (255, 255, 255, a)
    return hasil


def persegi(im: Image.Image, sisi: int, margin: float = 0.06) -> Image.Image:
    """Tempel logo ke kanvas persegi transparan dengan margin proporsional."""
    isi = int(sisi * (1 - 2 * margin))
    rasio = min(isi / im.width, isi / im.height)
    kecil = im.resize((max(1, round(im.width * rasio)), max(1, round(im.height * rasio))), Image.LANCZOS)
    kanvas = Image.new("RGBA", (sisi, sisi), (0, 0, 0, 0))
    kanvas.paste(kecil, ((sisi - kecil.width) // 2, (sisi - kecil.height) // 2), kecil)
    return kanvas


def simpan(im: Image.Image, nama: str) -> None:
    tujuan = KELUAR / nama
    im.save(tujuan, optimize=True)
    print(f"  {nama:26} {im.width}x{im.height}  {tujuan.stat().st_size // 1024} KB")


def main() -> None:
    KELUAR.mkdir(parents=True, exist_ok=True)

    lockup = potong_transparan(Image.open(SUMBER / "aionesboard.png").convert("RGBA"))
    mark = potong_transparan(Image.open(SUMBER / "logo-aionesboard.png").convert("RGBA"))

    print("lockup:")
    # Tinggi 96 px = 2x untuk tampilan 48 px, cukup tajam di layar retina.
    tinggi = 96
    lebar = round(lockup.width * tinggi / lockup.height)
    simpan(lockup.resize((lebar, tinggi), Image.LANCZOS), "logo-lockup.png")
    simpan(versi_terang(lockup).resize((lebar, tinggi), Image.LANCZOS), "logo-lockup-terang.png")

    print("mark:")
    simpan(persegi(mark, 512), "logo-mark.png")
    simpan(persegi(versi_terang(mark), 512), "logo-mark-terang.png")

    print("ikon:")
    simpan(persegi(mark, 32, margin=0.04), "favicon-32.png")
    # iOS menaruh ikon di atas latar putih dan tidak suka transparan.
    sentuh = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
    isi = persegi(mark, 180, margin=0.12)
    sentuh.paste(isi, (0, 0), isi)
    simpan(sentuh, "apple-touch-icon.png")


if __name__ == "__main__":
    main()
