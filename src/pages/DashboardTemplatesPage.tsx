import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  LayoutTemplate,
  Loader2,
  Palette,
  Pause,
  Play,
  Presentation,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { BumdSector, Dashboard, ProgresIsiTemplate, Tenant, WidgetSpec } from '../types';
import {
  DASHBOARD_TEMPLATES,
  DashboardTemplate,
  KATEGORI_TEMPLATE,
  kategoriDariTemplate,
  jumlahTemplateGaleri,
  templateGaleri,
  widgetDariTemplate,
  type KategoriTemplateId,
} from '../services/templates/dashboardTemplates';
import { ReplikaHalaman } from '../components/referensi/ReplikaHalaman';
import { halamanTemplateBagian } from '../services/templates/templateBagian';
import { pesanGalatRamah } from '../services/ui/pesanGalat';
import { PresentationMode } from '../components/PresentationMode';
import { HalamanTabs } from '../components/HalamanTabs';
import {
  CONTOH_OPERASIONAL,
  nilaiOperasionalDariWidgets,
  sumberPerJudul,
} from '../services/templates/nilaiOperasional';
import { CONTOH_WILAYAH, type NilaiWilayah } from '../services/templates/wilayahLayanan';
import { AKSEN_TEMA, KanvasTemaContext } from '../theme';
import { GAYA, VARIAN, cukupTerang, tokenTemaDariGaya, type Varian } from '../services/chart/gayaVarian';

/**
 * Gaya Template Chart BAWAAN sebuah template.
 *
 * Gaya dipilih TERPISAH dari template: bawaannya `default` untuk semua template,
 * dan template hanya boleh menyarankan gaya lain lewat `gayaBawaan`. Kunci `tema`
 * tidak lagi dipakai untuk memilih gaya — `tema` mengatur warna kanvas dashboard
 * lama, sedangkan gaya mengatur desain chart dan latar halaman.
 */
const varianBawaanTemplate = (t: DashboardTemplate): Varian => t.gayaBawaan ?? 'default';

/**
 * Token CSS yang sama dengan kelas `.tema-<kunci>` di index.css, dihitung dari
 * satu gaya Template Chart. Dipasang langsung di wadah pratinjau supaya KARTU,
 * bingkai, dan aksen ikut berganti bersama grafiknya — kalau hanya konteks
 * varian yang diganti, grafik berubah tapi kartunya tetap warna template.
 */
const variabelGaya = (v: Varian): React.CSSProperties => tokenTemaDariGaya(v) as React.CSSProperties;
import {
  nilaiAnalitikDariWidgets,
  nilaiDariWidgets,
  nilaiTrafikDariWidgets,
} from '../services/templates/nilaiTemplate';

interface DashboardTemplatesPageProps {
  currentTenant: Tenant | null;
  /**
   * Progres pengisian angka dari dokumen. Pengisian bisa 5–15 menit karena kartu
   * yang gagal (layanan sibuk) diulang sampai terisi — pengguna perlu melihat
   * sudah berapa kartu yang berisi angka.
   */
  progres?: ProgresIsiTemplate | null;
  /**
   * Buat dashboard baru dari template DENGAN ANGKA DARI DOKUMEN RAG, lalu buka
   * kanvasnya. Mengembalikan ringkasan berapa kartu terisi dari dokumen dan
   * berapa yang belum ada di dokumen; melempar galat bila layanan RAG gagal.
   */
  onUseTemplate: (
    template: DashboardTemplate,
    /** Gaya Template Chart pilihan pengguna — disimpan bersama dashboard. */
    gaya?: Varian
  ) => Promise<{ terisi: number; kosong: number; total: number }>;
}

/**
 * Status kesiapan "data asli" satu template.
 *
 * Angka template TIDAK lagi diambil saat tombol ditekan (dulu pengguna menunggu
 * 5–15 menit). Server menyiapkannya lebih dulu — saat server hidup, saat dokumen
 * baru masuk ke basis pengetahuan, dan saat galeri ini dibuka — lalu menyimpannya.
 * Galeri hanya membaca status ini: sudah siap → tampil seketika; belum → beri tahu
 * bahwa datanya masih loading beserta progresnya.
 */
interface StatusTemplate {
  templateId: string;
  status: 'belum' | 'proses' | 'siap' | 'gagal' | 'dihentikan';
  /** Kartu yang sudah berisi angka dokumen. */
  terisi: number;
  /** Kartu yang indikatornya memang tidak ada di dokumen. */
  kosong?: number;
  /** Kartu yang belum selesai diisi (waktu/layanan habis) — pengisian lanjut sendiri. */
  tertunda?: number;
  total: number;
  progres: { selesai: number; total: number; judul: string } | null;
  selesaiPada: number | null;
  /** Waktu pengisian dimulai (ms), hanya selama status `proses`. */
  mulaiPada?: number | null;
  /** Perkiraan server (ms) sampai semua kartu template ini berisi data asli. */
  perkiraanMs?: number | null;
  /** Template masih menunggu template lain selesai diisi lebih dulu. */
  menungguGiliran?: boolean;
}

/** "12 menit" atau "1 jam 20 menit". */
function teksDurasi(ms: number): string {
  const menit = Math.max(1, Math.round(ms / 60_000));
  if (menit < 60) return `${menit} menit`;
  const sisa = menit % 60;
  return `${Math.floor(menit / 60)} jam${sisa ? ` ${sisa} menit` : ''}`;
}

/**
 * Perkiraan kapan SEMUA kartu template terisi data asli, dihitung server dari
 * laju pengisian nyata (ms per kartu) dan antrean template di depannya. Deck
 * 50-70 kartu memang butuh 20-30 menit; pengguna perlu tahu itu, bukan mengira
 * halamannya menggantung.
 */
function teksSisaWaktu(st: StatusTemplate | undefined): string {
  if (!st?.perkiraanMs) return '';
  const jam = new Date(Date.now() + st.perkiraanMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return ` · semua kartu terisi ± ${teksDurasi(st.perkiraanMs)} lagi (sekitar pukul ${jam})`;
}

/**
 * Halaman "Template Dashboard": galeri template UMUM.
 *
 * Template tidak dipisahkan per sektor BUMD. Tiap template adalah satu KONSEP
 * penyajian yang ditentukan oleh tujuannya: untuk apa dashboard dipakai, dan
 * bagaimana isinya disampaikan (ringkasan satu layar, papan pemantauan, laporan
 * naratif, perbandingan, komposisi & sebaran, papan status). Susunan widget tiap
 * template mengikuti cara penyampaiannya, jadi template berbeda terasa berbeda.
 *
 * Instansi apa pun boleh memakai template mana pun; angka selalu diambil dari
 * dokumen instansi yang sedang login.
 *
 * PENTING: seluruh angka di pratinjau DATA DUMMY (bukan hasil pembacaan dokumen).
 * Halaman memberi label jelas agar tidak disangka berasal dari dokumen resmi.
 */
export const DashboardTemplatesPage: React.FC<DashboardTemplatesPageProps> = ({
  currentTenant,
  onUseTemplate,
  progres,
}) => {
  // Template aktif untuk dipratinjau. Default: template pertama di galeri.
  const [aktifId, setAktifId] = useState<string>(
    () => templateGaleri()[0]?.id ?? DASHBOARD_TEMPLATES[0].id
  );

  /**
   * KATEGORI — template dikelompokkan menurut KEBUTUHAN (keuangan, pengadaan,
   * pelayanan, operasional, SDM, kinerja). Memilih kategori hanya menyaring
   * kartu template; susunan isi tetap milik template yang dipilih.
   */
  const [kategoriId, setKategoriId] = useState<KategoriTemplateId>(
    () => kategoriDariTemplate(templateGaleri()[0] ?? DASHBOARD_TEMPLATES[0]).id
  );

  /**
   * GAYA TERPISAH DARI TEMPLATE — gaya Template Chart (12 varian) dipilih sendiri
   * dan berlaku untuk template mana pun. `null` = ikut gaya bawaan template,
   * sehingga template baru tidak perlu menyebut gaya sama sekali.
   */
  const [gaya, setGaya] = useState<Varian | null>(null);

  /** Status pengambilan angka dari dokumen saat tombol "Pakai Template Ini" ditekan. */
  const [memuat, setMemuat] = useState(false);
  /**
   * Detik berjalan selama pengisian. Pengisian belasan kartu bisa beberapa menit;
   * tanpa penghitung, halaman terlihat menggantung dan pengguna menutupnya di
   * tengah jalan (kartu jadi kosong).
   */
  const [detik, setDetik] = useState(0);
  useEffect(() => {
    if (!memuat) {
      setDetik(0);
      return;
    }
    const t = setInterval(() => setDetik((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [memuat]);
  /**
   * Pesan galat untuk pengguna. Bahasa awam: tanpa istilah teknis (RAG, HTTP,
   * timeout) — pengguna hanya perlu tahu apa yang terjadi dan apa yang bisa
   * dilakukan.
   */
  const [galat, setGalat] = useState<string | null>(null);
  /** Mode presentasi pratinjau (layar penuh, seluruh dashboard dalam satu halaman). */
  const [presentasi, setPresentasi] = useState(false);
  /** Kesiapan data asli per template (dibaca dari server, diperbarui berkala). */
  const [statusTpl, setStatusTpl] = useState<Record<string, StatusTemplate>>({});
  /** Perkiraan server (ms) sampai semua template galeri selesai diisi data asli. */
  const [perkiraanSemua, setPerkiraanSemua] = useState<number | null>(null);
  /** Hasil pratinjau dengan angka dokumen; `null` = masih menampilkan contoh. */
  const [asli, setAsli] = useState<{ widgets: WidgetSpec[]; terisi: number; kosong: number } | null>(
    null
  );
  const [memuatAsli, setMemuatAsli] = useState(false);
  /**
   * HALAMAN TEMPLATE. Template pertama menampilkan dua halaman sekaligus: desain
   * sama, isi berbeda. Halaman 2 memakai angka dokumen yang belum dipakai
   * halaman 1 (`/api/templates/pratinjau?halaman=2`).
   */
  const [halamanAktif, setHalamanAktif] = useState<string>('1');
  const [asli2, setAsli2] = useState<WidgetSpec[] | null>(null);
  /** Halaman 3: kinerja per wilayah layanan (diurai server dari tabel dokumen). */
  const [asli3, setAsli3] = useState<NilaiWilayah | null>(null);
  const [memuat3, setMemuat3] = useState(false);
  const [memuat2, setMemuat2] = useState(false);
  const [galatAsli, setGalatAsli] = useState<string | null>(null);

  /** Baca status kesiapan semua template. Gagal membaca bukan alasan menakut-nakuti
   *  pengguna: cukup tampilkan "belum disiapkan" dan biarkan percobaan berikutnya. */
  const muatStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/templates/status');
      if (!res.ok) return;
      const data = (await res.json()) as { templates?: StatusTemplate[]; perkiraanSemuaMs?: number | null };
      setPerkiraanSemua(data.perkiraanSemuaMs ?? null);
      const peta: Record<string, StatusTemplate> = {};
      for (const t of data.templates ?? []) peta[t.templateId] = t;
      setStatusTpl(peta);
    } catch {
      /* diamkan: status hanya pelengkap */
    }
  }, []);

  // Status disegarkan berkala supaya begitu server selesai menyiapkan (mis. setelah
  // dokumen baru masuk), tombol berubah sendiri jadi siap tanpa perlu muat ulang.
  useEffect(() => {
    void muatStatus();
    const t = setInterval(() => void muatStatus(), 7000);
    return () => clearInterval(t);
  }, [muatStatus]);

  const aktif = useMemo(
    () => DASHBOARD_TEMPLATES.find((t) => t.id === aktifId) ?? DASHBOARD_TEMPLATES[0],
    [aktifId]
  );

  /**
   * HENTIKAN / MULAI pengisian data dari dokumen.
   *
   * Pengisian berjalan di latar dan bisa 5–45 menit, jadi pengguna harus bisa
   * menghentikannya lalu melanjutkan lagi tanpa kehilangan kartu yang sudah
   * terisi. Status terbaru dibaca ulang dari server sesudah tombol ditekan.
   */
  const [mengubahPengisian, setMengubahPengisian] = useState<'' | 'hentikan' | 'mulai'>('');
  const ubahPengisian = async (aksi: 'hentikan' | 'mulai') => {
    setMengubahPengisian(aksi);
    try {
      const res = await fetch(`/api/templates/${aksi}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: aktif.id }),
      });
      const isi = await res.json().catch(() => null);
      if (!res.ok) {
        setGalatAsli(
          isi?.error ||
            `Pengisian gagal ${aksi === 'hentikan' ? 'dihentikan' : 'dimulai'} (HTTP ${res.status}). Coba lagi.`
        );
      } else {
        setGalatAsli(null);
      }
    } catch {
      setGalatAsli('Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.');
    } finally {
      setMengubahPengisian('');
      void muatStatus();
    }
  };

  /** Gaya yang benar-benar dipakai pratinjau: pilihan pengguna, atau bawaan template. */
  const gayaTampil: Varian = gaya ?? varianBawaanTemplate(aktif);
  /** Kartu template untuk kategori yang sedang dibuka. */
  const templateKategori = useMemo(() => templateGaleri(kategoriId), [kategoriId]);

  /**
   * Apakah galeri berisi template sama sekali. Saat semua template lama ditarik,
   * halaman berhenti di daftar kategori + keterangan kosong: pemilih gaya,
   * pratinjau, dan tombol simpan tidak ada gunanya kalau tidak ada template.
   */
  const adaTemplate = templateGaleri().length > 0;

  // Salin widget dengan id unik & segar supaya React key stabil dan penyuntingan
  // (saat template benar-benar dipakai) tidak menyentuh definisi template.

  /** Template rapat bagian: halaman deck sebanyak definisinya, bukan tiga halaman Pijar. */
  const bagian = aktif.bagian;
  const jumlahHalaman = bagian ? bagian.halaman.length : 3;

  /** Ringkasan susunan template (dipakai kartu template & keterangan bawah). */

  const widgetPratinjau = useMemo(() => widgetDariTemplate(aktif, 0), [aktif]);

  /**
   * Angka dokumen yang dipetakan ke slot template. Pratinjau data asli memakai
   * komponen replika template yang SAMA dengan contoh, jadi desain, warna, dan
   * susunan kartu tidak mungkin melenceng — hanya angkanya yang berganti.
   */
  const nilaiAsli = useMemo(() => nilaiDariWidgets(asli?.widgets), [asli]);

  /**
   * Angka dokumen untuk template T3 (trafik). T3 punya kartu yang tidak ada di
   * T1, jadi dipetakan sendiri — tetap ke slot yang sama seperti tampilan
   * contoh, hanya angkanya yang berganti.
   */
  const nilaiTrafikAsli = useMemo(() => nilaiTrafikDariWidgets(asli?.widgets), [asli]);

  /**
   * Angka dokumen untuk template T2 (analitik). Kartunya berbeda dengan T1,
   * jadi dipetakan sendiri ke slot yang sama seperti tampilan contoh.
   */
  const nilaiAnalitikAsli = useMemo(() => nilaiAnalitikDariWidgets(asli?.widgets), [asli]);

  /** Angka halaman 2 template, dipetakan ke slot yang sama dengan halaman 1. */
  const nilai2 = useMemo(() => nilaiDariWidgets(asli2), [asli2]);
  /** Halaman 2 template pertama: operasional & pelayanan (air terjual, NRW, pengaduan, anggaran). */
  const nilaiOperasional2 = useMemo(() => nilaiOperasionalDariWidgets(asli2), [asli2]);

  /** Sumber dokumen per judul widget untuk kartu halaman 1 (fitur kartu balik). */
  const sumberJudul = useMemo(() => sumberPerJudul(asli?.widgets), [asli]);

  /**
   * Satu halaman template (1, 2, atau 3) dengan angka yang sedang tampil.
   * Galeri, presentasi, dan dashboard tersimpan memakai `ReplikaHalaman` yang
   * sama, jadi tampilannya tidak mungkin berbeda.
   */
  const replikaTampil = (nomor: number, penuh: boolean) => {
    if (bagian) {
      const isi = halamanTemplateBagian(aktif, asli?.widgets ?? widgetPratinjau)[nomor - 1]?.widgets ?? [];
      return (
        <ReplikaHalaman
          penuh={penuh}
          replika={{ templateId: `${aktif.id}#${nomor}`, nilai: { widgets: isi } }}
          contoh={!asli}
          sumberAktif={Boolean(asli)}
          varian={gayaTampil}
        />
      );
    }
    const nilaiHal1 = !asli
      ? undefined
      : aktif.id === 'tpl-analitik'
        ? nilaiAnalitikAsli
        : aktif.id === 'tpl-trafik'
          ? nilaiTrafikAsli
          : nilaiAsli;
    return (
      <ReplikaHalaman
        penuh={penuh}
        replika={{
          templateId: nomor === 1 ? aktif.id : `${aktif.id}#${nomor}`,
          nilai: nomor === 2 ? nilaiOperasionalTampil : nomor === 3 ? nilaiWilayahTampil : nilaiHal1,
        }}
        contoh={!asli}
        sumberAktif={Boolean(asli)}
        sumberJudul={sumberJudul}
        varian={gayaTampil}
      />
    );
  };

  /**
   * Halaman 2 mengikuti mode yang sedang dilihat, sama seperti halaman 1:
   * - Tampilan template (belum menekan "Pratinjau data asli") → angka CONTOH.
   * - Pratinjau data asli → angka dokumen; slot yang dokumennya tidak memuat
   *   angka ditutup contoh supaya desain tetap utuh.
   */
  /**
   * DUA MODE BERLAKU UNTUK SEMUA HALAMAN:
   * - Template (belum menekan "Pratinjau data asli") → semua halaman memakai
   *   angka contoh, termasuk halaman 2.
   * - Pratinjau data asli → halaman 2 memakai angka dokumen; slot yang dokumennya
   *   tidak memuat angka ditutup contoh supaya desain tetap utuh.
   */
  const nilaiOperasionalTampil = useMemo(
    () => (asli ? nilaiOperasional2 : CONTOH_OPERASIONAL),
    [asli, nilaiOperasional2]
  );

  /** Halaman 3 mengikuti mode yang sama: template = contoh, pratinjau = dokumen. */
  const nilaiWilayahTampil = useMemo<NilaiWilayah>(
    () => (asli ? asli3 ?? { ...CONTOH_WILAYAH, contoh: false, baris: [], total: null, catatan: [], sumber: [] } : CONTOH_WILAYAH),
    [asli, asli3]
  );

  /**
   * Dashboard BAYANGAN untuk mode presentasi pratinjau.
   *
   * Presentasi kini menampilkan SATU halaman utuh (tanpa slide), jadi cukup
   * dibungkus sebagai Dashboard biasa. Angkanya tetap contoh — `PresentationMode`
   * dipanggil dengan `pratinjau` supaya diberi penanda dan tanpa panggilan RAG.
   */
  const dashPratinjau = useMemo<Dashboard>(
    () => ({
      id: `tpl-pratinjau-${aktif.id}`,
      tenantId: currentTenant?.id ?? '',
      title: aktif.judulDashboard,
      description: aktif.deskripsiDashboard,
      sector: (currentTenant?.sector ?? 'aneka_usaha') as BumdSector,
      widgets: asli?.widgets ?? widgetPratinjau,
      globalFilters: { periode: 'Contoh', unitKerja: 'Semua', kategori: 'Semua' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Presentasi (contoh maupun data asli) memakai tema template yang sama dengan panel pratinjau.
      tema: aktif.tema || 'oranye',
    }),
    [aktif, widgetPratinjau, currentTenant, asli]
  );

  const pakai = async () => {
    if (memuat) return;
    setMemuat(true);
    setGalat(null);
    try {
      await onUseTemplate(aktif, gayaTampil);
    } catch (err) {
      setGalat(pesanGalatRamah(err));
    } finally {
      setMemuat(false);
    }
  };

  /**
   * Mulai siapkan data asli untuk template yang sedang dilihat — di latar belakang.
   *
   * Tujuannya agar saat pengguna menekan "Pratinjau dengan data asli", angkanya
   * sudah siap (bukan menunggu 5–15 menit di depan tombol). Hanya template yang
   * benar-benar dibuka yang disiapkan, supaya layanan dokumen tidak dibanjiri.
   */
  useEffect(() => {
    // Galeri kosong: tidak ada template yang perlu disiapkan.
    if (!adaTemplate) return;
    void (async () => {
      try {
        const res = await fetch(`/api/templates/pratinjau?templateId=${encodeURIComponent(aktif.id)}`);
        if (res.ok) void muatStatus();
      } catch {
        /* diamkan: status hanya pelengkap */
      }
    })();
  }, [aktif.id, muatStatus]);

  // Ganti template → kembali ke halaman 1 dan buang angka halaman 2 milik template lama.
  useEffect(() => {
    setHalamanAktif('1');
    setAsli2(null);
    setAsli3(null);
  }, [aktif.id]);

  /**
   * Buka halaman 2. Angkanya diambil sekali dari server lalu disimpan; desainnya
   * memakai komponen replika template yang sedang dibuka, jadi tidak ada tampilan
   * kedua yang bisa melenceng.
   */
  const bukaHalaman2 = async (paksa = false) => {
    setHalamanAktif('2');
    if (!paksa && (asli2 || memuat2)) return;
    setMemuat2(true);
    try {
      const res = await fetch(
        `/api/templates/pratinjau?templateId=${encodeURIComponent(aktif.id)}&halaman=2`
      );
      const data = (await res.json().catch(() => ({}))) as { widgets?: WidgetSpec[] | null };
      setAsli2(Array.isArray(data.widgets) ? data.widgets : []);
    } catch {
      setAsli2([]);
    } finally {
      setMemuat2(false);
    }
  };

  /**
   * Buka halaman 3 (kinerja per wilayah). Angkanya diurai server langsung dari
   * tabel dokumen, lalu disimpan supaya pindah tab tidak memanggil RAG terus.
   */
  const bukaHalaman3 = async (paksa = false) => {
    setHalamanAktif('3');
    if (!paksa && (asli3 || memuat3)) return;
    setMemuat3(true);
    try {
      const res = await fetch('/api/templates/wilayah');
      const data = (await res.json().catch(() => ({}))) as Partial<NilaiWilayah> & { status?: string };
      setAsli3({
        baris: Array.isArray(data.baris) ? data.baris : [],
        total: data.total ?? null,
        catatan: Array.isArray(data.catatan) ? data.catatan : [],
        satuanAir: data.satuanAir || 'm³',
        sumber: Array.isArray(data.sumber) ? data.sumber : [],
      });
    } catch {
      setAsli3({ baris: [], total: null, catatan: [], satuanAir: 'm³', sumber: [] });
    } finally {
      setMemuat3(false);
    }
  };

  const st = statusTpl[aktif.id];

  /**
   * IKUT DOKUMEN TERBARU.
   *
   * Server menyiapkan ulang angka template setiap kali dokumen instansi
   * berubah (unggah, hapus, sinkron). Begitu status menyatakan siap dengan waktu
   * selesai yang lebih baru dari pratinjau yang sedang tampil, ambil ulang
   * semua halaman tanpa perlu menekan tombol atau memuat ulang halaman.
   */
  const versiTampil = useRef<number | null>(null);
  useEffect(() => {
    if (!asli || st?.status !== 'siap' || !st.selesaiPada) return;
    if (versiTampil.current === null) {
      versiTampil.current = st.selesaiPada;
      return;
    }
    if (st.selesaiPada <= versiTampil.current) return;
    versiTampil.current = st.selesaiPada;
    void (async () => {
      try {
        const res = await fetch(`/api/templates/pratinjau?templateId=${encodeURIComponent(aktif.id)}`);
        const data = (await res.json().catch(() => ({}))) as { status?: string; widgets?: WidgetSpec[]; terisi?: number; kosong?: number };
        if (data.status === 'siap' && Array.isArray(data.widgets)) {
          setAsli({ widgets: data.widgets, terisi: data.terisi ?? 0, kosong: data.kosong ?? 0 });
        }
      } catch {
        /* biarkan pratinjau lama; percobaan berikutnya ikut status berikutnya */
      }
      // Halaman 2 dan 3 diambil ulang saat dibuka berikutnya.
      setAsli2(null);
      setAsli3(null);
      if (!bagian && halamanAktif === '2') void bukaHalaman2(true);
      if (!bagian && halamanAktif === '3') void bukaHalaman3(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.status, st?.selesaiPada, asli, aktif.id]);

  // Ganti template = mulai lagi dari versi yang tampil.
  useEffect(() => {
    versiTampil.current = null;
  }, [aktif.id]);

  /**
   * Buka pratinjau dengan DATA ASLI.
   *
   * Kalau server sudah menyiapkan angkanya, tampil seketika. Kalau belum, jangan
   * diam — beri tahu bahwa masih loading, lalu tunggu (server sudah menyiapkan di
   * latar belakang) dan buka sendiri begitu siap.
   */
  const bukaAsli = async () => {
    if (memuatAsli) return;
    setMemuatAsli(true);
    setGalatAsli(null);
    const ambil = async (): Promise<boolean> => {
      const res = await fetch(`/api/templates/pratinjau?templateId=${encodeURIComponent(aktif.id)}`);
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        widgets?: WidgetSpec[] | null;
        terisi?: number;
        kosong?: number;
        galat?: string | null;
        error?: string;
      };
      if (!res.ok && !data.status) throw new Error(data.error || 'Pratinjau gagal dimuat.');
      if (data.status === 'siap' && Array.isArray(data.widgets)) {
        setAsli({ widgets: data.widgets, terisi: data.terisi ?? 0, kosong: data.kosong ?? 0 });
        return true;
      }
      if (data.status === 'gagal') {
        throw new Error(data.galat || 'Penyiapan data dari dokumen gagal.');
      }
      // Belum siap: tampilkan dulu kartu yang sudah terisi, sisanya menyusul.
      if (Array.isArray(data.widgets) && (data.terisi ?? 0) > 0) {
        setAsli({ widgets: data.widgets, terisi: data.terisi ?? 0, kosong: data.kosong ?? 0 });
      }
      return false;
    };
    try {
      if (await ambil()) return;
      setGalatAsli(
        'Data asli masih disiapkan dari dokumen instansi. Pratinjau akan terbuka sendiri begitu siap — Anda boleh tetap di halaman ini.'
      );
      for (let i = 0; i < 240; i += 1) {
        await new Promise((r) => setTimeout(r, 5000));
        if (await ambil()) {
          setGalatAsli(null);
          return;
        }
        if (i % 2 === 0) void muatStatus();
      }
      setGalatAsli('Penyiapan data memakan waktu lebih lama dari biasanya. Coba lagi beberapa saat lagi.');
    } catch (err) {
      setGalatAsli(pesanGalatRamah(err));
    } finally {
      setMemuatAsli(false);
      void muatStatus();
    }
  };

  /** Teks status di toolbar: apa yang sedang terjadi dengan data asli template ini. */
  const statusTeks = memuat
    ? 'Membuat dashboard dari data yang sudah siap…'
    : st?.status === 'siap'
      ? st.tertunda
        ? `Data asli ${st.terisi} dari ${st.total} kartu · ${st.tertunda} kartu masih diisi dari dokumen`
        : `Data asli siap · ${st.terisi} dari ${st.total} indikator cocok dengan dokumen Anda`
      : st?.status === 'proses'
        ? `Menyiapkan data asli dari dokumen… ${st.progres?.selesai ?? st.terisi}/${st.progres?.total ?? st.total} kartu${teksSisaWaktu(st)}`
        : st?.status === 'dihentikan'
          ? `Pengambilan data dihentikan — ${st.terisi} dari ${st.total} kartu sudah terisi. Tekan Mulai untuk melanjutkan.`
        : st?.status === 'gagal'
          ? `Penyiapan data asli gagal — tekan tombol pratinjau untuk mencoba lagi${teksSisaWaktu(st)}`
          : st?.tertunda
            ? `${st.tertunda} kartu masih menunggu diisi ulang dari dokumen${teksSisaWaktu(st)}`
            : st?.menungguGiliran && st.perkiraanMs
              ? `Menunggu giliran, template lain sedang diisi lebih dulu${teksSisaWaktu(st)}`
              : `Data asli belum disiapkan — tekan tombol pratinjau untuk memulai${teksSisaWaktu(st)}`;

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Kepala halaman */}
        <div className="bg-surface p-5 rounded-card border border-line mb-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-control bg-solid flex items-center justify-center text-on-solid shrink-0">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2 flex-wrap">
              <span>Template Dashboard</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold">
                {templateGaleri().length} template · {KATEGORI_TEMPLATE.length} kategori
              </span>
              {perkiraanSemua ? (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-2 font-semibold inline-flex items-center gap-1"
                  title="Template galeri diisi berurutan. Template rapat bagian mulai diisi saat dibuka."
                >
                  <Clock className="w-3 h-3" />
                  Semua template terisi data asli ± {teksDurasi(perkiraanSemua)} lagi
                </span>
              ) : null}
            </h2>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed max-w-3xl">
              {adaTemplate ? (
                <>
                  Template dikelompokkan menurut <strong>kebutuhan</strong>, dan <strong>gaya tampilan
                  dipilih terpisah</strong> — satu susunan bisa dipakai dengan gaya apa pun. Tekan{' '}
                  <strong>Pratinjau dengan data asli</strong> untuk melihatnya berisi angka dokumen
                  instansi Anda, lalu <strong>Simpan sebagai dashboard</strong> — tanpa menunggu.
                </>
              ) : (
                <>
                  Template dikelompokkan menurut <strong>kebutuhan</strong>, dan <strong>gaya tampilan
                  dipilih terpisah</strong> dari susunannya. Daftar di bawah sudah siap menerima
                  template baru.
                </>
              )}
            </p>
            {adaTemplate && (
            <p className="text-[10.5px] text-brand-ink mt-2 flex items-start gap-1.5 leading-relaxed max-w-3xl">
              <Database className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Pratinjau di bawah memakai <strong>angka contoh</strong>. Angka asli disiapkan
                lebih dulu oleh server, jadi pratinjau data asli tampil seketika; indikator yang
                tidak ada di dokumen ditandai <strong>kosong</strong>.
              </span>
            </p>
            )}
          </div>
        </div>

        {/* KATEGORI — template dikelompokkan menurut KEBUTUHAN pemakaian, bukan
            merek dan bukan sektor. Kategori hanya menyaring; susunan isi tetap
            milik template yang dipilih. */}
        <div
          role="tablist"
          aria-label="Kategori template dashboard"
          className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-line"
        >
          {KATEGORI_TEMPLATE.map((k) => {
            const terpilih = k.id === kategoriId;
            const jumlah = jumlahTemplateGaleri(k.id);
            return (
              <button
                key={k.id}
                role="tab"
                aria-selected={terpilih}
                data-testid={`tab-kategori-${k.id}`}
                onClick={() => {
                  setKategoriId(k.id);
                  // Langsung pindah ke template pertama kategori ini, supaya
                  // pratinjau di bawah tidak menampilkan template kategori lain.
                  const pertama = templateGaleri(k.id)[0];
                  if (pertama) setAktifId(pertama.id);
                }}
                title={k.deskripsi}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-t-control text-xs font-semibold border-b-2 transition-colors ${
                  terpilih
                    ? 'border-brand text-ink bg-surface-2'
                    : 'border-transparent text-ink-2 hover:text-ink hover:bg-surface-2'
                }`}
              >
                <span className="whitespace-nowrap">{k.nama}</span>
                <span className="text-[9.5px] font-medium text-ink-3">{jumlah}</span>
              </button>
            );
          })}
        </div>

        {/* Template di kategori terpilih — ringkas: nama susunan + jumlah kartu.
            Rincian tujuan cukup muncul sebagai tooltip saat kursor diarahkan. */}
        <div className="flex flex-wrap gap-2 mb-4">
          {templateKategori.map((t) => {
            const terpilih = t.id === aktif.id;
            return (
              <button
                key={t.id}
                data-testid={`tab-template-${t.id}`}
                aria-pressed={terpilih}
                onClick={() => setAktifId(t.id)}
                title={t.tujuan}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-card border text-left transition-colors ${
                  terpilih ? 'border-brand bg-surface-2' : 'border-line bg-surface hover:bg-surface-2'
                }`}
              >
                <span className="text-xs font-bold text-ink truncate">{t.nama}</span>
                {/**
                  * KECOCOKAN DENGAN DOKUMEN — ditampilkan SEBELUM dipakai, supaya
                  * tidak ada lagi kejutan dashboard berisi puluhan kartu kosong.
                  * Angka ini hanya muncul kalau template sudah pernah diisi.
                  */}
                {(() => {
                  const s = statusTpl[t.id];
                  if (!s || (s.status !== 'siap' && !s.terisi)) return null;
                  const tertunda = s.tertunda ?? 0;
                  return (
                    <span
                      className={`ml-auto text-[10px] font-semibold shrink-0 ${
                        tertunda > 0 ? 'text-brand-ink' : s.terisi === 0 ? 'text-ink-3' : 'text-pos'
                      }`}
                      title={
                        tertunda > 0
                          ? `${s.tertunda} kartu sedang diisi dari dokumen`
                          : `${s.terisi} dari ${s.total} indikator cocok dengan dokumen instansi`
                      }
                      data-testid={`cocok-${t.id}`}
                    >
                      {tertunda > 0 ? `${s.terisi}/${s.total} · diisi` : `${s.terisi}/${s.total} cocok`}
                    </span>
                  );
                })()}
              </button>
            );
          })}
          {templateKategori.length === 0 && (
            <div className="w-full border border-dashed border-line rounded-card p-6 text-center">
              <p className="text-xs font-semibold text-ink-2">
                {adaTemplate ? 'Belum ada template di kategori ini' : 'Belum ada template'}
              </p>
              <p className="text-[11px] text-ink-3 mt-1 leading-relaxed">
                {adaTemplate
                  ? `Kategori ${KATEGORI_TEMPLATE.find((k) => k.id === kategoriId)?.nama} masih kosong. Pilih kategori lain dulu.`
                  : 'Template dashboard sedang disusun ulang. Galeri akan terisi begitu template baru ditambahkan.'}
              </p>
            </div>
          )}
        </div>

        {/* Selebihnya hanya berguna kalau ada template: pemilih gaya, toolbar,
            pratinjau, dan keterangan simpan. */}
        {adaTemplate && (
          <>
        {/* GAYA — dipilih TERPISAH dari template. Susunan kartu milik template,
            desain & warna chart milik gaya. Daftar gaya sama untuk semua kategori. */}
        <div className="card mb-4 px-4 py-3">
          <div className="flex items-start gap-2 mb-2">
            <Palette className="w-3.5 h-3.5 text-ink-3 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink">Gaya tampilan</p>
              <p className="text-[11px] text-ink-3 leading-relaxed">
                Gaya dari menu Template Chart, berlaku untuk template mana pun di kategori mana pun.
              </p>
            </div>
            {gaya && (
              <button
                onClick={() => setGaya(null)}
                data-testid="gaya-bawaan"
                className="ml-auto shrink-0 text-[10.5px] font-semibold text-ink-2 hover:text-ink underline"
              >
                Pakai gaya bawaan
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VARIAN.map((v) => {
              const terpilih = v === gayaTampil;
              const palet = GAYA[v].palet.filter(cukupTerang).slice(0, 3);
              return (
                <button
                  key={v}
                  onClick={() => setGaya(v)}
                  data-testid={`gaya-${v}`}
                  aria-pressed={terpilih}
                  title={`${GAYA[v].nama} — ${GAYA[v].sebutan}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border text-[11px] font-semibold transition-colors ${
                    terpilih ? 'border-brand bg-surface-2 text-ink' : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  <span className="flex -space-x-1 shrink-0" aria-hidden="true">
                    {palet.map((w, i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full ring-1 ring-surface"
                        style={{ background: w }}
                      />
                    ))}
                  </span>
                  {GAYA[v].nama}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar template aktif — tombol pratinjau, simpan, dan presentasi.
            Keterangan teks template (nama, tujuan, cara penyampaian, fokus,
            susunan) sengaja TIDAK ditampilkan: pratinjau di bawah sudah
            memperlihatkan isinya, jadi teks itu hanya mengulang. */}
        <div className="card mb-4">
          <div className="px-4 sm:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-2 rounded-card">
            <div className="flex items-center gap-1.5 min-w-0">
              {st?.status === 'siap' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-pos shrink-0" />
              ) : st?.status === 'proses' || memuatAsli ? (
                <Loader2 className="w-3.5 h-3.5 text-brand-ink shrink-0 animate-spin" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-ink-3 shrink-0" />
              )}
              <span className="text-[11px] text-ink-3 font-medium leading-snug">
                {memuat && progres && progres.total > 0
                  ? `${progres.terisi}/${progres.total} kartu terisi · ${detik} dtk · ${progres.judul || 'menyiapkan…'}`
                  : statusTeks}
              </span>
            </div>
            {/* Tombol simpan tepat di sebelah kiri "Mode Presentasi". */}
            <div className="flex items-center gap-2 shrink-0">
              {/* HENTIKAN / MULAI pengambilan data dari dokumen. Pengisian bisa
                  5–45 menit; tanpa tombol ini pengguna hanya bisa menunggu. */}
              {st?.status === 'proses' && (
                <button
                  onClick={() => void ubahPengisian('hentikan')}
                  disabled={mengubahPengisian !== ''}
                  data-testid="hentikan-pengisian-template"
                  title="Hentikan pengambilan data dari dokumen. Kartu yang sudah terisi tetap disimpan."
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {mengubahPengisian === 'hentikan' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Pause className="w-3.5 h-3.5" />
                  )}
                  <span>{mengubahPengisian === 'hentikan' ? 'Menghentikan…' : 'Hentikan'}</span>
                </button>
              )}
              {st?.status === 'dihentikan' && (
                <button
                  onClick={() => void ubahPengisian('mulai')}
                  disabled={mengubahPengisian !== ''}
                  data-testid="mulai-pengisian-template"
                  title="Lanjutkan pengambilan data dari dokumen. Kartu yang sudah terisi tidak diulang."
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {mengubahPengisian === 'mulai' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>{mengubahPengisian === 'mulai' ? 'Memulai…' : 'Mulai'}</span>
                </button>
              )}
              {asli && (
                <button
                  onClick={() => void pakai()}
                  disabled={memuat}
                  data-testid="simpan-dari-pratinjau"
                  title="Simpan pratinjau ini menjadi dashboard milik instansi"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60"
                >
                  {memuat ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutTemplate className="w-4 h-4" />}
                  <span>{memuat ? 'Menyimpan…' : 'Simpan sebagai dashboard'}</span>
                </button>
              )}
              <button
                onClick={() => setPresentasi(true)}
                disabled={memuat || widgetPratinjau.length === 0}
                data-testid="presentasi-template"
                title="Buka mode presentasi: seluruh dashboard dalam satu layar penuh"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Presentation className="w-4 h-4" />
                <span>Mode Presentasi</span>
              </button>
              {/* Ambil ulang angka dari dokumen tanpa perlu unggah lagi. */}
              <button
                onClick={async () => {
                  setMemuatAsli(true);
                  try {
                    const r = await fetch('/api/templates/segarkan', { method: 'POST' });
                    if (r.ok) window.location.reload();
                  } finally {
                    setMemuatAsli(false);
                  }
                }}
                disabled={memuatAsli || !currentTenant}
                data-testid="segarkan-pratinjau"
                title="Ambil ulang angka dari dokumen untuk semua template"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4${memuatAsli ? ' animate-spin' : ''}`} />
                <span>Perbarui</span>
              </button>
              {/* Satu tombol dipakai bolak-balik: "Pratinjau dengan data asli" saat
                  masih menampilkan contoh, berubah jadi "Kembali ke contoh" saat
                  pratinjau data asli sedang terbuka — jadi tidak perlu tombol
                  kembali terpisah di panel pratinjau. */}
              <button
                onClick={() => (asli ? setAsli(null) : void bukaAsli())}
                disabled={!asli && (memuatAsli || memuat || !currentTenant || st?.status === 'proses')}
                data-testid={`pakai-template-${aktif.id}`}
                title={
                  asli
                    ? 'Tutup pratinjau data asli dan kembali melihat tampilan contoh'
                    : st?.status === 'siap'
                      ? 'Tampilkan dashboard ini dengan angka asli dari dokumen instansi'
                      : 'Data asli masih disiapkan; pratinjau terbuka sendiri begitu siap'
                }
                className={
                  asli
                    ? 'inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-ink-2 bg-surface hover:bg-surface-2 border border-line rounded-control transition-colors'
                    : 'inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-on-brand bg-brand hover:brightness-95 rounded-control transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                }
              >
                {asli ? (
                  <ArrowLeft className="w-4 h-4" />
                ) : memuatAsli || st?.status === 'proses' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : st?.status === 'siap' ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {asli
                    ? 'Kembali ke contoh'
                    : st?.status === 'proses'
                      ? `Menyiapkan data… ${st.terisi}/${st.total}`
                      : memuatAsli
                        ? 'Memuat pratinjau…'
                        : 'Pratinjau dengan data asli'}
                </span>
                {!asli && !memuatAsli && st?.status !== 'proses' && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Galat tetap ditampilkan, tetapi dengan bahasa awam — tanpa istilah
              teknis yang tidak dipahami pengguna. */}
          {galatAsli && (
            <div className="border-t border-warn/30 bg-warn/10 px-4 sm:px-5 py-2.5 flex items-start gap-2">
              <Clock className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-ink-2 leading-relaxed">{galatAsli}</p>
            </div>
          )}
          {galat && (
            <div className="border-t border-neg/30 bg-neg/10 px-4 sm:px-5 py-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-neg shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-neg">Dashboard belum bisa dibuat</p>
                <p className="text-[11px] text-ink-2 mt-0.5 leading-relaxed">{galat}</p>
              </div>
            </div>
          )}
        </div>

        {/* Pratinjau memakai TAMPILAN REFERENSI (replika): dashboard gelap dengan
            satu aksen oranye — 4 KPI berikon & sparkline, grafik batang, cincin
            rincian beban, daftar transaksi, area arus kas, progres target, dan
            strip insight. Susunannya sengaja tidak memakai DashboardCanvas agar
            bisa sama persis dengan acuan; seluruh angkanya CONTOH. */}
        {/* SATU wadah untuk contoh maupun data asli. Bingkai, latar, dan
            padding-nya sama persis, jadi yang berubah hanya angka di dalamnya. */}
        {/* Halaman template: desain sama, isi berbeda. Halaman 2 memakai angka
            dokumen yang belum dipakai halaman 1. */}
        <HalamanTabs
          halaman={bagian ? bagian.halaman.map((h, i) => ({ id: String(i + 1), judul: h.judul, widgets: [] as WidgetSpec[] })) : [
            { id: '1', judul: 'Halaman 1', widgets: asli?.widgets ?? widgetPratinjau },
            { id: '2', judul: 'Halaman 2', widgets: asli2 ?? [] },
            // Halaman 3 berlaku untuk SEMUA template: satu lingkup wilayah layanan.
            { id: '3', judul: 'Halaman 3', widgets: [] as WidgetSpec[] },
          ]}
          aktifId={halamanAktif}
          onPilih={(id) => {
            if (bagian) setHalamanAktif(id);
            else if (id === '2') void bukaHalaman2();
            else if (id === '3') void bukaHalaman3();
            else setHalamanAktif('1');
          }}
        />

        {bagian ? (
          // Gaya Korporat mengikuti mode terang/gelap aplikasi, seperti di menu Template Chart.
          <div className="rounded-card">{replikaTampil(Number(halamanAktif), false)}</div>
        ) : (
        <div
          className={`tema-${aktif.tema || 'oranye'} rounded-card p-1.5 -m-1.5`}
          data-theme="dark"
          style={gaya ? variabelGaya(gayaTampil) : undefined}
        >
          <KanvasTemaContext.Provider
            value={
              asli || asli2 ? { mode: 'dark', aksen: AKSEN_TEMA[aktif.tema || 'oranye'] } : null
            }
          >
            {/* Satu komponen untuk ketiga halaman semua template, sama dengan dashboard tersimpan. */}
            {replikaTampil(Number(halamanAktif), false)}
          </KanvasTemaContext.Provider>
        </div>
        )}

        <p className="text-[10.5px] text-ink-3 leading-relaxed border-t border-line pt-4 mt-2 flex items-start gap-1.5">
          <BarChart3 className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            <strong>Simpan sebagai dashboard</strong> menyimpan {bagian ? `${jumlahHalaman} halaman` : 'ketiga halaman'} sekaligus, persis seperti pratinjau ini.
            Angkanya ikut diperbarui setiap kali dokumen instansi bertambah atau berubah.
          </span>
        </p>
          </>
        )}
      </div>

      {/* Mode presentasi pratinjau — layar penuh, seluruh dashboard dalam satu
          halaman (tanpa slide). `pratinjau` menyembunyikan menu kartu. */}
      {presentasi && (
        <PresentationMode
          dashboard={dashPratinjau}
          tenantName={currentTenant?.name}
          onExit={() => setPresentasi(false)}
          pratinjau
          halaman={Array.from({ length: jumlahHalaman }, (_, i) => i + 1).map((nomor) => ({
            id: String(nomor),
            judul: bagian?.halaman[nomor - 1]?.judul ?? `Halaman ${nomor}`,
            konten: replikaTampil(nomor, true),
          }))}
          konten={replikaTampil(1, true)}
        />
      )}
    </div>
  );
};
