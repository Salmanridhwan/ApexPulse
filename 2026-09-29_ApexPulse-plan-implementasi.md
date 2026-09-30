# ApexPulse — Plan Implementasi Bertahap

> **Untuk Hermes:** jalankan fase secara berurutan. Setiap fase punya daftar file
> dan langkah verifikasi sendiri. Jangan lanjut ke fase berikutnya sebelum
> verifikasi fase saat ini lulus.

**Goal:** Membangun ApexPulse — aplikasi web yang membuat dashboard otomatis dari
data RAG lewat antarmuka chat, dan dashboard itu bisa dikustomisasi sepenuhnya
oleh pengguna. Siap didemokan ke BUMD pada Jumat, 2 Oktober 2026.

**Architecture:** **Tidak ada LLM di sisi kita.** Seluruh kecerdasan berasal dari
API RAG milik tim lain (satu kunci: `RAG_API_KEY`). Node.js + Express menjadi
orkestrator: membungkus permintaan pengguna menjadi instruksi ke API RAG,
memvalidasi keluarannya dengan zod, dan menyediakan fallback deterministik kalau
keluarannya tidak terstruktur. React + Vite hanya merender Widget Spec JSON.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind, ECharts,
react-grid-layout, Zustand, TanStack Query | Node + Express + TypeScript,
Prisma, PostgreSQL, zod, SSE, JWT + bcrypt, Nodemailer (SMTP).

**Repo:** `C:\Salman\PROJEK\ApexPulse`
**PRD:** `C:\Salman\AI Agent\.hermes\plans\2026-09-29_PRD-dashboard-otomatis-rag-bumd.md`

**Deploy:** panel Kroombox, akun **allstartup** (`allstartup@kroombox.com`)

**Alokasi waktu:** Selasa 29 Sep (sisa hari) → Jumat 2 Okt. Solo.

---

## Keputusan Arsitektur yang Mengikat Semua Fase

1. **Tidak ada kunci LLM di aplikasi ini.** Satu-satunya kunci eksternal adalah
   `RAG_API_KEY`.
2. **Dua jalur wajib didukung**, karena kemampuan API RAG belum diketahui:
   - **Jalur A** — API RAG punya LLM dan mau mengeluarkan JSON saat diminta.
     Jalur utama, kualitas terbaik.
   - **Jalur B** — API RAG hanya retrieval (chunk + metadata, tanpa LLM).
     Dashboard disusun dari **agregasi metadata**, tanpa AI sama sekali.
3. **Prompt adalah aset utama.** Prompt kita = instruksi ke API RAG, bukan
   panggilan model. Simpan terpusat di `server/src/services/rag/prompts.ts`
   supaya bisa dituning cepat saat API aslinya tersedia.
4. **Fallback berlapis**, urut: validasi lolos → ulang sekali → agregasi
   metadata → dashboard contoh tersimpan. Demo tidak boleh pernah kosong.

---

## Struktur Repo Target

```
ApexPulse/
├─ server/
│  ├─ prisma/schema.prisma
│  ├─ src/
│  │  ├─ index.ts
│  │  ├─ config/env.ts
│  │  ├─ db/client.ts
│  │  ├─ middleware/{auth,error}.ts
│  │  ├─ routes/{auth,chat,dashboards,widgets,catalog,export,share,alerts,admin}.routes.ts
│  │  ├─ services/
│  │  │  ├─ rag/{types,mock,http,prompts,index}.ts
│  │  │  ├─ spec/{widgetSpec,widgetTypes}.ts
│  │  │  ├─ builder/{fromJson,fromMetadata,fallback}.ts
│  │  │  ├─ generate.ts
│  │  │  ├─ cache.ts
│  │  │  ├─ mailer.ts
│  │  │  └─ alerts.ts
│  │  ├─ seed/{catalog,mockData,demoUser,demoDashboards}.ts
│  │  └─ utils/sse.ts
│  ├─ scripts/probe-rag.ts
│  └─ .env
├─ web/
│  ├─ src/
│  │  ├─ main.tsx, App.tsx
│  │  ├─ pages/{Login,DashboardList,Workspace,ShareView,Admin}.tsx
│  │  ├─ components/
│  │  │  ├─ ChatPanel.tsx
│  │  │  ├─ DashboardCanvas.tsx
│  │  │  ├─ widgets/{WidgetCard,WidgetRenderer,ChartEcharts,KpiCard,DataTable,NarasiCard}.tsx
│  │  │  ├─ WidgetEditor.tsx
│  │  │  ├─ CatalogSidebar.tsx
│  │  │  ├─ GlobalFilters.tsx
│  │  │  ├─ AlertsPanel.tsx
│  │  │  └─ SourceDrawer.tsx
│  │  └─ lib/{api,widgetSpec,store}.ts
│  └─ .env
└─ deploy/ecosystem.config.cjs
```

---

# FASE 0 — Fondasi (Selasa 29 Sep)

> **Goal:** Repo jalan, database tersambung, bisa login, dan mock RAG berisi data
> BUMD siap dipakai di kedua jalur.

**Scope:** setup repo, skema database, autentikasi, adapter RAG + mock dua jalur,
skrip probe. **Belum ada UI dashboard.**

### Rangkuman File

| # | File | Aksi | Deskripsi |
|---|------|------|-----------|
| 1 | `server/package.json` | Create | Dependency backend |
| 2 | `server/src/config/env.ts` | Create | Validasi env dengan zod |
| 3 | `server/prisma/schema.prisma` | Create | 12 tabel (lihat PRD Bab 9.4) |
| 4 | `server/src/db/client.ts` | Create | Instance Prisma |
| 5 | `server/src/services/rag/types.ts` | Create | Interface `RagClient`, `RagResult` |
| 6 | `server/src/services/rag/prompts.ts` | Create | Template instruksi ke API RAG |
| 7 | `server/src/services/rag/mock.ts` | Create | Mock **dua mode**: struktur & prosa |
| 8 | `server/src/services/rag/http.ts` | Create | Adapter HTTP ke API RAG asli |
| 9 | `server/src/services/rag/index.ts` | Create | Pemilih adapter via env |
| 10 | `server/src/services/spec/widgetSpec.ts` | Create | Skema zod Widget Spec |
| 11 | `server/src/middleware/auth.ts` | Create | Verifikasi JWT |
| 12 | `server/src/routes/auth.routes.ts` | Create | Login, logout, me |
| 13 | `server/src/seed/demoUser.ts` | Create | Admin + 1 user demo |
| 14 | `server/src/index.ts` | Create | Bootstrap Express |
| 15 | `server/scripts/probe-rag.ts` | Create | Uji kemampuan API RAG asli |
| 16 | `web/*` | Create | Vite React TS + Tailwind + halaman login |

### Task 0.1 — Inisialisasi repo

```bash
mkdir -p "C:/Salman/PROJEK/ApexPulse" && cd "C:/Salman/PROJEK/ApexPulse"
git init
npm create vite@latest web -- --template react-ts
mkdir -p server && cd server && npm init -y
```

**Verifikasi:** `ls` menampilkan `web/` dan `server/`; `git status` bersih setelah
commit pertama.

### Task 0.2 — Dependency backend

```bash
cd "C:/Salman/PROJEK/ApexPulse/server"
npm i express cors helmet morgan jsonwebtoken bcryptjs zod @prisma/client dotenv nodemailer
npm i -D typescript tsx @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/nodemailer prisma
npx tsc --init
```

**Verifikasi:** `npx tsx -e "console.log('ok')"` mencetak `ok`.

### Task 0.3 — Skema database

Buat `prisma/schema.prisma` dengan model: `Tenant`, `User`, `ChatSession`,
`ChatMessage`, `Dashboard`, `Widget`, `WidgetCatalog`, `SourceCache`,
`AlertRule`, `Notification`, `ShareLink`, `AuditLog`.

```bash
npx prisma migrate dev --name init
npx prisma generate
```

**Verifikasi:** `npx prisma studio` terbuka dan 12 tabel terlihat.

### Task 0.4 — Adapter RAG + mock dua jalur

- `types.ts` sesuai PRD Bab 9.2 (`RagClient`, `RagResult`).
- `prompts.ts`: seluruh instruksi ke API RAG terpusat di sini.
- `mock.ts` mendukung **dua mode** lewat env `MOCK_RAG_MODE=structured|prose`:
  - `structured` → meniru Jalur A (chunk + metadata lengkap + jawaban JSON)
  - `prose` → meniru Jalur B (hanya prosa)
  Data realistis untuk **seluruh enam sektor** (PDAM, pasar, bank daerah, RS,
  transportasi, aneka usaha), minimal 12 bulan per metrik.
- `index.ts`: `env.RAG_PROVIDER === 'http' ? httpRag : mockRag`

**Verifikasi:**

```bash
MOCK_RAG_MODE=structured npx tsx -e "import('./src/services/rag').then(async m => { const r = await m.rag.query({prompt:'pendapatan pdam 2026'}); console.log(r.chunks.length, r.chunks[0]?.metadata); })"
MOCK_RAG_MODE=prose npx tsx -e "import('./src/services/rag').then(async m => { const r = await m.rag.query({prompt:'pendapatan pdam 2026'}); console.log(r.answer?.slice(0,80)); })"
```

Keduanya harus mengembalikan bentuk yang benar. **Ini penting** — aplikasi harus
lulus di kedua mode, karena kita belum tahu API aslinya yang mana.

### Task 0.5 — Skrip probe API RAG

`scripts/probe-rag.ts` menjalankan 5 uji begitu `RAG_API_KEY` asli tersedia:

1. Bisa dihubungi? (status, latensi)
2. Menerima instruksi bebas, atau hanya pertanyaan?
3. Mengembalikan chunk + metadata, atau hanya prosa?
4. Kalau diminta JSON, apakah benar-benar JSON yang valid?
5. Metadata berisi `periode`, `nilai`, `kategori`, `unit_kerja`?

Keluaran: ringkasan Jalur A / Jalur B + rekomendasi konfigurasi.

**Verifikasi:** `npx tsx scripts/probe-rag.ts` berjalan dengan `RAG_PROVIDER=mock`
dan mencetak laporan lengkap.

### Task 0.6 — Auth

- `POST /api/auth/login` → `{ token, user }`, password bcrypt.
- `GET /api/me` → data user dari token.
- `middleware/auth.ts` → `requireAuth`, `requireAdmin`.
- Seed: `admin@apexpulse.id` (admin) dan `demo@apexpulse.id` (user), kedua
  password lewat env seed.

**Verifikasi:**

```bash
curl -s -X POST localhost:3005/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"demo@apexpulse.id","password":"<seed>"}' | head -c 200
```
Harus mengembalikan token. Lalu `GET /api/me` dengan token itu harus
mengembalikan user yang sama; tanpa token harus 401.

### Task 0.7 — Bootstrap server

`src/index.ts`: express + helmet + cors + morgan + json, mount routes,
`GET /health` → `{ status: 'ok', db: true }` (cek koneksi Prisma).

**Verifikasi:** `curl -s localhost:3005/health` → `{"status":"ok","db":true}`.

---

# FASE 1 — Kanvas & Katalog Widget (Rabu 30 Sep)

> **Goal:** Dashboard bisa dibuat dari JSON statis, widget bisa digeser/diubah
> ukurannya, dan katalog widget per jenis BUMD muncul di sidebar.

**Scope:** renderer widget, kanvas grid, CRUD dashboard, katalog. **Belum ada AI
maupun API RAG.**

### Rangkuman File

| # | File | Aksi | Deskripsi |
|---|------|------|-----------|
| 1 | `server/src/seed/catalog.ts` | Create | 40 preset widget (PRD Bab 6) |
| 2 | `server/src/routes/catalog.routes.ts` | Create | `GET /api/widget-catalog` |
| 3 | `server/src/routes/dashboards.routes.ts` | Create | CRUD dashboard |
| 4 | `server/src/routes/widgets.routes.ts` | Create | CRUD widget per dashboard |
| 5 | `server/src/seed/demoDashboards.ts` | Create | Dashboard contoh semua sektor |
| 6 | `web/src/lib/api.ts` | Create | Klien fetch + token |
| 7 | `web/src/components/DashboardCanvas.tsx` | Create | react-grid-layout |
| 8 | `web/src/components/widgets/WidgetRenderer.tsx` | Create | Dispatcher tipe widget |
| 9 | `web/src/components/widgets/ChartEcharts.tsx` | Create | line/area/bar/donut/heatmap |
| 10 | `web/src/components/widgets/KpiCard.tsx` | Create | Kartu KPI + delta |
| 11 | `web/src/components/widgets/DataTable.tsx` | Create | Tabel sortable |
| 12 | `web/src/components/widgets/NarasiCard.tsx` | Create | Teks + sitasi |
| 13 | `web/src/components/CatalogSidebar.tsx` | Create | Katalog per jenis BUMD |
| 14 | `web/src/pages/DashboardList.tsx` | Create | Daftar dashboard |
| 15 | `web/src/pages/Workspace.tsx` | Create | Kanvas + sidebar |

### Task 1.1 — Seed katalog widget

Isi `catalog.ts` dengan seluruh preset dari PRD Bab 6: universal W-01..W-14,
PDAM P-01..P-06, pasar M-01..M-05, bank daerah B-01..B-06, RS R-01..R-05,
transportasi T-01..T-04. Tiap entri: `id`, `nama`, `sektor[]`, `tipeChart[]`,
`mappingDefault`, `queryRagContoh`, `satuan`.

**Verifikasi:** `curl -s localhost:3005/api/widget-catalog | jq '.[] | .id' | wc -l`
→ 40.

### Task 1.2 — Renderer widget

`WidgetRenderer` menerima Widget Spec dan memilih komponen berdasarkan `type`.
Validasi spec dengan zod yang sama seperti di server (`web/src/lib/widgetSpec.ts`
menyalin skema).

**Verifikasi:** buka halaman dev dengan spec contoh untuk **setiap** tipe widget
(`kpi`, `line`, `bar`, `donut`, `table`, `narasi`, `bullet-target`) — semuanya
tampil tanpa error di console.

### Task 1.3 — Kanvas grid

react-grid-layout: `draggableHandle`, `onLayoutChange` → `PATCH /api/dashboards/:id`
menyimpan layout. Tiap widget punya menu: edit, duplikat, sembunyikan, hapus.

**Verifikasi:** geser dan ubah ukuran widget, muat ulang halaman — posisinya
tetap seperti terakhir.

### Task 1.4 — CRUD dashboard

`GET/POST/PATCH/DELETE /api/dashboards`, `POST /api/dashboards/:id/duplicate`,
filter `tenant_id` di setiap query.

**Verifikasi:** buat 2 dashboard, duplikat satu, hapus satu, muat ulang daftar —
hanya yang benar tersisa.

### Task 1.5 — Dashboard contoh semua sektor

Minimal 2 dashboard contoh per sektor, tersimpan sebagai snapshot JSONB.

**Verifikasi:** setiap dashboard contoh terbuka tanpa widget kosong atau `NaN`.

### Task 1.6 — Uji isolasi tenant (WAJIB)

Buat user di tenant kedua, pastikan `GET /api/dashboards/:id` milik tenant
pertama mengembalikan 404/403.

**Verifikasi:** manual dengan dua akun berbeda. Ini tidak boleh lolos ke hari
Jumat — kebocoran antar instansi adalah risiko paling serius di PRD Bab 13.

---

# FASE 2 — Chat & Generator Otomatis (Kamis 1 Okt)

> **Goal:** Menulis di chat menghasilkan dashboard. Menulis perintah lanjutan
> mengubah dashboard.

**Scope:** endpoint chat (SSE), instruksi ke API RAG, validasi, fallback
berlapis, sitasi, label kepercayaan, edit widget, filter global, export, share.
**Fase paling padat.**

### Rangkuman File

| # | File | Aksi | Deskripsi |
|---|------|------|-----------|
| 1 | `server/src/services/spec/widgetTypes.ts` | Create | Tipe & enum widget |
| 2 | `server/src/services/builder/fromJson.ts` | Create | Jalur A: keluaran JSON → Widget Spec |
| 3 | `server/src/services/builder/fromMetadata.ts` | Create | Jalur B: agregasi metadata → Widget Spec |
| 4 | `server/src/services/builder/fallback.ts` | Create | Jatuh ke dashboard contoh |
| 5 | `server/src/services/generate.ts` | Create | Orkestrasi + urutan fallback |
| 6 | `server/src/services/cache.ts` | Create | Cache ber-TTL hasil RAG |
| 7 | `server/src/utils/sse.ts` | Create | Helper streaming |
| 8 | `server/src/routes/chat.routes.ts` | Create | `POST /api/chat` (SSE) |
| 9 | `web/src/components/ChatPanel.tsx` | Create | UI chat + progres bertahap |
| 10 | `web/src/components/WidgetEditor.tsx` | Create | Ubah metrik/dimensi/tipe |
| 11 | `web/src/components/GlobalFilters.tsx` | Create | Filter periode/unit/kategori |
| 12 | `web/src/components/SourceDrawer.tsx` | Create | Panel sitasi |
| 13 | `server/src/routes/export.routes.ts` | Create | PDF & PNG |
| 14 | `server/src/routes/share.routes.ts` | Create | Link read-only |

### Task 2.1 — Validator Widget Spec

Skema zod lengkap (PRD Bab 9.3), dipakai server dan disalin ke frontend.

**Verifikasi:** spec valid lolos, spec cacat ditolak dengan pesan yang bisa dibaca.

### Task 2.2 — Jalur A: dari JSON

`fromJson.ts` memvalidasi keluaran API RAG. Aturan: `presetId` harus ada di
katalog; angka tanpa `citations` dibuang.

**Verifikasi:** dengan `MOCK_RAG_MODE=structured`, prompt "dashboard kinerja PDAM
2026" menghasilkan 6-8 widget valid dengan sitasi.

### Task 2.3 — Jalur B: dari metadata

`fromMetadata.ts` mengagregasi `periode` + `nilai` per `kategori`/`unit_kerja`
tanpa AI. `confidence` diset `sumber` karena angkanya diambil dari metadata
dokumen.

**Verifikasi:** dengan `MOCK_RAG_MODE=prose` **plus** metadata, widget tetap
terbentuk dan angkanya konsisten dengan sumber mock.

### Task 2.4 — Orkestrasi + urutan fallback

`generate.ts`: instruksi → API RAG → validasi → (ulang sekali) → agregasi
metadata → dashboard contoh. Setiap perpindahan jalur dicatat di log supaya
ketahuan jalur mana yang sedang dipakai.

**Verifikasi:** matikan metadata di mock → aplikasi tetap menampilkan dashboard
(masuk ke fallback terakhir), tidak pernah halaman kosong.

### Task 2.5 — Chat + SSE

`POST /api/chat` streaming progres: `menerjemahkan permintaan → mengambil data →
menyusun angka → selesai`. Batas 60 detik sesuai PRD.

**Verifikasi:** waktu generate ≤ 1 menit dan progres terlihat bertahap, bukan
menggantung tanpa umpan balik.

### Task 2.6 — Chat sebagai editor

Pengenalan perintah: bangun / tambah / hapus / ubah / regenerate. Ubah prompt →
dipakai untuk memodifikasi satu widget saja.

**Verifikasi:** "hapus widget arus kas" menghapus tepat satu widget; "ganti tren
pendapatan jadi diagram batang" mengubah tipe hanya widget itu.

### Task 2.7 — Editor langsung & filter global

Editor langsung (tanpa chat): ganti metrik, dimensi, tipe chart, rentang.
Filter global di level dashboard berlaku ke semua widget, tampil sebagai chip.

**Verifikasi:** ubah satu widget lewat editor (nilainya berubah), lalu set filter
global `periode=2026-Q1` dan pastikan semua widget ikut berubah.

### Task 2.8 — Sitasi & label kepercayaan

Tombol "lihat sumber" di setiap widget membuka drawer berisi chunk asal, nama
dokumen, halaman. Label `sumber` / `inferensi AI` terlihat jelas di kartu widget.

**Verifikasi:** tiap widget hasil generate punya minimal 1 sitasi yang bisa
dibuka.

### Task 2.9 — Export PDF & PNG

PNG: capture kanvas. PDF: kanvas + header instansi + judul + periode aktif +
tanggal cetak + lampiran sitasi.

**Verifikasi:** hasilkan keduanya, buka filenya, pastikan angka PDF sama dengan
yang di layar.

### Task 2.10 — Share link read-only

`POST /api/dashboards/:id/share` → token acak; `DELETE /api/share/:token` →
cabut. Halaman publik tanpa login.

**Verifikasi:** buka link di jendela private mode — tampil; cabut token — jadi 404.

---

# FASE 3 — Alert, Data Demo & Poles (Jumat 2 Okt, pagi)

> **Goal:** Demo mulus untuk semua sektor, dengan alert dua kanal berjalan.

**Scope:** mailer + alert in-app/email, koreksi manual, panel admin, lengkapi
data demo, uji skenario.

### Rangkuman File

| # | File | Aksi | Deskripsi |
|---|------|------|-----------|
| 1 | `server/src/services/mailer.ts` | Create | Nodemailer + SMTP dari env |
| 2 | `server/src/services/alerts.ts` | Create | Evaluasi ambang + antrean kirim |
| 3 | `server/src/routes/alerts.routes.ts` | Create | CRUD aturan alert |
| 4 | `server/src/routes/admin.routes.ts` | Create | Kelola user |
| 5 | `web/src/components/AlertsPanel.tsx` | Create | Lonceng + daftar notifikasi |
| 6 | `web/src/pages/Admin.tsx` | Create | Panel admin sederhana |
| 7 | `server/src/seed/mockData.ts` | Modify | Lengkapi 6 sektor × 12 bulan |
| 8 | `web/src/components/WidgetEditor.tsx` | Modify | Koreksi manual angka (F-14) |

### Task 3.1 — Mailer + alert dua kanal

SMTP dari env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
Notifikasi dikirim ke **in-app dan email**, lewat antrean sederhana supaya tidak
memblokir permintaan HTTP.

**Verifikasi:** set "NPL > 5%", data mock melewati ambang → notifikasi in-app
muncul **dan** email benar-benar sampai ke kotak masuk, bukan sekadar masuk log.

### Task 3.2 — Koreksi manual angka

Nilai bisa ditimpa, ditandai `dikoreksi manual` + siapa + kapan; nilai asli tetap
tersimpan.

**Verifikasi:** timpa satu angka, muat ulang — tanda dan nilainya tetap ada.

### Task 3.3 — Lengkapi data demo

Enam sektor × minimal 12 bulan, plus 2 dashboard contoh per sektor.
**Ini jaring pengaman utama kalau API RAG bermasalah saat demo.**

**Verifikasi:** buka semua dashboard contoh — tidak ada widget kosong atau `NaN`.

### Task 3.4 — Uji skenario demo (PRD Bab 11)

Jalankan 7 langkah skenario demo 3 kali berturut-turut tanpa error.

**Verifikasi:** ketiganya lancar. Satu kegagalan saja → perbaiki sebelum lanjut.

---

# FASE 4 — Deploy ke Panel Kroombox (Jumat 2 Okt, siang)

> **Goal:** ApexPulse hidup di panel akun allstartup, siap dipresentasikan.

Ikuti skill `kroombox-panel-deploy`. Kunci API akun allstartup tersimpan di
`C:/Salman/AI Agent/hermes-knowledge-export/agent-freebuff/mcp/.env`
(baris `KB_KEY_AKUN2`) — panggil dengan `export KB_KEY=...`; tanpa `export`
client-nya error "set env KB_KEY".

**Scope:** build produksi, PostgreSQL panel, PM2, health check, uji akhir dari
internet.

### Task 4.1 — Build produksi
`npm run build` di `web/`, server dijalankan dengan `tsx`/`dist`, server
menyajikan `web/dist` sebagai static.

**Verifikasi:** build tanpa error; mode produksi di lokal jalan (`npm run server`).

### Task 4.2 — Site + database di panel

Buat site Node + PostgreSQL lewat MCP panel. Untuk update berikutnya **jangan**
pakai `deploy_new_site` — pakai `kroombox_run_cicd_pipeline`.

`.env` di server (JANGAN commit): `DATABASE_URL`, `JWT_SECRET`, `RAG_PROVIDER`,
`RAG_API_URL`, `RAG_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`.

**Verifikasi:** `curl https://<domain>/health` → `{"status":"ok","db":true}`.

### Task 4.3 — Migrasi & seed di server
`npx prisma migrate deploy` + seed katalog, demo user, dan dashboard contoh.

**Verifikasi:** login dari domain publik, dashboard contoh terbuka.

### Task 4.4 — Uji akhir
Jalankan skenario demo dari perangkat lain (bukan laptop yang dipakai ngoding).

**Verifikasi:** 7 langkah skenario demo lulus dari domain publik.

### Task 4.5 — Swap ke API RAG asli (kalau kunci sudah tersedia)

Jalankan `scripts/probe-rag.ts` dengan kunci asli → tentukan Jalur A atau B → set
`RAG_PROVIDER=http` + `RAG_API_URL` + `RAG_API_KEY` → uji ulang skenario demo.

**Verifikasi:** dashboard hasil generate dari API RAG asli tampil, dan log
mencatat jalur mana yang dipakai. Kalau mati atau lambat, **kembalikan**
`RAG_PROVIDER=mock` untuk demo — jangan mempertaruhkan presentasi pada API yang
belum terbukti.

---

# FASE 5 — Pasca-demo (setelah Jumat)

Ditampilkan sebagai "segera hadir" pada presentasi, **tidak dikerjakan
setengah jalan**:

- F-18 Laporan terjadwal via email (memakai mailer Fase 3)
- F-21 Audit log
- F-22 Versi / bekukan dashboard per periode
- RBAC per unit kerja
- Integrasi penuh API RAG asli setelah probe menentukan jalurnya

---

## Aturan yang Berlaku di Semua Fase

1. **Tidak ada kunci LLM di repo ini.** Satu-satunya sumber kecerdasan: API RAG.
2. **Tidak ada HTML/JS/SQL yang dieksekusi** dari keluaran mana pun. Hanya JSON
   yang lolos zod yang dirender.
3. **Setiap angka wajib punya sitasi.** Angka tanpa sitasi dibuang.
4. **Kunci RAG hanya di backend.** Tidak pernah sampai ke browser.
5. **Setiap query difilter `tenant_id`.**
6. **Commit hanya file sendiri**, jangan `git add -A`.
7. **Verifikasi berarti menjalankan perintahnya dan melihat hasilnya**, bukan
   "seharusnya jalan".
8. Gagal dua kali berturut-turut → berhenti dan laporkan. Jangan mengakali dengan
   data palsu.

---

## Risiko Jadwal & Titik Putus

| Titik | Kalau meleset |
|---|---|
| Fase 0 belum selesai malam ini | Pangkas UI login jadi minimal; dashboard contoh statis jadi tumpuan demo |
| Fase 1 belum selesai Rabu malam | Turunkan jumlah tipe widget dari 7 jadi 4 (kpi, line, bar, table) |
| API RAG ternyata retrieval murni (Jalur B) | Dashboard berbasis agregasi metadata; ubah narasi pitching dari "tanya-jawab cerdas" menjadi "dashboard instan dari data yang sudah ada" |
| API RAG belum siap saat deadline | `RAG_PROVIDER=mock`; demo penuh tetap jalan. **Jangan pernah demo dengan API yang belum pernah diuji** |
| Email alert gagal terkirim | Kanal in-app tetap jalan; tampilkan sebagai "email sedang disiapkan" |
| Export belum jalan Kamis malam | Export PDF dihapus dari skenario demo, tampilkan sebagai "segera hadir" |
| Deploy panel gagal Jumat | Fallback: demo dari laptop lokal (localhost), siapkan jaringan cadangan |

**Aturan putus:** lebih baik demo 5 menit yang seluruhnya berjalan mulus daripada
demo 15 menit dengan fitur setengah jalan. Pangkas, jangan paksakan.
