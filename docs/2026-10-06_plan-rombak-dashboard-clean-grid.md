# Plan Rombak Tampilan Dashboard — "Clean Grid" (mengikuti referensi Plecto)

Status: **✅ SELESAI — dieksekusi 2026-10-06**
Referensi visual: `clip_20261006_161156_2.png` (dashboard CRM light-theme: kartu putih, font grotesk, segmented toggle hitam, donut, bar chart dengan 1 bar highlight, list progress, tabel dengan baris dotted highlight)
Keluhan user: *"tampilan dashboard seperti gambar, dan fontnya juga ikuti karena yang sekarang terlihat kurang clean"*

## Hasil akhir (ringkas)

Tema **Clean Grid** menggantikan **Soft 3D** di kedua mode, diterapkan ke **seluruh aplikasi**:
- **Font Inter** (grotesk netral) + tabular-nums global — menggantikan Plus Jakarta Sans.
- **Mode terang:** kanvas `#f4f6f8`, kartu putih, border tipis `#e8ecf1`, shadow sangat lembut, radius 12px.
- **Mode gelap:** near-black netral `#0f1115` (bukan navy), kartu `#171a1f`.
- **Kontras WCAG AA lulus** di kedua mode (dihitung via skrip).
- **Segmented control** (pil aktif gelap) gaya referensi; sapu seluruh sisa Soft 3D (chart, KPI, toggle, table, brand, katalog SVG).
- QA resmi **12/12 lulus**; build & TSC hijau.

Commit: `d25219d` (font) · `4cc698b` (palet) · `ea197d5` (sapu + segmented) · docs ini.

---

## 1. Tujuan

Membuat **halaman workspace/dashboard** (kanvas widget) tampil **bersih, lapang, dan profesional** mengikuti referensi — dengan perubahan utama pada **font** dan **gaya kartu/grid**, tanpa merusak fungsi (QA 12/12 harus tetap lulus).

Cakupan: **halaman workspace + widget**. Tema 2 mode (terang/gelap) yang sudah ada **dipertahankan** (referensi = mode terang; mode gelap dibuat versi gelapnya yang setara).

---

## 2. Analisis gap: kondisi sekarang vs referensi

| Aspek | Sekarang (ApexPulse) | Referensi | Aksi |
|---|---|---|---|
| **Font** | Plus Jakarta Sans (geometris, agak "rounded") | Grotesk netral (Inter/Satoshi/General Sans) | **Ganti** ke font grotesk |
| **Angka** | proporsional | tabular figures rapi | Pakai `font-variant-numeric: tabular-nums` di angka |
| **Latar halaman** | `#dfe4ec` (agak biru/berat) | `#F4F6F8` (abu sangat muda) | Terangkan kanvas |
| **Kartu** | putih + border + shadow "Soft 3D" (agak tebal) | putih, border 1px nyaris tak terlihat, shadow **sangat** lembut | Kurangi shadow, tipiskan border |
| **Radius** | 14px (agak besar) | 12–16px (sedang) | 12px (lebih rapi) |
| **Grid** | 12 kolom, `gap-5` | 4 kolom, gap 12–16px | Rapikan gap + rasio span |
| **Aksen** | cyan/violet/coral | biru pastel `#A7D8F0`, hijau mint `#7ED9A0` | Tambah aksen pastel |
| **Toggle/segmented** | pil brand | pil **hitam** solid | Segmented hitam untuk state aktif |
| **Kepadatan** | sedang | lapang (airy) | Tambah padding |

---

## 3. Keputusan desain

### 3.1 Font (inti keluhan "kurang clean")
- **Font utama:** **Inter** (grotesk netral, paling dekat referensi, tersedia di Google Fonts) — ganti dari Plus Jakarta Sans.
- **Fallback:** `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
- **Angka:** aktifkan `tabular-nums` global untuk elemen metrik/tabel (`.tabular-nums` sudah dipakai sebagian).
- **Font mono:** tetap JetBrains Mono (untuk kode/ID).
- **Cara:** ganti `<link>` di `index.html` + `font-family` di `index.css`. Ukuran/weight disesuaikan agar hierarki tegas (judul bold, label medium, subteks regular).

### 3.2 Token warna (mode terang — agar bersih)
| Token | Sekarang | Usulan |
|---|---|---|
| `--color-canvas` | `#dfe4ec` | `#f4f6f8` |
| `--color-surface` | `#fbfcfe` | `#ffffff` |
| `--color-line` | `#cbd3e0` | `#e8ecf1` (lebih halus) |
| `--color-ink` | `#232a38` | `#1a1d1f` |
| `--color-ink-2` | `#4a5468` | `#6b7280` |
| `--color-ink-3` | `#5a6478` | `#9ca3af` |
| Aksen biru pastel | (brand cyan) | tambah `--color-brand-soft: #a7d8f0` |
| Aksen mint | (pos `#0f9d6b`) | tambah `--color-mint: #7ed9a0` |

> **Catatan kontras:** `#9ca3af` untuk teks sekunder berisiko < 4.5:1 di latar putih → verifikasi ulang WCAG AA (token `ink-3` mungkin tetap perlu lebih gelap, mis. `#6b7280`).

### 3.3 Kartu & bayangan
- Radius: `--radius-card: 12px`, `--radius-control: 10px`.
- Border: `1px solid var(--color-line)` tipis.
- Shadow: `0 1px 2px rgb(16 24 40 / 0.04)` (sangat lembut) — kurangi dari "Soft 3D" sekarang.
- Hover: `0 4px 12px rgb(16 24 40 / 0.06)` + translateY kecil.

### 3.4 Komponen khas yang ditiru (nilai tambah)
1. **Segmented toggle** (pil hitam aktif) — untuk filter periode / mode tampilan.
2. **Bar chart dengan 1 bar highlight** (mint) — untuk menonjolkan periode terpilih.
3. **List dengan progress bar** — untuk tabel ranking/realisasi.
4. **Baris tabel highlight (dotted)** — untuk baris terpilih.
5. **Donut dengan angka tengah** — sudah ada (ChartEcharts donut); poles gayanya.

---

## 4. Fase eksekusi

| Fase | Isi | Risiko | Verifikasi |
|---|---|---|---|
| **0 — Checkpoint** | Commit baseline sebelum rombak | rendah | git bersih |
| **1 — Font** | Ganti ke Inter (index.html + index.css), set tabular-nums | rendah | build + cek visual teks |
| **2 — Token mode terang** | Kanvas/surface/line/ink lebih bersih + aksen pastel | **sedang** (kontras) | ukur WCAG AA via skrip |
| **3 — Kartu & shadow** | Radius 12px, shadow lembut, border tipis | rendah | screenshot 2 mode |
| **4 — Grid & spacing** | Rapikan gap, padding, rasio kolom kanvas | sedang (layout) | screenshot desktop/tablet/mobile |
| **5 — Widget khusus** | Segmented toggle, bar highlight, progress list, baris dotted | sedang | uji interaktif + QA |
| **6 — Mode gelap** | Sesuaikan versi gelap setara | sedang | screenshot + kontras |
| **7 — Sapu & QA** | Pastikan 0 warna mentah, QA 12/12, docs | rendah | QA + build + TSC |

Setiap fase = **1 commit** (jangan `git add -A`).

---

## 5. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Font baru merusak lebar teks → layout pecah | Cek screenshot tiap halaman setelah ganti font |
| Kontras gagal WCAG AA (referensi pakai abu muda) | Ukur ulang rasio kontras via skrip; gelapkan bila perlu |
| Regresi fungsional (QA gagal) | Jalankan QA 12/12 tiap fase besar |
| Bertabrakan dengan tema "Soft 3D" yang baru selesai | **Perlu keputusan user:** revisi tema (bukan tambah tema baru) |
| Font Inter tak sesuai selera | Siapkan alternatif (General Sans/Satoshi) untuk dibandingkan |

---

## 6. Definition of Done

- [ ] Font Inter diterapkan konsisten; tampilan terasa lebih bersih.
- [ ] Kanvas/kartu/teks sesuai referensi (terang) + versi gelap setara.
- [ ] Kontras WCAG AA lulus di kedua mode.
- [ ] Grid rapi di desktop/tablet/mobile (tanpa overflow).
- [ ] Widget khas (segmented, bar highlight, progress list) berfungsi.
- [ ] QA resmi 12/12 lulus; build & TSC hijau; 0 warna mentah.
- [ ] Docs diperbarui; 1 fase = 1 commit.

---

## 7. Keputusan user (SUDAH DIJAWAB — 2026-10-06)

1. **Font:** ✅ **Inter** (grotesk netral).
2. **Cakupan:** ✅ **Seluruh aplikasi** — sidebar, header, admin, katalog, widget, login, share.
3. **Nasib Soft 3D:** ✅ **Ganti arah** — "Clean Grid" menggantikan Soft 3D di **kedua mode** (terang & gelap).

> Implikasi: plan ini **menggantikan** arah tema Soft 3D. Kanvas navy + shadow tebal dibuang; kartu jadi putih/abu muda, border tipis, shadow sangat lembut, font Inter, di kedua mode.
