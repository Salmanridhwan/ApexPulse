# Plan Redesign Konsisten — ApexPulse

**Tanggal:** 5 Oktober 2026
**Status:** usulan — belum dikerjakan
**Basis:** audit kode nyata `C:\Salman\PROJEK\ApexPulse` (bukan asumsi)

---

## 1. Apa yang sebenarnya happening (hasil audit)

Redesign 5 Okt sudah memperbaiki banyak hal, tapi **meninggalkan sisa yang
membuat halaman terasa seperti hasil penambalan (patchwork)**. Berikut temuan konkret:

### 1.1 Dua warna primer yang bertabrakan

Jumlah = total kemunculan kelas (`grep -o "sky-" file | wc -l`).

| Lokasi | Warna primer | Kemunculan |
|---|---|---|
| `App.tsx` (shell, header) | `blue-*` | dominan |
| `Sidebar.tsx` | `blue-*` + `sky-*` | campuran |
| `ChatPanel.tsx` | **`sky-*`** | 33 |
| `CatalogSidebar.tsx` | **`sky-*`** | 22 |
| `Admin.tsx` | **`sky-*`** + `slate-*` | 45 + 182 |

Artinya: sidebar app biru, tapi panel chat dan katalog biru **lebih muda**.
Mata pengguna menangkapnya sebagai "dua aplikasi berbeda".

### 1.2 Radius tidak seragam

| File | `rounded-lg` | `rounded-xl` | `rounded-2xl` |
|---|---|---|---|
| `App.tsx` | 17 | 3 | 1 |
| `Admin.tsx` | 32 | 15 | 9 |
| `ChatPanel.tsx` | 4 | 2 | 2 |
| `Login.tsx` | 5 | 1 | 0 |

Tiga tingkat radius untuk kartu yang sejenis. Terlihat "nempel-tempel".

### 1.3 Branding terbelah dua

```
1×  "ApexPulse Studio"     → Sidebar.tsx (produk)
3×  "AionesBoard Orchestrator" → ChatPanel.tsx
2×  "AionesBoard"          → ShareView.tsx, ExportModal.tsx
1×  "AionesBoard Admin"    → Admin.tsx
```

Halaman publik (`/share`) dan panel chat menyebut produk berbeda dengan sidebar.

### 1.4 Admin duplikat shell-nya sendiri

`Admin.tsx` (1156 baris) membangun `<aside>` sendiri dengan 6 tab
(`overview`, `users`, `tenants`, `rag`, `alerts`, `audit`) — sementara
halaman lain memakai sidebar global `App.tsx`. Akibatnya:

- Gaya sidebar berbeda: Admin gelap `slate-900`, sidebar global terang
- Typography header tidak sama: `Admin.tsx:273` `text-sm`, halaman lain `text-lg`–`text-2xl`
- **Dua cara berbeda untuk sampai ke Audit & Alert:**
  - Lewat sidebar global → `App.tsx:836-847` me-render `AuditLogPage` / `AlertsPage`
    sebagai halaman penuh (`viewMode === 'audit'`)
  - Lewat tab Admin → `Admin.tsx:870,922` me-render isi tab sendiri

  Keduanya hidup berdampingan. Bukan byte-identik, tapi **pengguna punya dua
  jalan berbeda ke data yang sama** — sumber utama rasa "patchwork".

### 1.5 Halaman tanpa skeleton & empty state seragam

- Skeleton/loading: **0** di `Admin`, `AlertsPage`, `AuditLogPage`, `DashboardList`, `Login`
- `AuditLogPage` & `DashboardList` punya teks "kosong"; `Admin` & `AlertsPage` tidak punya apa pun
- Judul error `ShareView:123` (`text-lg`) beda skala dengan judul normal (`text-2xl`)

---

## 2. Prinsip redesign

> **Satu sistem, bukan redesign per halaman.**

Aturan yang berlaku untuk SEMUA halaman:

1. **Satu warna primer.** Blue-600 `#2563eb` (bukan sky). Sky hanya untuk
   state informatif (aksen sekunder), bukan warna utama.
2. **Satu skala radius.** Kartu `rounded-xl`, kontrol `rounded-lg`, pil `rounded-full`.
3. **Satu nama produk di UI.** "ApexPulse" (nama internal `aionesboard`
   boleh tetap di kode/API).
4. **Satu shell.** Tidak ada halaman yang membangun `<aside>` sendiri.
5. **Satu tipografi judul.** H1 halaman `text-xl font-bold`.
6. **Skeleton + empty state wajib** di setiap halaman yang memuat data.
7. **Aksesibilitas dulu.** Semua interaksi wajib punya `aria-label`; kontras teks
   minimal AA (4.5:1).

---

## 3. Fase pengerjaan

> Pengerjaan **bertahap per fase**. Setiap fase selesai + diverifikasi sebelum
> lanjut. Jangan semua sekaligus — redesign 5 Okt gagal karena itu.

### Fase 0 — Fondasi design token (½ hari)

**Files:** `src/index.css`, `tailwind.config` (atau `@theme` di CSS v4), `src/index.html`

Buat token semantik supaya warna tidak lagi ditulis hardcode per file:

```css
@theme {
  /* Warna produk */
  --color-brand-50 ... --color-brand-950;   /* alias ke blue */
  --color-accent-*: ...                      /* sky, untuk state info */

  /* Radius */
  --radius-card: 0.75rem;    /* rounded-xl */
  --radius-control: 0.5rem;  /* rounded-lg  */
  --radius-pill: 9999px;

  /* Elevasi */
  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.04);
  --shadow-pop:  0 8px 24px rgb(15 23 42 / 0.12);
}

@utility card {          /* ganti seluruh kartu manual */
  @apply rounded-xl border border-slate-200 bg-white shadow-card;
}
@utility btn-primary { @apply rounded-lg bg-brand-600 text-white ...; }
@utility btn-ghost   { @apply rounded-lg border border-slate-200 ...; }
```

**Verifikasi:** `npm run build` sukses; belum ada perubahan visual →
tartanpa regresi. QA tetap hijau (pakai token, belum dihapus).

**Risiko:** rendah. Murni tambahan.

---

### Fase 1 — Satukan warna (½ hari)

**Files:** `ChatPanel.tsx`, `CatalogSidebar.tsx`, `Admin.tsx`, `Sidebar.tsx`

1. Ganti `sky-*` → `brand-*` (token Fase 0) di `ChatPanel` & `CatalogSidebar`
2. Rapikan `Admin.tsx`: `slate` dominan → white card + `slate-200` border
3. Samakan `border-*-100`abu-abu → `border-slate-200` di semua halaman

**Verifikasi:** `qa-demo-ui.ts` 12 langkah (memakai chat + katalog),
`tmp-uji-tanpa-sumber`, `tmp-uji-toolbox`.

**Risiko:** rendah–sedang. Warna tidak mengubah alur.

---

### Fase 2 — Satukan radius & tipografi (½ hari)

**Files:** semua `.tsx`

1. Kartu `rounded-2xl`/`rounded-lg` → `@utility card`
2. H1 semua halaman → `text-xl font-bold`
3. Samakan `text-sm` vs `text-lg` pada header tab

**Verifikasi:** QA yang sama + cek visual manual via screenshot.

**Risiko:** rendah.

---

### Fase 3 — Satukan shell & branding (1 hari) ⭐ paling berisiko

**Files:** `App.tsx`, `pages/Admin.tsx`, `pages/ShareView.tsx`

1. **Admin pakai sidebar global.** Buang `<aside>` + `activeTab` dari `Admin.tsx`;
   jadikan ia menerima `section` dari sidebar global. Untuk tab `alerts` &
   `audit`, **pakai ulang** `AlertsPage`/`AuditLogPage` yang sudah ada
   (lihat 1.4) alih-alih implementasi terpisah.
2. **Pecah `Admin.tsx`.** 1156 baris → 6 komponen
   (`OverviewTab`, `UsersTab`, `TenantsTab`, `RagTab`, `AlertsTab`, `AuditTab`)
   di `src/pages/admin/`. Wajib — file ini sulit di-review selama redesign.
3. **Branding tunggal.** `AionesBoard *` → `ApexPulse *` di teks UI.
   `BrandMark` dipakai seragam di Login, Sidebar, ShareView, ChatPanel.

**Verifikasi:** `qa-demo-ui` L11 (panel admin) + login manual + cek `/share`.

**Risiko:** **sedang–tinggi.** Ini menyentuh alur admin. Kerjakan sebagai
commit terpisah, dengan `git revert` siap kalau hasilnya buruk.

---

### Fase 4 — State layer seragam (1 hari)

**Files:** semua halaman

1. Komponen `Skeleton` (kartu, tabel, grafik) — dipakai semua halaman
2. Komponen `EmptyState` (ikon, judul, kalimat pendukung, 1 aksi)
   Ganti teks kosong manual di `AuditLogPage` & `DashboardList`
3. `ErrorState` seragam — `ShareView:123` samakan skalanya

**Verifikasi:** throttle jaringan di DevTools → pastikan skeleton tampil.

**Risiko:** rendah.

---

### Fase 5 — Polish visual (1 hari)

1. Transisi & hover konsisten (satu durasi, satu easing)
2. Fokus ring pada semua elemen interaktif (`:focus-visible`)
3. Contrast check (axe DevTools)
4. Scan responsif 360 / 768 / 1440

**Verifikasi:** Lighthouse a11y; QA desktop + screenshot mobile.

**Risiko:** rendah.

---

## 4. Aturan main

| # | Aturan |
|---|---|
| 1 | Satu fase selesai + QA hijau → baru lanjut. Jangan menumpuk. |
| 2 | Setiap fase = 1 commit terpisah, pesan jelas. Jangan `git add -A`. |
| 3 | Jangan redesign komponen widget (KPI/chart) dulu — itu inti produk, bukan kaos. |
| 4 | Kalau visual memburuk, revert fase itu. Jangan menambal unbelakang. |
| 5 | Semua warna lewat token. Dilarang tulis `sky-500` langsung di JSX. |

---

## 5. Yang tidak boleh ikut disentuh

- `server.ts` — redesign murni presentasi
- `services/builder/*`, `services/rag/*` — logika RAG
- `pages/ShareView.tsx` **struktur data** (hanya gaya yang berubah)
- komponen widget (`KpiCard`, `ChartEcharts`, `DataTable`) — inti produk,
  sudah punya animasi & QA sendiri
- `chatStream` — alur chat sudah gagal 3× QA; jangan digabung dengan redesign

---

## 6. Risiko

| Risiko | Mitigasi |
|---|---|
| Fase 3 merusak alur admin | Commit terpisah; `git revert` kalau gagal |
| Terlalu banyak berubah sekaligus, sulit culprit | Satu fase = satu commit |
| Token Tailwind v4 tak dikenal | Bukti dulu di 1 file, baru massalkan |
| Waktu habis di tengah jalan | Fase 1–2 cukup untuk dampak visual terbesar (~80%) |

**Prioritas:** Kalau waktu mepet, **Fase 1 + 2 saja sudah memberi
peningkatan terbesar** — warna & radius yang seragam langsung terlihat
lebih "satu produk", walau shell Admin masih beda.