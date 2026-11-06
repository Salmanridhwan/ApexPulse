import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Building2, ChevronsUpDown, KeyRound, LogOut, Mail, Moon, Sun, X } from 'lucide-react';
import type { Tenant, User } from '../types';
import { AvatarTile } from './BrandMark';
import { GantiPasswordWajib } from './GantiPasswordWajib';
import { labelPeran } from '../services/auth/peran';
import { applyTheme, EVENT_TEMA, getInitialTheme, type ThemeMode } from '../theme';

/**
 * MENU AKUN DI KAKI SIDEBAR.
 *
 * Kartu pengguna menjadi satu tombol. Diklik, muncul menu kecil berisi
 * identitas akun, ganti kata sandi, tema, panduan singkat, dan keluar (dengan
 * konfirmasi). Menu digambar lewat portal dengan posisi tetap, supaya tidak
 * terpotong saat sidebar diciutkan.
 */
interface Props {
  user: User | null;
  tenant?: Tenant | null;
  ciut: boolean;
  onLogout: () => void;
}

const LANGKAH_PANDUAN = [
  {
    judul: 'Buat dashboard dari template',
    isi: 'Buka Template Dashboard, pilih desain (Pijar, Lensa, Nadi, atau Kaca), tekan Pratinjau dengan data asli, lalu Simpan sebagai dashboard.',
  },
  {
    judul: 'Buat dashboard lewat Asisten',
    isi: 'Tekan tombol Asisten di kanan bawah, lalu ketik misalnya "buatkan dashboard kinerja keuangan gaya kaca". Asisten memilih chart dan membaginya ke beberapa halaman.',
  },
  {
    judul: 'Atur tampilan',
    isi: 'Di dashboard, buka panel Gaya untuk mengganti desain chart, warna kartu, dan ukuran huruf, untuk semua widget atau satu widget saja.',
  },
  {
    judul: 'Presentasikan',
    isi: 'Tekan Mode Presentasi. Pindah halaman dengan tombol panah, keluar dengan Esc.',
  },
];

export const AkunMenu: React.FC<Props> = ({ user, tenant, ciut, onLogout }) => {
  const [buka, setBuka] = useState(false);
  const [yakinKeluar, setYakinKeluar] = useState(false);
  const [gantiSandi, setGantiSandi] = useState(false);
  const [panduan, setPanduan] = useState(false);
  const [sandiBerhasil, setSandiBerhasil] = useState(false);
  const [tema, setTema] = useState<ThemeMode>(getInitialTheme);
  const [posisi, setPosisi] = useState<React.CSSProperties>({});
  const tombolRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const peran = labelPeran(user?.role);
  const sub = tenant?.name ? `${peran} · ${tenant.name}` : peran;
  const akunGoogle = Boolean(user?.viaGoogle || user?.googleSub);

  // Tema yang diganti dari saklar lain ikut tampil benar di sini.
  useEffect(() => {
    const ikut = (e: Event) => setTema((e as CustomEvent<ThemeMode>).detail);
    window.addEventListener(EVENT_TEMA, ikut);
    return () => window.removeEventListener(EVENT_TEMA, ikut);
  }, []);

  // Letak menu: di atas kartu saat sidebar lebar, di kanan avatar saat diciutkan.
  useLayoutEffect(() => {
    if (!buka || !tombolRef.current) return;
    const r = tombolRef.current.getBoundingClientRect();
    setPosisi(
      ciut
        ? { left: r.right + 8, bottom: Math.max(8, window.innerHeight - r.bottom) }
        : { left: r.left, bottom: window.innerHeight - r.top + 8, width: Math.max(240, r.width) }
    );
  }, [buka, ciut]);

  // Tutup saat klik di luar atau menekan Esc.
  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || tombolRef.current?.contains(t)) return;
      setBuka(false);
      setYakinKeluar(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBuka(false);
        setYakinKeluar(false);
      }
    };
    document.addEventListener('mousedown', luar);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', luar);
      document.removeEventListener('keydown', esc);
    };
  }, [buka]);

  const tutup = () => {
    setBuka(false);
    setYakinKeluar(false);
  };

  const butir =
    'w-full flex items-center gap-2.5 px-3 py-2 rounded-control text-[12.5px] text-ink hover:bg-surface-2 transition-colors text-left';

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={buka}
        data-testid="tombol-akun"
        title={ciut ? `${user?.name ?? 'Pengguna'} · ${sub}` : 'Menu akun'}
        className={`w-full flex items-center gap-2.5 rounded-control transition-colors hover:bg-shell-hover text-left ${
          ciut ? 'justify-center p-1' : 'p-1.5'
        } ${buka ? 'bg-shell-hover' : ''}`}
      >
        <AvatarTile name={user?.name} id={user?.id} size="sm" />
        {!ciut && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-shell-ink truncate">{user?.name || 'Pengguna'}</span>
              <span className="block text-[10px] text-shell-ink-2 truncate mt-0.5">{sub}</span>
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-shell-ink-2 shrink-0" />
          </>
        )}
      </button>

      {buka &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            data-testid="menu-akun"
            className="fixed z-[80] w-[260px] rounded-card border border-line bg-surface shadow-pop p-1.5 text-ink"
            style={posisi}
          >
            {/* Identitas akun */}
            <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-3 border-b border-line mb-1">
              <AvatarTile name={user?.name} id={user?.id} size="md" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold truncate">{user?.name || 'Pengguna'}</p>
                <p className="text-[11px] text-ink-3 truncate flex items-center gap-1">
                  <Mail className="w-3 h-3 shrink-0" />
                  {user?.email || '—'}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-chip bg-brand-soft text-brand-ink">{peran}</span>
                  {tenant?.name && (
                    <span className="text-[10px] text-ink-2 truncate flex items-center gap-1 min-w-0">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{tenant.name}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {yakinKeluar ? (
              <div className="px-2.5 py-2">
                <p className="text-[12.5px] font-semibold">Keluar dari akun ini?</p>
                <p className="text-[11px] text-ink-3 mt-0.5">Perubahan yang belum disimpan akan hilang.</p>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setYakinKeluar(false)}
                    className="text-[12px] px-3 py-1.5 rounded-control border border-line hover:bg-surface-2"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    data-testid="konfirmasi-keluar"
                    onClick={() => {
                      tutup();
                      onLogout();
                    }}
                    className="text-[12px] px-3 py-1.5 rounded-control bg-neg text-white font-semibold hover:opacity-90"
                  >
                    Ya, keluar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!akunGoogle && (
                  <button
                    type="button"
                    role="menuitem"
                    className={butir}
                    onClick={() => {
                      tutup();
                      setSandiBerhasil(false);
                      setGantiSandi(true);
                    }}
                  >
                    <KeyRound className="w-4 h-4 text-ink-3" />
                    Ganti kata sandi
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className={butir}
                  onClick={() => applyTheme(tema === 'dark' ? 'light' : 'dark')}
                >
                  {tema === 'dark' ? <Sun className="w-4 h-4 text-ink-3" /> : <Moon className="w-4 h-4 text-ink-3" />}
                  <span className="flex-1">{tema === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={butir}
                  onClick={() => {
                    tutup();
                    setPanduan(true);
                  }}
                >
                  <BookOpen className="w-4 h-4 text-ink-3" />
                  Panduan singkat
                </button>
                <div className="border-t border-line my-1" />
                <button
                  type="button"
                  role="menuitem"
                  data-testid="menu-keluar"
                  className={`${butir} text-neg hover:bg-neg/10`}
                  onClick={() => setYakinKeluar(true)}
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </>
            )}
          </div>,
          document.body
        )}

      {gantiSandi && (
        <GantiPasswordWajib
          wajib={false}
          namaPengguna={user?.name}
          onKeluar={() => setGantiSandi(false)}
          onSelesai={() => {
            setGantiSandi(false);
            setSandiBerhasil(true);
          }}
        />
      )}

      {sandiBerhasil &&
        createPortal(
          <div
            role="status"
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] rounded-card bg-solid text-on-solid px-4 py-2.5 text-[12.5px] font-semibold shadow-pop flex items-center gap-3"
          >
            Kata sandi berhasil diganti.
            <button type="button" onClick={() => setSandiBerhasil(false)} aria-label="Tutup" className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>,
          document.body
        )}

      {panduan &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4"
            onClick={() => setPanduan(false)}
          >
            <div
              role="dialog"
              aria-label="Panduan singkat"
              className="w-full max-w-lg rounded-card border border-line bg-surface p-6 text-ink shadow-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold">Panduan singkat</h2>
                  <p className="text-xs text-ink-3 mt-0.5">Empat langkah utama memakai aplikasi ini.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanduan(false)}
                  aria-label="Tutup panduan"
                  className="p-1 rounded-control text-ink-3 hover:bg-surface-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-3">
                {LANGKAH_PANDUAN.map((l, i) => (
                  <li key={l.judul} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand text-on-brand text-[11px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold">{l.judul}</p>
                      <p className="text-[12px] text-ink-2 leading-relaxed mt-0.5">{l.isi}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
