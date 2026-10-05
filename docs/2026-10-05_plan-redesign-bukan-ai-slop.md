# Plan — Redesign ApexPulse: "Bukan AI Slop"

**Tanggal:** 5 Oktober 2026
**Status:** DISETUJUI — gaya "Midnight Indigo", eksekusi bertahap per fase
**Struktur fase:** mengikuti `docs/2026-10-05_plan-redesign-halaman.md` (token → warna → radius → shell → state → polish)
**Keputusan visual:** final (lihat §1) — bukan biru-600 polos
**Basis:** audit kode nyata + tangkapan layar live (`sidebar-expanded.png`, `debug-after-login.png`)
**Terkait:** `docs/2026-10-05_plan-redesign-halaman.md` (plan konsistensi — komplementer, bukan pengganti)

---

## 0. Kenapa terasa "AI slop" (diagnosis)

Bukan karena jelek. Justru karena **terlalu seragam dan tanpa identitas** — persis
tampilan default dashboard yang di-generate AI:

| Gejala | Bukti di kode |
|---|---|
| **Biru di mana-mana, saturasi rendah** | `body{background:#eff6ff}`, `border-blue-100`, `text-blue-400`/`text-blue-900` (App.tsx), `sky-*` (ChatPanel/CatalogSidebar), `slate-*` (Sidebar) — **3 keluarga warna** |
| **Kartu putih rounded + shadow halus seragam** | tiap kartu `rounded-xl border bg-white shadow-*`; header `shadow-[0_1px_3px_rgba(0,0,0,0.04)]`, `shadow-lg shadow-blue-900/5`, `shadow-2xs`, `shadow-xs` — **5 jenis shadow** |
| **Radius campur** | `rounded-lg` / `rounded-xl` / `rounded-2xl` untuk kartu sejenis |
| **Badge/pill berlebihan** | "8 widget", "RAG Aktif", "Studio", badge merah — banyak, sedikit yang fungsional |
| **Emoji sebagai ikon** | `KpiCard.tsx:216` → `{capaianPct}% ✓` |
| **Branding pecah** | `<title>AionesBoard</title>` & Login "Portal AionesBoard" vs Sidebar "ApexPulse Studio" |
| **CTA bersaing** | "RAG Copilot" & "Bagikan" dua-duanya biru solid, bobot visual sama |

**Inti masalah:** tidak ada satu keputusan visual yang berani. Semua "aman" →
hasilnya generik. Anti-slop = **berani memilih, lalu taat pada pilihan itu.**

---

## 1. Arah visual yang diusulkan — "Institutional Terminal"

Bukan gradien ungu, bukan glassmorphism, bukan neo-brutalism. Arahnya:
**terminal data institusi** — tenang, padat, presisi, seperti laporan keuangan
premium / alat operasional profesional.

### 1.1 Prinsip (berlaku semua halaman)

1. **Satu aksen, dipakai hemat.** Warna aksen HANYA untuk: tombol primer, nav aktif, link. Sisanya netral.
2. **Flat, bukan mengambang.** Kartu = 1px border hairline, **tanpa shadow**. Kedalaman dari border & latar, bukan bayangan.
3. **Sidebar gelap solid.** Kontras struktural (bukan warna-warni) yang membedakan shell dari kanvas.
4. **Warna = makna, bukan dekorasi.** Hijau/merah/amber hanya untuk data (naik/turun/peringatan).
5. **Tipografi yang membawa bobot.** Angka besar & tabular, judul rapat, label kecil ber-track.
6. **Kepadatan terkontrol.** Skala 4px, padding konsisten, buang pill yang tak berguna.

### 1.2 Token (`src/index.css` — Tailwind v4 `@theme`)

```css
@theme {
  /* Kanvas & permukaan */
  --color-canvas:      #f6f7f9;   /* netral, BUKAN biru */
  --color-surface:     #ffffff;
  --color-surface-2:   #f9fafb;

  /* Garis */
  --color-line:        #e4e7ec;   /* hairline kartu */
  --color-line-strong: #d0d5dd;   /* pemisah tegas */

  /* Teks */
  --color-ink:         #101828;
  --color-ink-2:       #475467;
  --color-ink-3:       #98a2b3;

  /* Aksen — satu saja */
  --color-brand:       #2c4bd8;   /* indigo-biru tegas (bukan #2563eb generik) */
  --color-brand-ink:   #1e34a8;
  --color-brand-soft:  #eef1fe;

  /* Semantik data */
  --color-pos:  #059669;  --color-neg: #e11d48;  --color-warn: #d97706;

  /* Shell */
  --color-shell:      #101828;   /* sidebar gelap */
  --color-shell-2:    #1d2939;
  --color-shell-line: #344054;

  /* Radius */
  --radius-card: 12px;  --radius-control: 8px;  --radius-chip: 6px;

  /* Elevasi: HANYA untuk elemen melayang (dropdown/modal) */
  --shadow-pop: 0 8px 24px rgb(16 24 40 / 0.12);
}
```

### 1.3 Perubahan kunci per area

| Area | Sebelum | Sesudah |
|---|---|---|
| Body | `#eff6ff` (biru muda) | `#f6f7f9` (netral) |
| Sidebar | putih + `slate` | **solid `#101828`**, teks terang, aktif = bar aksen kiri |
| Kartu | putih + border + `shadow-*` | putih + **border `#e4e7ec`, tanpa shadow** |
| Header | `border-blue-100` + shadow | border hairline, **flat** |
| Tombol primer | biru solid di banyak tempat | aksen `#2c4bd8`, **hanya 1 CTA per layar** |
| KPI | sparkline gradien biru + `✓` | sparkline tipis, delta pakai warna semantik, ganti `✓` → ikon `Check` lucide |
| Radius | campur 3 tingkat | kartu 12 / kontrol 8 / chip 6 |

---

## 2. Fase pengerjaan

> Satu fase selesai + diverifikasi visual → baru lanjut. Tiap fase = 1 commit.

### Fase 0 — Token + kanvas (½ hari)
- Tambah `@theme` + `@utility card / btn-primary / btn-ghost / chip` di `index.css`
- Body → `--color-canvas`
- **Verifikasi:** `npm run build` sukses, tampilan belum berubah drastis (token dulu)

### Fase 1 — Shell & sidebar gelap (½ hari) ⭐ dampak terbesar
- `Sidebar.tsx` → solid dark shell, nav aktif = bar aksen kiri, buang `sky-*`
- `App.tsx` header → flat hairline, samakan aksen
- **Verifikasi:** screenshot sidebar collapsed + expanded

### Fase 2 — Kartu & toolbar flat (½ hari)
- Semua kartu → `@utility card` (tanpa shadow)
- Toolbar dashboard (`App.tsx` L888+) → flat, kurangi pill
- **Verifikasi:** screenshot workspace

### Fase 3 — Satukan aksen di Chat/Katalog/Admin (½ hari)
- `ChatPanel.tsx`, `CatalogSidebar.tsx`, `Admin.tsx`: `sky-*` → `--color-brand`
- **Verifikasi:** `npx tsx scripts/qa-demo-ui.ts`

### Fase 4 — Branding tunggal (¼ hari)
- `index.html` title, Login, ShareView, ExportModal → "ApexPulse"
- `BrandMark` seragam
- **Verifikasi:** cek `/share`, login

### Fase 5 — Detail & polish (½ hari)
- Ganti emoji `✓` → ikon `Check`
- Samakan durasi/easing hover (150ms ease-out), fokus ring `:focus-visible`
- Kontras AA (axe)
- **Verifikasi:** Lighthouse a11y + screenshot 360/768/1440

---

## 3. Aturan main

1. Satu fase = satu commit, pesan jelas. **Jangan `git add -A`.**
2. **Jangan sentuh logika** (`server.ts`, `services/rag/*`, `services/builder/*`) — murni presentasi.
3. Komponen widget (KpiCard/Chart/DataTable) hanya disentuh di **Fase 5** (emoji & warna), bukan struktur.
4. Semua warna lewat token — dilarang tulis `sky-500`/`blue-600` langsung di JSX.
5. Visual memburuk → `git revert` fase itu, jangan menambal.

---

## 4. Cara melihat hasil

> Server `:3000` menyajikan **`dist/`** (lihat `server.ts:1208`). Perubahan `src/`
> TIDAK langsung tampil.

```
npm run build   # lalu refresh http://localhost:3000
```

Screenshot verifikasi: `npx tsx scripts/tmp-capture-sidebar.ts`.

---

## 5. Risiko

| Risiko | Mitigasi |
|---|---|
| Sidebar gelap ditolak user | Fase 1 = commit terpisah, mudah revert |
| Token Tailwind v4 tak dikenal | Bukti di 1 file dulu, baru massalkan |
| Waktu mepet | Fase 0–2 sudah memberi lompatan visual terbesar |
| "Menarik" itu subjektif | Konfirmasi arah dulu sebelum eksekusi |
