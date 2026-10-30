import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { TataLetakBaris } from '../../types';
import { lebarKartu, ubahLebarKartu, ubahTinggiKartu, urutkanKartu } from '../../services/tataLetakBaris';

/**
 * BARIS KARTU DESAIN TEMPLATE YANG TATA LETAKNYA BISA DIUBAH LANGSUNG.
 *
 * Komponen replika (`DashboardReferensi`, `DashboardAnalitik`, `DashboardTrafik`)
 * disusun dari beberapa baris grid. Pembungkus ini TIDAK menyentuh isi kartu: ia
 * memakai ulang kelas grid yang sudah ada, lalu mengatur posisi tiap anak lewat
 * CSS `order`, `grid-column`, dan `height`. Desain asli tetap utuh.
 *
 * Interaksi:
 * - Tekan kartu mana pun lalu gerakkan lebih dari 5 piksel → kartu terangkat dan
 *   mengikuti kursor; kartu lain bergeser real-time.
 * - Setiap SISI kartu punya pegangan tarik: kiri/kanan mengubah lebar kolom,
 *   atas/bawah mengubah tinggi kartu. Semuanya berubah sambil ditarik.
 */

export interface BarisGeserProps {
  /** Kunci baris, mis. `kpi`, `grafik`, `tabel`. */
  grupId: string;
  /** Kelas grid asli baris tersebut. */
  className?: string;
  /** Batas jumlah kolom pada layar lebar. */
  kolom?: number;
  tataLetak?: TataLetakBaris;
  onUbah?: (grupId: string, baru: TataLetakBaris) => void;
  /** Matikan pengubahan (Mode Presentasi / galeri pratinjau). */
  bisaUbah?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

interface KotakHover {
  nomor: number;
  top: number;
  left: number;
  lebar: number;
  tinggi: number;
}

interface Seret {
  nomor: number;
  /** `pindah` = geser urutan, `lebar` = ubah lebar, `tinggi` = ubah tinggi. */
  mode: 'pindah' | 'lebar' | 'tinggi';
  /** Arah sisi: -1 untuk sisi kiri/atas, +1 untuk sisi kanan/bawah. */
  arah: -1 | 1;
  geserX: number;
  geserY: number;
  x: number;
  y: number;
  lebarAwal: number;
  tinggiAwal: number;
  lebarKolom: number;
}

const TINGGI_MIN = 56;
const TINGGI_MAKS = 900;

export const BarisGeser: React.FC<BarisGeserProps> = ({
  grupId,
  className,
  kolom = 4,
  tataLetak,
  onUbah,
  bisaUbah = true,
  style,
  children,
}) => {
  const wadahRef = useRef<HTMLDivElement>(null);
  const elemenSeret = useRef<HTMLElement | null>(null);
  /** Posisi tepi kartu saat tarikan mulai, dipakai menghitung lebar/tinggi baru. */
  const rectAwal = useRef<{ kiri: number; atas: number; kanan: number; bawah: number } | null>(null);

  const [hover, setHover] = useState<KotakHover | null>(null);
  const [seret, setSeret] = useState<Seret | null>(null);
  const [calon, setCalon] = useState<{ nomor: number; x: number; y: number } | null>(null);
  const [pratinjauLebar, setPratinjauLebar] = useState<number | null>(null);
  const [pratinjauTinggi, setPratinjauTinggi] = useState<number | null>(null);
  /** Urutan sementara selama kartu diangkat: membuat kartu lain bergeser langsung. */
  const [urutSementara, setUrutSementara] = useState<string[] | null>(null);

  /**
   * Aturan CSS dipasang di `document.head`, BUKAN sebagai anak baris. Kalau
   * ditulis sebagai elemen <style> di dalam baris, ia ikut terhitung sebagai
   * anak grid dan seluruh penomoran kartu bergeser satu.
   */
  const idGaya = `tata-letak-${useId().replace(/:/g, '')}`;

  const jumlah = React.Children.toArray(children).length;
  const semuaNomor = useMemo(() => Array.from({ length: jumlah }, (_, i) => String(i + 1)), [jumlah]);
  const urut = urutkanKartu(semuaNomor, tataLetak?.urut);
  const urutTampil = urutSementara ?? urut;

  const larikUbah = useCallback((baru: TataLetakBaris) => onUbah?.(grupId, baru), [grupId, onUbah]);

  const aturanCss = useMemo(() => {
    if (jumlah === 0) return '';
    return semuaNomor
      .map((nomor, i) => {
        const posisi = urutTampil.indexOf(nomor);
        const sedangLebar = seret?.mode === 'lebar' && String(seret.nomor) === nomor;
        const sedangTinggi = seret?.mode === 'tinggi' && String(seret.nomor) === nomor;
        const lebar = sedangLebar && pratinjauLebar ? pratinjauLebar : lebarKartu(nomor, kolom, tataLetak);
        const tinggi =
          sedangTinggi && pratinjauTinggi ? pratinjauTinggi : tataLetak?.tinggi?.[nomor];
        const aturan = [`order:${posisi < 0 ? i : posisi}`];
        if (lebar > 1) aturan.push(`grid-column:span ${lebar} / span ${lebar}`);
        if (tinggi) aturan.push(`height:${Math.round(tinggi)}px`);
        return `[data-grup-kartu="${grupId}"] > *:nth-child(${i + 1}){${aturan.join(';')}}`;
      })
      .join('');
  }, [grupId, jumlah, kolom, tataLetak, semuaNomor, urutTampil, seret, pratinjauLebar, pratinjauTinggi]);

  useEffect(() => {
    let el = document.getElementById(idGaya) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = idGaya;
      document.head.appendChild(el);
    }
    el.textContent = aturanCss;
    return () => {
      el?.remove();
    };
  }, [aturanCss, idGaya]);

  const kotakKartu = (nomor: number): KotakHover | null => {
    const wadah = wadahRef.current;
    if (!wadah) return null;
    const kartu = wadah.children[nomor - 1] as HTMLElement | undefined;
    if (!kartu) return null;
    const r = kartu.getBoundingClientRect();
    const rw = wadah.getBoundingClientRect();
    return { nomor, top: r.top - rw.top, left: r.left - rw.left, lebar: r.width, tinggi: r.height };
  };

  /** Angkat kartu: naik lapisan, diberi bayangan, dan mulai mengikuti kursor. */
  const angkat = (nomor: number, clientX: number, clientY: number) => {
    const wadah = wadahRef.current;
    if (!wadah) return;
    const kartu = wadah.children[nomor - 1] as HTMLElement | undefined;
    const rw = wadah.getBoundingClientRect();
    const r = kartu?.getBoundingClientRect();

    if (kartu && r) {
      elemenSeret.current = kartu;
      kartu.style.transition = 'none';
      kartu.style.willChange = 'transform';
      kartu.style.position = 'relative';
      kartu.style.zIndex = '60';
      kartu.style.boxShadow = '0 18px 40px rgba(0,0,0,0.45)';
      kartu.style.cursor = 'grabbing';
      kartu.style.transform = 'scale(1.02)';
    }

    setSeret({
      nomor,
      mode: 'pindah',
      arah: 1,
      geserX: r ? clientX - r.left : 0,
      geserY: r ? clientY - r.top : 0,
      x: clientX,
      y: clientY,
      lebarAwal: lebarKartu(String(nomor), kolom, tataLetak),
      tinggiAwal: r?.height ?? 0,
      lebarKolom: (rw.width + 10) / kolom,
    });
    setUrutSementara(urut);
  };

  /**
   * Urutan baru menurut posisi kursor: kartu di bawah kursor menjadi penanda, dan
   * kartu yang diangkat disisipkan sebelum atau sesudahnya menurut titik tengah.
   */
  const hitungUrutBaru = (nomor: number, clientX: number, clientY: number): string[] | null => {
    const wadah = wadahRef.current;
    if (!wadah) return null;
    const dasar = urutSementara ?? urut;
    // Kartu yang diangkat berada paling atas di titik kursor, jadi harus dilewati.
    const diBawah = document
      .elementsFromPoint(clientX, clientY)
      .find((el) => {
        if (el.parentElement !== wadah) return false;
        // Pegangan sisi dan badge ukuran juga anak wadah; jangan dianggap kartu.
        if (el.getAttribute('role') === 'separator' || el.tagName === 'SPAN') return false;
        return Array.from(wadah.children).indexOf(el) + 1 !== nomor;
      }) as HTMLElement | undefined;
    if (!diBawah) return null;
    const nomorSasaran = String(Array.from(wadah.children).indexOf(diBawah) + 1);

    const r = diBawah.getBoundingClientRect();
    const sesudah = clientX > r.left + r.width / 2;
    const tanpa = dasar.filter((n) => n !== String(nomor));
    const posisiSasaran = tanpa.indexOf(nomorSasaran);
    if (posisiSasaran < 0) return null;
    const sisip = sesudah ? posisiSasaran + 1 : posisiSasaran;
    const hasil = [...tanpa];
    hasil.splice(sisip, 0, String(nomor));
    return hasil.join(',') === dasar.join(',') ? null : hasil;
  };

  /** Tekan kartu → calon geser; gerakan > 5px memulai pengangkatan. */
  useEffect(() => {
    if (!calon) return;
    const gerak = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - calon.x, e.clientY - calon.y) < 5) return;
      const { nomor, x, y } = calon;
      setCalon(null);
      angkat(nomor, x, y);
    };
    const lepas = () => setCalon(null);
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas, { once: true });
    return () => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calon, kolom, tataLetak, urut]);

  /** Selama berlangsung: kompensasi posisi, reflow kartu lain, lalu simpan saat dilepas. */
  useEffect(() => {
    if (!seret) return;
    const wadah = wadahRef.current;
    document.body.style.userSelect = 'none';

    const pindah = (e: PointerEvent) => {
      const r0 = rectAwal.current;
      if (seret.mode === 'lebar') {
        // Lebar dihitung dari jarak tepi kartu ke kursor, bukan akumulasi gerakan,
        // supaya kartu langsung bereaksi begitu melewati batas kolom.
        if (!r0) return;
        const px = seret.arah > 0 ? e.clientX - r0.kiri : r0.kanan - e.clientX;
        const baru = Math.min(Math.max(Math.round(px / Math.max(seret.lebarKolom, 1)), 1), kolom);
        setPratinjauLebar(baru);
        const kotak = kotakKartu(seret.nomor);
        if (kotak) setHover(kotak);
        return;
      }

      if (seret.mode === 'tinggi') {
        if (!r0) return;
        const px = seret.arah > 0 ? e.clientY - r0.atas : r0.bawah - e.clientY;
        setPratinjauTinggi(Math.min(Math.max(px, TINGGI_MIN), TINGGI_MAKS));
        const kotak = kotakKartu(seret.nomor);
        if (kotak) setHover(kotak);
        return;
      }

      const kartu = elemenSeret.current;
      if (kartu && wadah) {
        // Posisi layout kartu bisa berubah karena kartu lain bergeser; transform
        // dihitung ulang dari posisi layout terbaru agar kartu tetap di bawah kursor.
        const rw = wadah.getBoundingClientRect();
        const kiri = rw.left + kartu.offsetLeft;
        const atas = rw.top + kartu.offsetTop;
        const dx = e.clientX - seret.geserX - kiri;
        const dy = e.clientY - seret.geserY - atas;
        kartu.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;
      }

      const baru = hitungUrutBaru(seret.nomor, e.clientX, e.clientY);
      if (baru) setUrutSementara(baru);
    };

    const lepas = () => {
      if (seret.mode === 'lebar' && pratinjauLebar) {
        larikUbah(ubahLebarKartu(String(seret.nomor), pratinjauLebar, kolom, tataLetak));
      } else if (seret.mode === 'tinggi' && pratinjauTinggi) {
        larikUbah(ubahTinggiKartu(String(seret.nomor), pratinjauTinggi, tataLetak));
      } else if (seret.mode === 'pindah' && urutSementara && urutSementara.join(',') !== urut.join(',')) {
        larikUbah({ ...tataLetak, urut: urutSementara });
      }

      const kartu = elemenSeret.current;
      if (kartu) {
        kartu.style.transform = '';
        kartu.style.position = '';
        kartu.style.zIndex = '';
        kartu.style.boxShadow = '';
        kartu.style.transition = '';
        kartu.style.willChange = '';
        kartu.style.cursor = '';
      }
      elemenSeret.current = null;
      setSeret(null);
      setUrutSementara(null);
      setPratinjauLebar(null);
      setPratinjauTinggi(null);
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', pindah);
    window.addEventListener('pointerup', lepas, { once: true });
    return () => {
      window.removeEventListener('pointermove', pindah);
      window.removeEventListener('pointerup', lepas);
      document.body.style.userSelect = '';
    };
  }, [seret, urutSementara, urut, pratinjauLebar, pratinjauTinggi, tataLetak, kolom, larikUbah]);

  const lacakHover = (e: React.MouseEvent) => {
    if (!bisaUbah || seret) return;
    const wadah = wadahRef.current;
    if (!wadah) return;
    const anak = Array.from(wadah.children).find((el) => {
      if (!(el === e.target || el.contains(e.target as Node))) return false;
      // Pegangan sisi dan badge ukuran juga anak wadah. Tanpa dilewati, kursor yang
      // menyentuh pegangan dianggap menyentuh kartu baru dan pegangan itu "kabur".
      return el.getAttribute('role') !== 'separator' && el.tagName !== 'SPAN';
    });
    if (!anak) return;
    const nomorAnak = Array.from(wadah.children).indexOf(anak) + 1;
    const kotak = kotakKartu(nomorAnak);
    if (kotak) setHover(kotak);
  };

  /** Mulai menarik salah satu sisi kartu. */
  const mulaiSisi = (e: React.PointerEvent, mode: 'lebar' | 'tinggi', arah: -1 | 1) => {
    if (!hover) return;
    e.preventDefault();
    e.stopPropagation();
    const wadah = wadahRef.current;
    const kartu = wadah?.children[hover.nomor - 1] as HTMLElement | undefined;
    const r = kartu?.getBoundingClientRect();
    if (r) rectAwal.current = { kiri: r.left, atas: r.top, kanan: r.right, bawah: r.bottom };
    setSeret({
      nomor: hover.nomor,
      mode,
      arah,
      geserX: 0,
      geserY: 0,
      x: e.clientX,
      y: e.clientY,
      lebarAwal: lebarKartu(String(hover.nomor), kolom, tataLetak),
      tinggiAwal: kartu?.getBoundingClientRect().height ?? 0,
      lebarKolom: wadah ? (wadah.getBoundingClientRect().width + 10) / kolom : 100,
    });
  };

  /** Tekan kartu di mana pun: catat sebagai calon geser (belum mengangkat). */
  const tekanKartu = (e: React.PointerEvent) => {
    if (!bisaUbah || seret || !hover) return;
    if (e.button !== 0) return;
    setCalon({ nomor: hover.nomor, x: e.clientX, y: e.clientY });
  };

  /** Gaya pegangan di tiap sisi kartu. */
  const sisi: Array<{
    mode: 'lebar' | 'tinggi';
    arah: -1 | 1;
    kursor: string;
    posisi: React.CSSProperties;
    judul: string;
  }> = hover
    ? [
        {
          mode: 'lebar',
          arah: 1,
          kursor: 'col-resize',
          posisi: { top: hover.top + 10, left: hover.left + hover.lebar - 5, height: Math.max(hover.tinggi - 20, 28), width: 12 },
          judul: 'Tarik untuk melebarkan kartu',
        },
        {
          mode: 'lebar',
          arah: -1,
          kursor: 'col-resize',
          posisi: { top: hover.top + 10, left: hover.left - 5, height: Math.max(hover.tinggi - 20, 28), width: 12 },
          judul: 'Tarik untuk melebarkan kartu',
        },
        {
          mode: 'tinggi',
          arah: 1,
          kursor: 'row-resize',
          posisi: { left: hover.left + 10, top: hover.top + hover.tinggi - 5, width: Math.max(hover.lebar - 20, 28), height: 12 },
          judul: 'Tarik untuk menambah tinggi kartu',
        },
        {
          mode: 'tinggi',
          arah: -1,
          kursor: 'row-resize',
          posisi: { left: hover.left + 10, top: hover.top - 5, width: Math.max(hover.lebar - 20, 28), height: 12 },
          judul: 'Tarik untuk menambah tinggi kartu',
        },
      ]
    : [];

  return (
    <div
      ref={wadahRef}
      className={className}
      data-grup-kartu={grupId}
      onMouseOver={lacakHover}
      onPointerDown={tekanKartu}
      onMouseLeave={(e) => {
        if (seret) return;
        // Kursor pindah ke pegangan sisi tetap dianggap masih di kartu.
        if ((e.relatedTarget as HTMLElement | null)?.closest('[data-grup-kartu]')) return;
        setHover(null);
      }}
      style={{ position: 'relative', ...style, cursor: bisaUbah && !seret ? 'grab' : undefined }}
    >
      {children}

      {/* Pegangan di setiap sisi kartu yang sedang disorot */}
      {bisaUbah &&
        hover &&
        seret?.mode !== 'pindah' &&
        sisi.map((s) => (
          <div
            key={`${s.mode}-${s.arah}`}
            role="separator"
            aria-label={s.judul}
            title={s.judul}
            onPointerDown={(e) => mulaiSisi(e, s.mode, s.arah)}
            className="absolute z-30"
            style={{ ...s.posisi, cursor: s.kursor, pointerEvents: 'auto' }}
          >
            <span
              className={`block h-full w-full rounded-full transition-colors ${
                seret?.mode === s.mode ? 'bg-white/70' : 'bg-white/0 hover:bg-white/45'
              }`}
            />
          </div>
        ))}

      {/* Penunjuk ukuran saat sisi ditarik */}
      {bisaUbah && seret && (seret.mode === 'lebar' || seret.mode === 'tinggi') && (
        <span
          className="pointer-events-none absolute z-20 rounded-full bg-black/75 px-[0.5em] py-[0.1em] text-[0.7em] font-semibold text-white"
          style={{ top: (hover?.top ?? 0) + 6, left: (hover?.left ?? 0) + 6 }}
        >
          {seret.mode === 'lebar' ? `${pratinjauLebar ?? lebarKartu(String(seret.nomor), kolom, tataLetak)} kolom` : `${Math.round(pratinjauTinggi ?? seret.tinggiAwal)} px`}
        </span>
      )}
    </div>
  );
};
