import React from 'react';
import type { TataLetakBaris, WidgetStyle } from '../../types';
import { DashboardAnalitik } from './DashboardAnalitik';
import { DashboardOperasional } from './DashboardOperasional';
import { DashboardReferensi } from './DashboardReferensi';
import { OperasionalTema, WilayahTema } from './DashboardTemaLain';
import { DashboardTrafik } from './DashboardTrafik';
import { DashboardWilayah } from './DashboardWilayah';
import { KacaOperasional, KacaRingkasan, KacaWilayah } from './DashboardKaca';
import { KonteksGayaReplika, KonteksVarianTemplate } from '../widgets/konteksGayaReplika';
import { varianTemplate } from '../../services/templates/dashboardTemplates';
import type { SumberDok } from '../../services/templates/nilaiOperasional';
import type { WidgetSpec } from '../../types';
import { templateBagianId } from '../../services/templates/templateBagian';
import { DashboardBagian } from './DashboardBagian';

/**
 * REPLIKA SATU HALAMAN DASHBOARD DARI TEMPLATE.
 *
 * `replika.templateId` berbentuk `tpl-x` untuk halaman 1, `tpl-x#2` untuk
 * halaman operasional, dan `tpl-x#3` untuk halaman wilayah. Komponennya sama
 * dengan galeri Template Dashboard, jadi dashboard tersimpan tampil persis
 * seperti pratinjaunya.
 */
interface Props {
  replika: { templateId: string; nilai: unknown };
  gaya?: WidgetStyle;
  tataLetak?: Record<string, TataLetakBaris>;
  onTataLetak?: (baru: Record<string, TataLetakBaris>) => void;
  /** Isi tinggi wadah tanpa gulir (mode presentasi atau kanvas satu layar). */
  penuh?: boolean;
  /** true = angka contoh (galeri template sebelum data asli dimuat). */
  contoh?: boolean;
  /** Kartu bisa dibalik untuk melihat dokumen sumber. Bawaan: aktif. */
  sumberAktif?: boolean;
  /** Sumber per judul widget untuk halaman 1 Pijar. */
  sumberJudul?: Record<string, SumberDok[]>;
}

export const pecahTemplateId = (templateId: string): { dasar: string; nomor: 1 | 2 | 3 } => {
  const [dasar, n] = templateId.split('#');
  return { dasar, nomor: n === '2' ? 2 : n === '3' ? 3 : 1 };
};

/**
 * Gaya dashboard (panel Gaya Semua) dipasang di konteks supaya SETIAP kartu replika
 * di setiap halaman template ikut: desain chart, warna kartu, palet, dan font.
 * Pratinjau contoh di menu Template Dashboard tidak memakai gaya dashboard.
 */
export const ReplikaHalaman: React.FC<Props> = (props) =>
  // Template rapat bagian: halaman berisi kartu Template Chart (`nilai.widgets`).
  templateBagianId(props.replika.templateId) ? (
    <DashboardBagian
      templateId={props.replika.templateId}
      widgets={(props.replika.nilai as { widgets?: WidgetSpec[] } | undefined)?.widgets}
      gaya={props.contoh ? undefined : props.gaya}
      penuh={props.penuh}
      contoh={props.contoh}
    />
  ) : (
  <KonteksVarianTemplate.Provider value={varianTemplate(props.replika.templateId)}>
    <KonteksGayaReplika.Provider value={props.contoh ? undefined : props.gaya}>
      <IsiReplika {...props} />
    </KonteksGayaReplika.Provider>
  </KonteksVarianTemplate.Provider>
  );

const IsiReplika: React.FC<Props> = ({
  replika,
  gaya,
  tataLetak,
  onTataLetak,
  penuh = false,
  contoh = false,
  sumberAktif = true,
  sumberJudul,
}) => {
  const { dasar, nomor } = pecahTemplateId(replika.templateId);
  const nilai = (replika.nilai ?? undefined) as never;
  const warnaKartu = gaya?.kartu;
  const tema = dasar === 'tpl-analitik' ? 'analitik' : dasar === 'tpl-trafik' ? 'trafik' : null;
  const sumber = { contoh, sumberAktif };

  if (dasar === 'tpl-kaca') {
    if (nomor === 2) return <KacaOperasional nilai={nilai} penuh={penuh} warnaKartu={warnaKartu} {...sumber} />;
    if (nomor === 3) return <KacaWilayah nilai={nilai} penuh={penuh} warnaKartu={warnaKartu} {...sumber} />;
    return <KacaRingkasan nilai={nilai} penuh={penuh} warnaKartu={warnaKartu} />;
  }
  if (nomor === 2) {
    return tema ? (
      <OperasionalTema tema={tema} nilai={nilai} penuh={penuh} warnaKartu={warnaKartu} {...sumber} />
    ) : (
      <DashboardOperasional nilai={nilai} penuh={penuh} gaya={gaya} warnaKartu={warnaKartu} {...sumber} />
    );
  }
  if (nomor === 3) {
    return tema ? (
      <WilayahTema tema={tema} nilai={nilai} penuh={penuh} warnaKartu={warnaKartu} {...sumber} />
    ) : (
      <DashboardWilayah nilai={nilai} penuh={penuh} gaya={gaya} warnaKartu={warnaKartu} {...sumber} />
    );
  }
  const umum = { nilai, warnaKartu, gaya, tataLetak, onTataLetak, penuh };
  if (dasar === 'tpl-analitik') return <DashboardAnalitik {...umum} />;
  if (dasar === 'tpl-trafik') return <DashboardTrafik {...umum} />;
  return <DashboardReferensi {...umum} sumberAktif={Boolean(sumberJudul) && sumberAktif && !contoh} sumberJudul={sumberJudul} />;
};

/**
 * WADAH SATU LAYAR.
 *
 * Dashboard tidak boleh digulir: wadah ini mengukur jarak dari posisinya ke
 * dasar jendela lalu memberi tinggi tetap, dan replika digambar dalam mode
 * `penuh` (menyusut mengikuti tinggi). Di layar sempit (< 1024 px) kartu tetap
 * ditumpuk dan boleh digulir, karena tidak mungkin muat satu layar.
 */
export const PasLayar: React.FC<{ children: (penuh: boolean) => React.ReactNode }> = ({ children }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [tinggi, setTinggi] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const hitung = () => {
      const el = ref.current;
      if (!el || window.innerWidth < 1024) return setTinggi(null);
      const atas = el.getBoundingClientRect().top + window.scrollY;
      setTinggi(Math.max(420, window.innerHeight - atas - 12));
    };
    hitung();
    window.addEventListener('resize', hitung);
    return () => window.removeEventListener('resize', hitung);
  }, []);

  return (
    <div ref={ref} className={tinggi ? 'overflow-hidden' : 'pb-4'} style={tinggi ? { height: tinggi } : undefined}>
      {children(Boolean(tinggi))}
    </div>
  );
};
