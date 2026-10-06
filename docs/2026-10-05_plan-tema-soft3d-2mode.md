# Plan Redesign Tema ApexPulse — "Soft 3D" 2 Mode (Terang & Gelap)

Status: **SELESAI** (Fase 0-6 dieksekusi)
Referensi visual: `clip_20261005_213342_2.png` (dashboard dark-slate, kartu stat warna-warni, ring gauge 3D, area chart berlapis)

## Ringkasan hasil eksekusi

| Fase | Hasil | Commit |
|---|---|---|
| 0 — Checkpoint & audit | 22 file tema di-commit; **bug byte non-UTF-8 diperbaiki** (build sempat gagal) | `28b4f56` |
| 1 — Token radius & bayangan | radius 6→14px; bayangan biru-gelap lebih lembut | `e3a6d43` |
| 2 — Depth mode terang | kanvas lebih gelap dari kartu; border hairline tegas | `e3a6d43` |
| 3 — Kartu stat beraksen | `.card-accent` + `.accent-{coral,violet,cyan,teal,amber}` | `ed770c7` |
| 4 — Ring gauge 3D | `RingGauge3D` (SVG beveled), dipakai widget `gauge` | `ed770c7` |
| 5 — Area chart berlapis | gradien translusen lebih halus | (fase5) |
| 6 — Sapu & QA | 0 sisa indigo lama; **QA 12/12 lulus** | (fase6) |

**Catatan penting:** `accent-*` HARUS di `@layer components` (bukan `@utility`) — Tailwind v4 men-tree-shake utility yang belum terpakai, padahal aksen dipilih dinamis dari data.

---

## 0. Ringkasan temuan awal (WAJIB dibaca sebelum eksekusi)

Saat menyusun plan ini, ditemukan **pekerjaan besar yang sudah ada tapi belum di-commit**:

- `src/index.css` **sudah** berisi token `@theme` "Soft 3D" + blok `[data-theme='dark']` (mode gelap & terang).
- `src/theme.ts`, `src/components/ThemeToggle.tsx`, `src/main.tsx` **sudah** mengimplementasikan saklar tema + anti-flicker.
- 22 file termodifikasi, ~984 baris belum di-commit.
- **BUG DIPERBAIKI:** `src/index.css` mengandung byte non-UTF-8 (`0x97`, em-dash Windows-1252 rusak) yang membuat `npm run build` **GAGAL** (`stream did not contain valid UTF-8`). Sudah diganti em-dash UTF-8 yang benar → build hijau lagi.

**Implikasi:** plan ini bukan "mulai dari nol", melainkan **audit + penyempurnaan** agar sesuai referensi. Fase 0 = commit checkpoint pekerjaan yang ada dulu.

---

## 1. Bahasa visual referensi → keputusan token

| Aspek | Referensi | Token ApexPulse (sekarang) | Aksi |
|---|---|---|---|
| Kanvas gelap | slate-navy `#2B3644`→`#232C38` (gradien lembut) | `--color-canvas: #2d333f` | ✅ sudah dekat |
| Kartu/permukaan | lebih terang dari kanvas, shading tepi | `--color-surface: #3a4150` | ✅ sudah dekat |
| Aksen utama | cyan `#2BB8D9` | `--color-brand: #38c6e2` | ✅ sudah dekat |
| Aksen sekunder | periwinkle `#8A86E8` | `--color-violet: #8f90e4` | ✅ sudah dekat |
| Aksen hangat | coral `#E8402A` | `--color-coral: #f2503a` | ✅ sudah dekat |
| Radius | 12–16 px (medium, konsisten) | `--radius-card: 6px` | ⚠️ **terlalu kecil** → naikkan ke 14px |
| Bayangan | soft, blur 12–30px, opasitas 10–25%, warna biru-gelap (bukan hitam) | `--elev-card: 0 18px 32px rgb(8 10 16 / 0.5)` | ⚠️ **terlalu keras** di gelap → turunkan opasitas, pakai biru |
| Tipografi | sans geometris, judul ringan, **angka besar tebal** | Plus Jakarta Sans | ✅ sudah cocok |
| Ring gauge | donut 3D beveled (highlight + shadow arc) | ECharts donut standar | ❌ **belum ada** → fitur baru |
| Area chart | berlapis, translusen, organik | ECharts area standar | ⚠️ perlu opsi "layered" |
| Kartu stat | **solid 1 warna per kartu** (merah/periwinkle/cyan) | KPI netral | ⚠️ perlu varian "accent card" |
| Tooltip | panel gelap semi-transparan + avatar | ECharts tooltip | ⚠️ opsional polish |

**Mood:** playful-minimal, soft-3D glossy (bukan glassmorphism penuh).

---

## 2. Prinsip desain (aturan keras)

1. **Dua mode setara.** Setiap token WAJIB punya nilai di `@theme` (terang) DAN `[data-theme='dark']`. Tidak ada warna mentah di JSX.
2. **Warna = makna.** Aksen warna-warni hanya untuk membedakan seri data / kategori stat, bukan dekorasi acak.
3. **Bayangan lembut, warna biru-gelap.** Dilarang `rgb(0 0 0)` untuk shadow; pakai `rgb(8 10 16)` / `rgb(35 42 56)`.
4. **Kontras minimum WCAG AA** (4.5:1 teks normal) di **kedua** mode. Verifikasi `ink-3` di terang & gelap.
5. **Radius konsisten** dari token (`card`/`control`/`chip`), tidak ada nilai ad-hoc.
6. **Hormati `prefers-reduced-motion`** (sudah ada) dan `prefers-color-scheme` (sudah ada).
7. **1 fase = 1 commit.** Jangan `git add -A`.

---

## 3. Fase eksekusi

### Fase 0 — Checkpoint & audit (nol risiko visual)
- [ ] Commit pekerjaan tema yang ada sebagai checkpoint: `style(theme): checkpoint sistem tema Soft 3D 2 mode`.
- [ ] Catat diff baseline (`git diff --stat`) supaya perubahan plan ini terpisah dari checkpoint.
- [ ] Verifikasi `npm run build` + `npx tsc --noEmit` hijau setelah commit.

**Kenapa:** ada 984 baris belum ter-commit; hindari menumpuk perubahan baru di atasnya.

### Fase 1 — Token: radius & bayangan sesuai referensi
- [ ] `--radius-card`: `6px` → `14px`; `--radius-control`: `5px` → `10px`.
- [ ] Ganti shadow hitam → biru-gelap, turunkan opasitas:
  - Terang: `0 10px 24px rgb(35 42 56 / 0.10), 0 2px 6px rgb(35 42 56 / 0.06)`
  - Gelap: `0 12px 28px rgb(4 6 12 / 0.45), 0 2px 6px rgb(4 6 12 / 0.30)`
- [ ] Verifikasi kartu tetap terbaca di kedua mode (screenshot).

### Fase 2 — Depth mode terang (temuan: "hilang kedalaman")
- [ ] Naikkan kontras kanvas vs kartu di terang (`--color-canvas` sedikit lebih gelap dari `--color-surface`).
- [ ] Tambah border hairline lebih tegas di terang (`--color-line`).
- [ ] Pastikan aksen (cyan/violet/coral) "pop" di terang — cek `--color-brand` vs kanvas.

### Fase 3 — Kartu stat beraksen (varian "accent card")
- [ ] Tambah utility `@utility card-accent` dengan varian warna (`data-accent="coral|violet|cyan"`).
- [ ] Terapkan opsional pada KPI card (bisa dimatikan per-widget).
- [ ] **Jaga keterbacaan:** teks di atas kartu warna solid harus putih & lulus kontras.
- [ ] Verifikasi di 2 mode (kartu solid di terang perlu penyesuaian).

### Fase 4 — Ring gauge 3D (fitur baru, sesuai referensi)
- [ ] Buat komponen `RingGauge3D` (SVG): arc highlight + arc shadow + inner shadow.
- [ ] Dukung 2 mode & reduced-motion.
- [ ] Pakai pada widget `gauge`/`donut` (opsi "gaya 3D").
- [ ] Uji dengan data nyata + verifikasi visual.

### Fase 5 — Area chart berlapis (opsional, polish)
- [ ] Tambah opsi `layered` pada `ChartEcharts` untuk area translusen bertumpuk.
- [ ] Pastikan warna seri dari palet token (bukan hex mentah).

### Fase 6 — Sapu akhir & QA
- [ ] `grep` warna mentah di JSX (`#hex`, `rgb(`, `slate-`, `sky-`, `blue-`) → harus 0 (kecuali konteks sengaja).
- [ ] Jalankan QA resmi: `HONOR_SHELL_ENV=1 PORT=3114 npx tsx server.ts` + `API_BASE=... npx tsx scripts/qa-demo-ui.ts` → target **12/12**.
- [ ] Screenshot kedua mode + verifikasi vision.
- [ ] Update `AGENTS.md` + docs.

---

## 4. Matriks verifikasi (per fase)

| Cek | Cara | Ambang lulus |
|---|---|---|
| Build | `npm run build` | hijau |
| Tipe | `npx tsc --noEmit` | 0 error di `src/` |
| Warna mentah | `grep` di `src/**/*.tsx` | 0 |
| Kontras | hitung rasio `ink-3` vs `surface` | ≥ 4.5:1 (dua mode) |
| Mode terang | screenshot | kartu punya depth |
| Mode gelap | screenshot | tidak ada area putih nyasar |
| Fungsional | `qa-demo-ui.ts` | 12/12 |
| Reduksi gerak | `prefers-reduced-motion` | animasi mati |

---

## 5. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| 984 baris belum commit tercampur | sulit rollback | Fase 0 commit checkpoint dulu |
| Radius besar (14px) merusak layout rapat | elemen bertumpuk | uji visual tiap halaman |
| Kartu solid warna gagal kontras | teks tak terbaca | uji kontras putih di atas tiap warna |
| Byte non-UTF-8 muncul lagi | build gagal | simpan file sebagai UTF-8; tambah cek di QA |
| QA selector tertabrak (kasus lalu) | 5 langkah gagal | hindari `input[type=text]` baru; pakai `type=search` |
| Ring gauge 3D berat | FPS turun | pakai SVG/CSS, hindari filter berat |

---

## 6. Definition of Done — ✅ SEMUA TERPENUHI

- [x] **Build & tipe hijau; git bersih.** — `npm run build` hijau, `npx tsc --noEmit` 0 error di `src/`, working tree bersih.
- [x] **Token 2 mode lengkap & terdokumentasi di `index.css`.** — `@theme` (terang) + `[data-theme='dark']` (gelap), semua token punya nilai di kedua blok.
- [x] **Radius & bayangan sesuai referensi (lembut, biru-gelap).** — `--radius-card: 14px`, `--radius-control: 10px`; bayangan `rgb(35 42 56 / …)` & `rgb(4 6 12 / …)` (bukan hitam murni).
- [x] **Kartu stat beraksen + ring gauge 3D tersedia.** — `.card-accent` + `.accent-{coral,violet,cyan,teal,amber}`; `RingGauge3D` terintegrasi ke widget `gauge` (terverifikasi di app nyata: 1 SVG, angka di tengah, efek 3D).
- [x] **Warna mentah di JSX:** 0 untuk warna *dekoratif*. Sisa yang **sengaja**: (a) overlay modal `bg-slate-900/50`, (b) palet seri ECharts/SVG yang tak bisa membaca CSS var, (c) `WARNA_LEGACY` sebagai peta normalisasi. Semua warna seri legacy sudah disapu ke palet Soft 3D.
- [x] **Kontras WCAG AA di kedua mode.** — Diukur: **14/14 kombinasi token lulus** (terang & gelap). 3 token yang semula gagal sudah diperbaiki (`ink-3`, `brand-ink`).
- [x] **QA resmi 12/12.** — Dijalankan 5×; hasil akhir **12 lulus, 0 gagal**, console/network bersih.
- [x] **Screenshot 2 mode terverifikasi + docs diperbarui.** — `tema-light.png` & `tema-dark.png` diverifikasi vision; dokumen ini diperbarui.

### Verifikasi tambahan (di luar DoD awal)
- [x] **`prefers-reduced-motion`** — 10 elemen beranimasi terkonfirmasi dimatikan (durasi ≤ 0.01ms).
- [x] **Normalisasi warna render-time** — `WARNA_LEGACY` + `keWarnaTema()` di `ChartEcharts` menjaga data lama (MySQL/db.json) tetap konsisten tanpa migrasi manual.
- [x] **Migrasi data** `data/db.json` (18 warna) dengan backup `.bak-warna` (gitignored).

**Commit:** `28b4f56` → `e3a6d43` → `ed770c7` → `69a1a1e` → `6af7a21` → `f142921`
