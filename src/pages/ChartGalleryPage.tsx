import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { KatalogTemplateChart } from '../components/referensi/KatalogChart';
import { DAFTAR_CHART } from '../services/chart/chartDefault';
import { GAYA, VARIAN, cukupTerang, type Varian } from '../services/chart/gayaVarian';

/**
 * Halaman "Template Chart".
 *
 * Satu katalog chart, banyak gaya (lihat `VARIAN`). Setiap tab menampilkan chart yang sama
 * (jumlahnya selalu sama) dengan tampilan gaya tersebut. Semua dashboard,
 * baik dari Template Dashboard maupun dari asisten, mengambil chart dari
 * katalog ini, jadi apa yang dilihat di sini sama dengan yang tampil di
 * dashboard.
 *
 * Pratinjau memakai angka contoh. Angka di dashboard selalu dari dokumen.
 */

const KETERANGAN: Record<Varian, string> = {
  default: 'Tampilan netral yang mengikuti tema aplikasi: terang di mode terang, gelap di mode gelap. Cocok untuk laporan.',
  ringkasan: 'Beraksen oranye, ikut mode terang/gelap. Angka terpenting disorot agar cepat terbaca pimpinan.',
  analitik: 'Beraksen biru, ikut mode terang/gelap. Cocok untuk menelusuri sebab di balik angka.',
  trafik: 'Beraksen biru muda, ikut mode terang/gelap. Cocok untuk memantau perkembangan harian atau bulanan.',
  kaca: 'Kartu bening di atas latar hangat, beraksen hijau dan jingga. Cocok untuk layar presentasi yang lembut.',
  tirta: 'Laut dalam dengan kartu bening, beraksen aqua dan hijau limau. Khas BUMD air minum; ikut mode terang/gelap.',
  aurora: 'Gradasi ungu dan merah muda yang berpendar di balik kartu bening. Mewah untuk layar presentasi.',
  neon: 'Kisi gelap, huruf mono, dan warna neon menyala. Terasa seperti ruang kendali.',
  blok: 'Neubrutalism: tepi hitam tebal, bayangan keras, warna cerah datar. Berani dan mudah dibaca.',
  bento: 'Pastel lembut dengan sudut kartu besar, seperti widget ponsel. Ramah untuk laporan publik.',
  koran: 'Editorial ala koran Swiss: kertas krem, huruf serif, satu aksen merah. Serius dan rapi untuk dicetak.',
};

export const ChartGalleryPage: React.FC = () => {
  const [tab, setTab] = useState<Varian>('default');
  const g = GAYA[tab];

  return (
    <div className="flex-1 bg-canvas min-h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <div className="bg-surface p-5 rounded-card border border-line mb-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-control bg-solid flex items-center justify-center text-on-solid shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink">Template Chart</h2>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed max-w-3xl">
              {DAFTAR_CHART.length} chart yang dipakai semua dashboard. Setiap chart tersedia dalam {VARIAN.length} gaya: pilih gaya
              di bawah untuk melihat tampilannya. Angka di sini hanya contoh; angka di dashboard selalu dari dokumen
              resmi instansi.
            </p>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-1 pb-2 mb-3 border-b border-line"
          role="tablist"
          aria-label="Gaya chart"
        >
          {VARIAN.map((v) => {
            const aktif = tab === v;
            const aksen = GAYA[v].aksen;
            // Sama dengan tab Template Dashboard: warna gaya sendiri, dicampur token
            // tema supaya teks tetap terbaca di mode gelap maupun terang.
            const palet = GAYA[v].palet.filter(cukupTerang).slice(0, 3);
            return (
              <button
                key={v}
                role="tab"
                aria-selected={aktif}
                onClick={() => setTab(v)}
                data-testid={`tab-katalog-${v}`}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-t-control text-xs font-semibold border-b-2 transition-colors ${
                  aktif ? '' : 'border-transparent text-ink-2 hover:text-ink hover:bg-surface-2'
                }`}
                style={
                  aktif
                    ? {
                        borderBottomColor: aksen,
                        background: `color-mix(in srgb, ${aksen} 14%, transparent)`,
                        color: `color-mix(in srgb, ${aksen} 45%, var(--color-ink))`,
                      }
                    : undefined
                }
              >
                <span className="flex -space-x-1 shrink-0" aria-hidden="true">
                  {palet.map((w, i) => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full ring-2 ring-surface"
                      style={{ background: w, opacity: aktif || i === 0 ? 1 : 0.55 }}
                    />
                  ))}
                </span>
                <span className="whitespace-nowrap">{GAYA[v].nama}</span>
                <span className="text-[9.5px] font-medium text-ink-3">{DAFTAR_CHART.length}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] text-ink-2 mb-5">
          <span className="font-semibold text-ink">{g.nama}.</span> {KETERANGAN[tab]}
        </p>

        <KatalogTemplateChart varian={tab} />
      </div>
    </div>
  );
};
