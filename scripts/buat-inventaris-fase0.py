import io, os

rows = [
    # chartId, tipe dasar, bentuk data, ciri visual, varian ada, dipakai di
    ("kpi-kartu", "kpi", "satu angka + delta + opsional deret sparkline", "kartu berikon, angka besar, delta berwarna, sparkline di kaki kartu", ["default", "ringkasan", "analitik", "trafik"], "Ringkasan h1, Analitik h1, Trafik h1"),
    ("kpi-strip", "kpi", "satu angka + satuan", "kartu kecil tanpa ikon, label kecil di atas angka", ["ringkasan", "analitik", "trafik"], "Ringkasan h2, Ringkasan h3, TemaLain h2/h3"),
    ("progres-target", "bullet-target", "label + nilai + target", "baris bilah HTML, jalur target abu, capaian berwarna", ["ringkasan", "analitik"], "Ringkasan h1, TemaLain h2 analitik"),
    ("tabel-ringkas", "table", "kolom + baris angka", "tabel rapat tanpa garis vertikal, angka rata kanan", ["default", "ringkasan", "analitik", "trafik"], "Ringkasan h1, Analitik h1, Trafik h1, TemaLain h3"),
    ("narasi-insight", "narasi", "satu paragraf", "strip satu baris dengan aksen kiri", ["default", "ringkasan", "analitik", "trafik"], "Ringkasan h1, Ringkasan h2, TemaLain h3"),
    ("peringkat", "hbar", "label + nilai", "daftar urut dengan bilah tipis di kanan", ["ringkasan", "trafik"], "Trafik h1 (Halaman Populer), TemaLain h3"),
    ("bar-tegak", "bar", "kategori + satu seri", "batang polos, sudut membulat kecil", ["default"], "chartOptions generik"),
    ("bar-tegak-sorot", "bar", "kategori + satu seri", "batang bergradasi, puncak disorot, garis tren biru, label pil", ["ringkasan", "analitik", "trafik"], "Ringkasan h1/h2/h3, Analitik, Trafik, TemaLain"),
    ("bar-tegak-target", "bar", "kategori + satu seri + garis rata-rata", "batang bergradasi dengan garis putus-putus target", ["ringkasan", "trafik"], "Ringkasan h3 (NRW), TemaLain h3 trafik"),
    ("bar-mendatar-peringkat", "hbar", "label + nilai", "batang mendatar bergradasi, label di ujung", ["ringkasan", "analitik", "trafik"], "Ringkasan h3 (pengaduan), Analitik, TemaLain"),
    ("bar-mendatar-target", "hbar", "label + target + realisasi", "dua batang: jalur target dan capaian", ["default", "ringkasan"], "Ringkasan h2 (indikator), TemaLain h2"),
    ("bar-tumpuk", "combo", "kategori + dua seri bertumpuk", "batang bertumpuk satu warna", ["trafik"], "TemaLain h2 trafik"),
    ("area-gradasi", "area", "kategori + satu seri", "area bergradasi oranye, titik ujung berlabel", ["ringkasan", "analitik", "trafik"], "Ringkasan h1 (Arus Kas), Analitik, Trafik"),
    ("garis-tren", "line", "kategori + satu seri", "garis halus dengan titik", ["default", "analitik", "trafik"], "chartOptions generik, Analitik, Trafik"),
    ("combo-batang-garis", "combo", "kategori + seri batang + seri garis", "batang pada sumbu kiri, garis pada sumbu kanan", ["trafik"], "TemaLain h3 trafik"),
    ("scatter-gelembung", "bubble", "x, y, ukuran", "gelembung berukuran proporsional, label nama", ["analitik"], "TemaLain h3 analitik"),
    ("titik-bersumbu", "scatter", "label + nilai", "titik tunggal per kategori", ["trafik"], "TemaLain h3 trafik"),
    ("donat-tebal", "donut", "kategori + nilai", "cincin tebal, sudut membulat, total di tengah", ["ringkasan", "analitik", "trafik"], "Ringkasan h1/h2/h3, Analitik, Trafik, TemaLain"),
    ("donat-tipis", "donut", "kategori + nilai", "cincin tipis tanpa bayangan", ["default"], "chartOptions generik"),
    ("gauge-target", "gauge", "satu angka + target", "setengah lingkaran dengan penanda target", ["ringkasan"], "Ringkasan h2 (NRW)"),
]

pages = [
    ("Ringkasan halaman 1", "DashboardReferensi", 4, ["kpi-kartu", "bar-tegak-sorot", "donat-tebal", "tabel-ringkas", "area-gradasi", "progres-target", "narasi-insight"]),
    ("Ringkasan halaman 2", "DashboardOperasional", 4, ["kpi-strip", "bar-tegak-sorot", "gauge-target", "bar-mendatar-target", "donat-tebal", "narasi-insight"]),
    ("Ringkasan halaman 3", "DashboardWilayah", 4, ["kpi-strip", "bar-tegak-sorot", "bar-tegak-target", "donat-tebal", "bar-mendatar-peringkat", "narasi-insight"]),
    ("Analitik halaman 1", "DashboardAnalitik", 4, ["kpi-kartu", "bar-tegak-sorot", "garis-tren", "donat-tebal", "area-gradasi", "tabel-ringkas", "narasi-insight"]),
    ("Trafik halaman 1", "DashboardTrafik", 5, ["kpi-kartu", "area-gradasi", "garis-tren", "bar-tegak-sorot", "donat-tebal", "peringkat", "tabel-ringkas"]),
    ("Analitik dan Trafik halaman 2", "DashboardTemaLain", 4, ["kpi-strip", "bar-tegak-sorot", "garis-tren", "donat-tebal", "progres-target"]),
    ("Analitik dan Trafik halaman 3", "DashboardTemaLain", 4, ["kpi-strip", "scatter-gelembung", "bar-tegak-target", "tabel-ringkas", "bar-mendatar-peringkat", "combo-batang-garis", "titik-bersumbu", "donat-tebal"]),
]

varian = ["default", "ringkasan", "analitik", "trafik"]
sel_total = len(rows) * len(varian)
sel_isi = sum(len(r[4]) for r in rows)
sel_bolong = sel_total - sel_isi

def hitung(v):
    return sum(1 for r in rows if v in r[4])

lines = []
lines.append("# Fase 0 — Inventaris Bentuk Grafik dan Identitas Chart")
lines.append("")
lines.append("Hasil Fase 0 dari rencana `2026-10-29_2136-aiones-resep-grafik-tunggal.md`. Dokumen ini HANYA memotret keadaan sekarang, tidak mengubah kode.")
lines.append("")
lines.append("## Ringkasan angka")
lines.append("")
lines.append(f"- Bentuk grafik yang sudah dipakai di enam halaman template: **{len(rows)} identitas**.")
lines.append(f"- Matriks wajib nanti: {len(rows)} identitas x {len(varian)} varian = **{sel_total} sel**.")
lines.append(f"- Sel yang sudah ada hari ini: **{sel_isi}**. Sel yang masih bolong: **{sel_bolong}**.")
for v in varian:
    lines.append(f"- Varian `{v}` sudah ada untuk {hitung(v)} dari {len(rows)} identitas.")
lines.append("")
lines.append("## Katalog Template Chart hari ini")
lines.append("")
lines.append("Halaman Template Chart memuat 31 tipe visualisasi, terbagi delapan grup: Kartu (5), Kartesius (6), Komposisi (5), Sebaran (4), Matriks (3), Prediktif (4), Preskriptif (3), Lainnya (1).")
lines.append("")
lines.append("Dari 31 tipe itu, yang benar-benar dipakai enam halaman template hanya 13 tipe dasar, yaitu kpi, bullet-target, gauge, table, narasi, line, area, bar, hbar, combo, donut, scatter dan bubble. Sisanya baru tersedia di dashboard biasa dan belum punya wajah template.")
lines.append("")
lines.append("## Bentuk grafik yang dipakai sekarang")
lines.append("")
lines.append("| Identitas | Tipe dasar | Bentuk data | Ciri visual | Varian ada | Dipakai di |")
lines.append("| --- | --- | --- | --- | --- | --- |")
for r in rows:
    lines.append(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} | {', '.join(r[4])} | {r[5]} |")
lines.append("")
lines.append("## Susunan tiap halaman template")
lines.append("")
lines.append("| Halaman | Komponen | Jumlah KPI | Bentuk yang dipakai |")
lines.append("| --- | --- | --- | --- |")
for p in pages:
    lines.append(f"| {p[0]} | `{p[1]}.tsx` | {p[2]} | {', '.join('`' + x + '`' for x in p[3])} |")
lines.append("")
lines.append("## Temuan yang menentukan Fase 1")
lines.append("")
lines.append("1. Varian `default` baru lengkap untuk bentuk yang memang ada di `chartOptions.ts`. Bentuk khas template seperti `bar-tegak-sorot`, `bar-tegak-target`, dan `bar-mendatar-target` belum punya padanan default, jadi harus dibuat dulu supaya matriks tidak bolong di kolom default.")
lines.append("2. Ada tujuh bentuk yang bukan grafik ECharts: `kpi-kartu`, `kpi-strip`, `progres-target`, `tabel-ringkas`, `narasi-insight`, `peringkat`, dan `titik-bersumbu` versi HTML. Ketujuhnya tetap harus jadi identitas resmi, karena ganti tema juga mengubah kartu, tabel, dan strip narasi, bukan hanya kanvas grafik.")
lines.append("3. Tiga halaman Ringkasan sudah memakai satu bahasa visual yang konsisten, jadi kolom `ringkasan` adalah yang paling siap dijadikan acuan mutu untuk kolom lain.")
lines.append("4. Halaman Analitik dan Trafik memakai lebih dari sepuluh kartu per halaman dengan gaya yang ditulis sendiri. Saat migrasi, bentuk yang mirip harus disatukan ke satu identitas, bukan dibiarkan jadi identitas baru per kartu.")
lines.append("5. Nama identitas memakai bahasa Indonesia dan menyebut bentuk, bukan menyebut halaman, supaya tidak ada `bar-halaman-2` dan sejenisnya.")
lines.append("")
lines.append("## Berikutnya")
lines.append("")
lines.append("Fase 1 membangun `chartDefault.ts`, `chartTemplate.ts`, dan `data/status-desain.json` dengan matriks di atas sebagai daftar kerja. Sel yang bolong dibiarkan terbuka dan ditandai oleh tes kelengkapan, lalu diisi bertahap per fase.")

teks = "\n".join(lines) + "\n"
os.makedirs("docs", exist_ok=True)
io.open("docs/fase-0-inventaris-chart.md", "w", encoding="utf-8", newline="").write(teks)
print("identitas", len(rows), "sel", sel_total, "isi", sel_isi, "bolong", sel_bolong)
for v in varian:
    print(v, hitung(v))
