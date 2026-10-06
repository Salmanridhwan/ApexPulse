# Audit UI/UX ApexPulse — Laporan Lengkap

**Tanggal:** 2026-10-06
**Metode:** 7 skill (impeccable, design-taste-frontend, anti-slop, humanizer, stop-slop, no-ai-slop, avoid-ai-writing)
**Bukti:** DOM runtime (puppeteer), detektor otomatis, pengukuran kontras terhitung, inspeksi visual
**Mode diuji:** Terang + Gelap · Viewport 1440px + 375px

---

## ✅ STATUS: SEMUA TEMUAN DIPERBAIKI (2026-10-06)

| Temuan | Severitas | Status | Bukti |
|---|---|---|---|
| Logo "AP" putih di brand 2.84:1 | P1 | **FIX** | token `--color-on-brand` → **6.48:1** (terang) / **9.07:1** (gelap) |
| `ink-3` di kanvas 4.46:1 | P1 | **FIX** | `#6b7280` → `#646b78` = **4.95:1** kanvas / 5.36:1 surface |
| Em-dash terlihat user (6+) | P1 | **FIX** | `slop-scan` 0 temuan over budget (dari 2) |
| Target sentuh < 44px | P2 | **FIX** | tombol mata 16px → 32px + `aria-label` |
| Modal tanpa ARIA | P2 | **FIX** | `role="dialog"` + `aria-modal` + `aria-labelledby` di **7 modal** |
| `aria-live` = 0 | P2 | **FIX** | status chat + error login/PIN |
| Bounce easing (2×) | P2 | **FIX** | exponential ease-out + `.dot-typing` |
| Bundel berat | P2 | **FIX** | ECharts 1.12 MB → **622 KB**; three.js 531 KB → **0**; chunk utama 1 MB → **380 KB** |
| Advisory grid 2-sumbu | P3 | **FIX** | dead code `.bg-grid-subtle` dihapus |

**Sistemik (baru ditemukan saat perbaikan):** semua CTA/logo `bg-brand text-white` (23 baris/10 file), `bg-ink text-white` (8 baris/5 file), dan `bg-neg/pos/warn text-white` (7 baris/6 file) gagal AA di salah satu mode → token `--color-on-*` baru.

**Verifikasi ulang:** `tsc` bersih · `npm run build` hijau · **QA 12/12 lulus, console bersih** · kontras DOM **0 gagal** di kedua mode · detector impeccable 3 → **1** (sisa hanya "Inter" = pengecualian sah).

---


> Catatan metodologi: setiap temuan diverifikasi ulang. Klaim `vision_analyze` yang terbantah DOM dicatat sebagai **false positive** dan tidak dihitung sebagai temuan.

---

## Skor Kesehatan Audit — 16/20 (Good)

| # | Dimensi | Skor | Temuan utama |
|---|---------|------|--------------|
| 1 | Aksesibilitas | **3**/4 | Logo "AP" 2.84:1 gagal; 2 target sentuh kecil; modal tanpa `role="dialog"` |
| 2 | Performa | **3**/4 | ECharts 1.12MB + three.js 531KB (di-lazy-load, tapi besar) |
| 3 | Desain Responsif | **4**/4 | 0 overflow di 375px & 1440px; 0 overflow internal |
| 4 | Tematik | **4**/4 | Token penuh 2 mode; 11 hex mentah (semuanya dikecualikan & beralasan) |
| 5 | Integritas Implementasi | **2**/4 | 3 anti-pattern detektor + 6 em-dash terlihat user |
| **Total** | | **16/20** | **Good — perbaiki dimensi lemah** |

---

## Verdict Integritas Implementasi

**LULUS.** Implementasi mengekspresikan sistem produk-spesifik yang koheren: token 2 mode konsisten, primitif `ItemCard` dipakai lintas 12+ komponen, komponen berbagi bahasa visual yang sama, dan tidak ada struktur yang bisa ditukar dengan produk lain.

**Bukti:** 30 komponen, 1 sistem token, 0 drift warna mentah yang tidak beralasan.

---

## Ringkasan Eksekutif

- **Skor: 16/20 (Good)**
- **Total temuan: 13** → P0: 0 · P1: 3 · P2: 5 · P3: 5
- **Temuan kritis (top 3):**
  1. Logo "AP" putih di cyan = **2.84:1 (terang) / 2.03:1 (gelap)** — gagal WCAG AA
  2. `ink-3` `#6b7280` di atas kanvas = **4.46:1** — gagal tipis (ambang 4.5)
  3. Em-dash terlihat user (6 lokasi) — AI tell + pelanggaran aturan anti-slop

---

## Detektor Otomatis (impeccable `detect src`)

```
3 anti-pattern ditemukan:
1. [bounce-easing] ChatPanel.tsx:500  — animate-bounce (Tailwind)
2. [bounce-easing] ThemeToggle.tsx:28 — cubic-bezier(0.34, 1.56, 0.64, 1)
3. [overused-font] index.css:249      — font-family: 'Inter'

1 advisory:
4. [codex-grid-background] index.css:291 — grid-line gradient 2 sumbu
```

**Catatan penting tentang #3 (Inter):** detector benar secara umum, tapi `design-taste-frontend` §4.1 menyatakan Inter **dapat diterima** saat brief adalah "Linear-style / netral / accessibility-first". ApexPulse = dashboard enterprise BUMD yang menuntut netralitas + angka tabular. **Keputusan: pertahankan Inter** — ini pengecualian yang sah, bukan slop.

---

## Temuan Detail per Severitas

### [P1] Logo "AP" — kontras gagal WCAG AA
- **Lokasi:** `src/components/BrandMark.tsx:40` — `text-white` + `backgroundColor: warnaTile(...)`
- **Kategori:** Aksesibilitas
- **Bukti terukur:** terang `rgb(255,255,255)` di `rgb(31,166,204)` = **2.84:1**; gelap di `rgb(56,198,226)` = **2.03:1**
- **Standar:** WCAG AA butuh 4.5:1 (teks normal) / 3:1 (teks besar)
- **Dampak:** inisial logo sulit dibaca, terutama mode gelap
- **Catatan:** logo = elemen grafis, ambang formalnya 3:1 (WCAG 1.4.11 non-text). Tetap gagal bahkan pada ambang longgar itu (2.03:1).
- **Rekomendasi:** pakai `text-ink` (gelap) di atas tile cyan, ATAU gelapkan tile khusus logo. Ukuran 32px = "large text" → ambang 3:1.
- **Command:** `/impeccable colorize`

### [P1] `ink-3` di atas kanvas — gagal tipis
- **Lokasi:** `src/index.css:21` — `--color-ink-3: #6b7280`
- **Kategori:** Aksesibilitas
- **Bukti:** di kanvas `#f4f6f8` = **4.46:1** (gagal); di surface `#fff` = **4.83:1** (lulus)
- **Standar:** WCAG AA 4.5:1
- **Dampak:** label kecil (`v2026.1`, teks footer) di atas kanvas gagal tipis; di atas kartu aman
- **Rekomendasi:** gelapkan `ink-3` terang ke `#646b78` (≈4.7:1 di kanvas) — tetap aman di surface.
- **Command:** `/impeccable colorize`

### [P1] Em-dash terlihat pengguna (6 lokasi)
- **Lokasi:** `App.tsx:951`, `ExportModal.tsx:87`, `ExportModal.tsx:147`, `ShareModal.tsx:226`, `Admin.tsx:579`, `Admin.tsx:598-599`, `Admin.tsx:626`
- **Kategori:** Integritas Implementasi / Copy
- **Bukti:** `slop-scan.mjs` → Admin.tsx **2.34 em-dash/100 kata** (budget 0.67/100w); `avoid-ai-writing` detector → 2 em-dash terdeteksi
- **Standar:** aturan anti-slop: **0 em-dash di koppen/knoppen/labels**; design-taste §9.G: em-dash dilarang total
- **Dampak:** AI tell paling mudah dikenali; khusus `Admin.tsx:579` muncul di kalimat penjelasan
- **Rekomendasi:** ganti dengan koma / titik / titik dua; **rotasi** tanda baca (jangan semua jadi koma). Contoh:
  - `Mock — data demo lokal` → `Mock: data demo lokal`
  - `PIN aktif — isi untuk ganti` → `PIN aktif, isi untuk ganti`
  - `PEMERINTAH DAERAH — BADAN USAHA MILIK DAERAH` → pisah baris atau garis miring
- **Command:** `/impeccable clarify`

### [P2] Target sentuh < 44×44px
- **Lokasi:** `Login.tsx` tombol mata (`w-4 h-4` = 16×16, padding 0), `ThemeToggle.tsx:23` (`h-8` = 32px)
- **Kategori:** Responsif / Aksesibilitas
- **Bukti DOM:** eye toggle **16×16** padding `0px`; ThemeToggle **58×32**
- **Standar:** WCAG 2.5.8 Target Size (Minimum) = 24×24px; rekomendasi 44×44px
- **Dampak:** toggle mata sulit ditekan di layar sentuh; 16px jauh di bawah minimum
- **Catatan:** checkbox 13×13 **punya label 458×20** → area klik efektif cukup, bukan masalah nyata.
- **Rekomendasi:** beri padding pada tombol mata (`p-2` → area 32×32) atau `before:` pseudo-element yang memperluas hit area.
- **Command:** `/impeccable adapt`

### [P2] Modal tanpa atribut ARIA dialog
- **Lokasi:** modal aplikasi (share/export/editor)
- **Kategori:** Aksesibilitas
- **Bukti:** `role=` hanya 2 di seluruh `src/`; `aria-live` = 0; `aria-*` = 17 total
- **Standar:** WCAG 4.1.2; pola dialog butuh `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- **Dampak:** screen reader tidak mengumumkan modal sebagai dialog; fokus tidak terperangkap
- **Rekomendasi:** tambah `role="dialog" aria-modal="true" aria-labelledby` pada shell modal.
- **Command:** `/impeccable harden`

### [P2] Animasi bounce (detektor)
- **Lokasi:** `ChatPanel.tsx:500` (`animate-bounce`), `ThemeToggle.tsx:28` (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
- **Kategori:** Integritas / Motion
- **Dampak:** easing elastis terasa "murahan" dan sudah usang menurut rubrik craft-floor
- **Rekomendasi:** ganti ke exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Command:** `/impeccable animate`

### [P2] Bundel berat
- **Lokasi:** `dist/assets/echarts-*.js` = **1.12 MB**, `three.module-*.js` = **531 KB**
- **Kategori:** Performa
- **Bukti:** sudah `React.lazy` (6 titik), tapi ukuran mentah besar
- **Dampak:** LCP/INP di koneksi lambat
- **Rekomendasi:** ECharts — impor hanya modul yang dipakai (tree-shaking per-seri); three.js — pertimbangkan mengganti `Hero3D` dengan CSS/SVG bila efeknya kosmetik.
- **Command:** `/impeccable optimize`

### [P3] Advisory: latar grid 2 sumbu
- **Lokasi:** `src/index.css:291`
- **Kategori:** Integritas
- **Catatan:** detector menandai pola gradient grid sebagai signature generated-UI. Di sini dipakai sebagai latar dekoratif halaman login.
- **Rekomendasi:** opsional — biarkan (brief mendukung), atau ganti dengan permukaan polos.
- **Command:** `/impeccable quieter`

### [P3] `will-change` & token minor
- **Lokasi:** 1 penggunaan `will-change` (wajar), 11 hex mentah (semua di `WARNA_TILE`, `ChartEcharts` tema, `RingGauge3D` bevel — dikecualikan & beralasan)
- **Kategori:** Performa / Tematik
- **Rekomendasi:** tidak ada tindakan; catat sebagai utang teknis yang disengaja.

---

## Pola & Isu Sistemik

- **Aksesibilitas target kecil berulang:** pola tombol-ikon-tanpa-padding muncul di beberapa tempat (mata sandi, toggle). Perbaiki sekali di level primitif tombol ikon.
- **ARIA tipis secara sistemik:** 17 `aria-*` untuk 30 komponen + 0 `aria-live`. Status dinamis (chat, notifikasi, simpan) tidak diumumkan ke screen reader. Ini utang aksesibilitas lintas aplikasi.
- **Em-dash terkonsentrasi di copy admin:** pola penulisan "X — Y" sebagai penjelasan. Perbaiki di sumber copy, bukan satu per satu.

---

## Temuan Positif (pertahankan)

- **Kontras dasar sangat baik:** tombol utama 16.94:1 (terang) / 15.83:1 (gelap) — jauh di atas AA.
- **Responsif sempurna:** 0 overflow di 375px & 1440px; 0 elemen overflow internal.
- **Tematik penuh:** 0 warna mentah tanpa alasan; kedua mode konsisten; `prefers-reduced-motion` dihormati (4 titik).
- **Copy bersih:** detektor `avoid-ai-writing` memberi skor **0 = "Clean"**, klasifikasi `HUMAN_ONLY`; tidak ada filler AI ("seamless", "elevate") — 0 temuan.
- **Integritas komponen:** primitif `ItemCard` dipakai konsisten; bahasa visual seragam.
- **States lengkap:** loading (51), empty (19), error (14), disabled (22) — semua ada.
- **Fokus keyboard terlihat:** outline 2px solid, kontras tinggi di kedua mode.
- **Hierarki heading benar:** H1 → H2, tidak ada lompatan.

---

## False Positive Terbantah (dicatat, tidak dihitung)

| Klaim vision | Bukti DOM | Verdict |
|---|---|---|
| "Overlap teks fatal di panel kiri login" | `overlaps: []`, `opacity: 1`, tidak ada "rn" | **False positive** — artefak animasi fade-in |
| "Huruf putih di cyan kurang kontras" (logo) | kontras terukur 2.84:1 | vision benar soal *terbaca*, tapi angkanya tetap gagal AA → tetap temuan |
| "Tombol Masuk 1.08:1" (audit awal) | span transparan; bg tombol `#1a1d1f` → **16.94:1** | **False positive** — latar efektif salah dibaca |

---

## Rekomendasi Tindakan (prioritas)

1. **[P1] `/impeccable colorize`** — perbaiki kontras logo "AP" + `ink-3` di kanvas
2. **[P1] `/impeccable clarify`** — bersihkan 6 em-dash terlihat user (rotasi tanda baca)
3. **[P2] `/impeccable harden`** — tambah `role="dialog"`/`aria-modal` pada modal + `aria-live` untuk status dinamis
4. **[P2] `/impeccable adapt`** — perluas hit area tombol mata & ThemeToggle ke ≥32px
5. **[P2] `/impeccable animate`** — ganti 2 bounce easing ke exponential
6. **[P2] `/impeccable optimize`** — tree-shake ECharts, evaluasi three.js
7. **[P3] `/impeccable quieter`** — pertimbangkan latar grid login
8. **[P3] `/impeccable polish`** — pass akhir setelah semua perbaikan

> Anda bisa minta saya menjalankan ini satu per satu, sekaligus, atau dalam urutan apa pun.
> Jalankan `/impeccable audit` lagi setelah perbaikan untuk melihat skor naik.

---

## Batasan Audit (jujur)

- **`design-taste-frontend` §13** menyatakan skill ini **bukan untuk dashboard/data-table/product UI**. ApexPulse adalah dashboard, jadi saya hanya memakai bagian relevannya (tipografi, warna, kontras, states, ikon, copy) dan **tidak** menerapkan aturan hero/landing-page (eyebrow count, bento cells, marquee).
- **`anti-slop` berbahasa Belanda** — saya terjemahkan konsepnya (em-dash budget, rule-of-three, microcopy-tells) saat menerapkan.
- **4 skill tulisan dikalibrasi untuk Bahasa Inggris.** Copy UI ApexPulse = Bahasa Indonesia, jadi detektor kata (tier1/tier2) tidak menangkap AI-ism Indonesia; yang tetap berlaku: em-dash, rule-of-three, struktur formulaik. **Detektor kata berbahasa Inggris menghasilkan false negative pada teks Indonesia** — ini keterbatasan nyata, bukan berarti copy bebas masalah.
- **Gesture sentuh** tidak diuji dengan sentuhan tersintesis (hanya viewport emulasi). Drag resize panel & scroll-snap belum diuji di perangkat sentuh nyata.
