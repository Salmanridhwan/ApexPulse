import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  User as UserIcon,
  Building2,
  UserPlus,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Tenant, User } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';
import { AuthBackdrop } from '../components/AuthBackdrop';
const Hero3D = React.lazy(() => import('../components/Hero3D').then((m) => ({ default: m.Hero3D })));

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
  tenants: Tenant[];
}

/** Bentuk minimal Google Identity Services yang dipakai (dimuat dari accounts.google.com). */
interface GoogleIdConfig {
  client_id: string;
  callback: (resp: { credential?: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}
interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (cfg: GoogleIdConfig) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
      prompt?: () => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const GOOGLE_SCRIPT_ID = 'gsi-client-script';

/** Muat skrip Google Identity Services sekali saja (idempoten). */
function muatSkripGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const ada = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (ada) {
      ada.addEventListener('load', () => resolve());
      ada.addEventListener('error', () => reject(new Error('Gagal memuat skrip Google.')));
      return;
    }
    const s = document.createElement('script');
    s.id = GOOGLE_SCRIPT_ID;
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal memuat skrip Google.'));
    document.head.appendChild(s);
  });
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, tenants }) => {
  /** 'login' = masuk, 'register' = daftar akun baru. */
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Field masuk
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Field daftar
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  // Daftar instansi untuk form pendaftaran. Diambil dari /api/auth/tenants
  // (endpoint ringkas yang hanya hidup saat pendaftaran terbuka) — prop
  // `tenants` dari App kini kosong sebelum login karena /api/tenants wajib sesi.
  const [daftarTenant, setDaftarTenant] = useState<{ id: string; name: string }[]>([]);
  const [regTenant, setRegTenant] = useState<string>('tenant-pdam');

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Sign-In
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [googleError, setGoogleError] = useState<string | null>(null);
  /**
   * Pendaftaran berhasil DITERIMA tetapi belum aktif: akun menunggu persetujuan
   * admin instansi. Sesi sengaja tidak dibuat, jadi halaman ini menggantikan form.
   */
  const [pendingInfo, setPendingInfo] = useState<{
    email: string;
    tenantName?: string | null;
    tenantId?: string | null;
    message: string;
    /** ID token Google yang dipakai mendaftar — dipakai ulang saat ganti instansi. */
    credential?: string;
    /** true = email Google belum terdaftar; panel meminta instansi lebih dulu. */
    perluPilih?: boolean;
  } | null>(null);
  /** Instansi pilihan pada layar "Menunggu persetujuan" (bisa diperbaiki di situ). */
  const [pendingTenant, setPendingTenant] = useState<string>('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  /** Simpan profil user untuk boot UI cepat (sesi asli tetap cookie HttpOnly). */
  const simpanSesi = (user: User, remember: boolean) => {
    const store = remember ? localStorage : sessionStorage;
    store.setItem('aionesboard_user', JSON.stringify(user));
    onLoginSuccess(user, 'cookie-session');
  };

  // Ambil konfigurasi auth (Client ID Google) + daftar instansi untuk form daftar.
  useEffect(() => {
    let batal = false;
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!batal && cfg?.googleClientId) setGoogleClientId(cfg.googleClientId);
      })
      .catch(() => {});
    // Daftar instansi ringkas (hanya id + nama) untuk dropdown pendaftaran.
    fetch('/api/auth/tenants')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string }[]) => {
        if (batal || !Array.isArray(list)) return;
        setDaftarTenant(list);
        if (list.length > 0) setRegTenant(list[0].id);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, []);

  /**
   * Kirim ID token Google ke server untuk diverifikasi & diterbitkan sesi.
   * Server membuat akun otomatis bila email belum terdaftar.
   */
  const masukDenganGoogle = async (credential: string, tenantOverride?: string) => {
    setErrorMessage(null);
    setGoogleError(null);
    setIsLoading(true);
    try {
      // Instansi HANYA dikirim bila pengguna memilihnya sendiri pada panel
      // setelah klik Google. Tidak ada fallback ke instansi pertama — itulah
      // sumber bug "langsung terpilih Tirta Moedal".
      const tenantGoogle = tenantOverride ?? '';
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantGoogle ? { credential, tenantId: tenantGoogle } : { credential }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.kode === 'BUTUH_INSTANSI') {
          // Email Google belum terdaftar dan belum ada instansi yang dipilih.
          // Tampilkan panel pemilih instansi; token Google disimpan agar bisa
          // dipakai ulang tanpa perlu sign-in ulang.
          setPendingInfo({
            email: data?.email || '',
            tenantName: null,
            tenantId: null,
            message:
              'Email Google Anda belum terdaftar. Pilih instansi BUMD tempat Anda bertugas untuk melanjutkan pendaftaran.',
            credential,
            perluPilih: true,
          });
          setPendingTenant('');
          return;
        }
        if (data?.kode === 'PENDING_APPROVAL' || data?.kode === 'ACCOUNT_REJECTED') {
          setPendingInfo({
            email: data?.email || '',
            tenantName: data?.tenantName || null,
            tenantId: data?.tenantId || null,
            message: data?.error || 'Akun Anda belum aktif.',
            credential,
          });
          setPendingTenant(data?.tenantId || '');
          return;
        }
        throw new Error(data?.error || 'Login Google gagal.');
      }
      if (data?.status === 'pending' || !data?.user) {
        setPendingInfo({
          email: data?.email || '',
          tenantName: data?.tenantName || null,
          tenantId: data?.tenantId || null,
          message: data?.message || 'Pendaftaran diterima dan menunggu persetujuan admin instansi.',
          credential,
        });
        setPendingTenant(data?.tenantId || '');
        return;
      }
      simpanSesi(data.user, rememberMe);
    } catch (err: any) {
      setGoogleError(err.message || 'Login Google gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  // Render tombol resmi Google begitu Client ID & skrip siap.
  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return;
    let batal = false;
    let bersihkan: (() => void) | undefined;
    muatSkripGoogle()
      .then(() => {
        if (batal || !window.google?.accounts?.id || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (resp) => {
            if (resp?.credential) void masukDenganGoogle(resp.credential);
          },
        });
        // Tombol Google punya tema sendiri: `outline` = putih (mode terang),
        // `filled_black` = gelap (mode gelap). Tanpa ini tombol putih menyala
        // di tengah halaman gelap.
        const gambar = () => {
          if (!window.google?.accounts?.id || !googleBtnRef.current) return;
          const gelap = document.documentElement.dataset.theme === 'dark';
          googleBtnRef.current.replaceChildren();
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: gelap ? 'filled_black' : 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
          });
        };
        gambar();
        const pengamat = new MutationObserver(gambar);
        pengamat.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        bersihkan = () => pengamat.disconnect();
      })
      .catch(() => setGoogleError('Tidak bisa memuat tombol Google. Periksa koneksi Anda.'));
    return () => {
      batal = true;
      bersihkan?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, mode, regTenant]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.kode === 'PENDING_APPROVAL' || data?.kode === 'ACCOUNT_REJECTED') {
          setPendingInfo({
            email: email.trim(),
            tenantName: data.tenantName || null,
            message: data.error || 'Akun Anda belum aktif.',
          });
          return;
        }
        throw new Error(data.error || 'Email atau kata sandi tidak sesuai.');
      }
      simpanSesi(data.user, rememberMe);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (regPassword !== regPassword2) {
      setErrorMessage('Konfirmasi kata sandi tidak sama.');
      return;
    }
    if (regPassword.length < 10) {
      setErrorMessage('Kata sandi minimal 10 karakter, serta memuat huruf dan angka.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          tenantId: regTenant,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pendaftaran gagal.');
      // 202 = pendaftaran diterima, bukan sesi. Akun menunggu persetujuan admin.
      if (data?.status === 'pending' || !data?.user) {
        setPendingInfo({
          email: data?.email || regEmail.trim(),
          tenantName: data?.tenantName || null,
          message: data?.message || 'Pendaftaran diterima dan menunggu persetujuan admin instansi.',
        });
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setRegPassword2('');
        return;
      }
      simpanSesi(data.user, rememberMe);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  const gantiMode = (m: 'login' | 'register') => {
    setMode(m);
    setErrorMessage(null);
    setGoogleError(null);
  };

  const inputCls =
    'w-full text-xs pl-9 pr-3 py-2 bg-surface border border-line-strong rounded-control text-ink placeholder-ink-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all font-medium';

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans antialiased text-ink overflow-x-hidden">
      {/* Latar bergerak: dokumen instansi mengalir menjadi dashboard. */}
      <AuthBackdrop />

      {/* Header */}
      <header className="relative z-10 bg-surface/70 backdrop-blur-md border-b border-line px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo resmi: lockup navy untuk latar terang, versi putih untuk mode gelap. */}
            <img
              src="/brand/logo-lockup.png"
              alt="Aiones Boards"
              width={186}
              height={48}
              className="auth-logo-pulse h-8 w-auto dark:hidden"
            />
            <img
              src="/brand/logo-lockup-terang.png"
              alt="Aiones Boards"
              width={186}
              height={48}
              className="auth-logo-pulse h-8 w-auto hidden dark:block"
            />
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-surface-2 text-ink-2 border border-line">
              PORTAL BUMD
            </span>
          </div>

          <div className="flex items-center gap-3"><span className="hidden md:block font-mono text-[11px] text-ink-3">v2026.1</span><ThemeToggle /></div>
        </div>
      </header>

      {/* Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="auth-rise w-full max-w-4xl card overflow-hidden grid grid-cols-1 md:grid-cols-12 shadow-2xl">
          {/* Left: konteks singkat — panel gelap senada sidebar */}
          <div className="md:col-span-5 relative bg-shell p-6 sm:p-8 border-b md:border-b-0 md:border-r border-shell-line flex flex-col justify-center space-y-5">
            <div className="hidden sm:block h-56 -mt-2">
              <React.Suspense fallback={null}>
                <Hero3D className="w-full h-full" />
              </React.Suspense>
            </div>
            <div className="auth-rise-l" style={{ animationDelay: '0.15s' }}>
              <h1 className="text-lg font-bold text-shell-ink tracking-tight leading-snug">
                {mode === 'register' ? 'Buat Akun Aiones Boards' : 'Masuk ke Portal Aiones Boards'}
              </h1>
              <p className="text-xs text-shell-ink-2 mt-2 leading-relaxed">
                Dashboard kinerja instansi dari dokumen resmi Anda.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs text-shell-ink-2 border-t border-shell-line pt-4">
              <li className="auth-rise-l flex items-start gap-2.5" style={{ animationDelay: '0.3s' }}>
                <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>Angka diambil langsung dari dokumen instansi</span>
              </li>
              <li className="auth-rise-l flex items-start gap-2.5" style={{ animationDelay: '0.42s' }}>
                <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>Sesuai standar pelaporan Kemendagri &amp; BPKP</span>
              </li>
              <li className="auth-rise-l flex items-start gap-2.5" style={{ animationDelay: '0.54s' }}>
                <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>Masuk cepat dengan akun Google instansi Anda</span>
              </li>
            </ul>
          </div>

          {/* Right: form */}
          <div className="relative md:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-5 bg-surface/85 backdrop-blur-sm">

            {/* Pendaftaran diterima tetapi belum aktif: tidak ada sesi, form diganti
                panel status supaya pendaftar tahu harus menunggu persetujuan admin. */}
            {pendingInfo && (
              <div className="absolute inset-0 z-20 bg-surface p-6 sm:p-8 flex flex-col justify-center gap-4 overflow-y-auto">
                <div className="w-11 h-11 rounded-control bg-warn/15 border border-warn/30 flex items-center justify-center text-warn">
                  {pendingInfo.perluPilih ? <Building2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-ink">
                    {pendingInfo.perluPilih ? 'Pilih instansi BUMD' : 'Menunggu persetujuan admin'}
                  </h2>
                  <p className="text-xs text-ink-2 leading-relaxed">{pendingInfo.message}</p>
                </div>
                <div className="p-3 bg-surface-2 border border-line rounded-card text-xs space-y-1">
                  {pendingInfo.email && (
                    <div className="flex items-center gap-1.5 text-ink-2">
                      <Mail className="w-3.5 h-3.5 text-ink-3" />
                      <span className="font-mono">{pendingInfo.email}</span>
                    </div>
                  )}
                  {!pendingInfo.perluPilih && (
                    <div className="flex items-center gap-1.5 text-ink-2">
                      <Building2 className="w-3.5 h-3.5 text-ink-3" />
                      <span>{pendingInfo.tenantName || 'Instansi yang Anda pilih'}</span>
                    </div>
                  )}
                  {!pendingInfo.perluPilih && (
                    <p className="text-[11px] text-ink-3 pt-1 leading-relaxed">
                      Anda belum bisa masuk sampai admin instansi menyetujui pendaftaran ini. Setelah
                      disetujui, gunakan halaman masuk seperti biasa.
                    </p>
                  )}
                </div>
                {pendingInfo.credential && (
                  <div className="p-3 bg-surface-2 border border-line rounded-card space-y-2">
                    <label
                      htmlFor="pending-tenant"
                      className="text-[11px] font-semibold text-ink-2 flex items-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5 text-ink-3" />
                      Instansi BUMD
                    </label>
                    <select
                      id="pending-tenant"
                      value={pendingTenant}
                      onChange={(e) => setPendingTenant(e.target.value)}
                      className="w-full text-xs bg-surface border border-line rounded-control px-2.5 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                      <option value="">— Pilih instansi —</option>
                      {daftarTenant.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={
                        !pendingTenant ||
                        (!pendingInfo.perluPilih && pendingTenant === (pendingInfo.tenantId || '')) ||
                        isLoading
                      }
                      onClick={() => void masukDenganGoogle(pendingInfo.credential!, pendingTenant)}
                      className="w-full py-2 bg-surface border border-line rounded-control font-semibold text-xs text-ink hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? 'Memproses…' : pendingInfo.perluPilih ? 'Daftar ke instansi ini' : 'Simpan instansi'}
                    </button>
                    <p className="text-[10px] text-ink-3 leading-relaxed">
                      {pendingInfo.perluPilih
                        ? 'Pilih instansi BUMD tempat Anda bertugas, lalu klik Daftar. Admin instansi tersebut akan menyetujui akun Anda.'
                        : 'Salah pilih instansi? Ganti di sini lalu klik Simpan instansi — pendaftaran langsung dipindahkan ke instansi yang Anda pilih.'}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPendingInfo(null);
                    setMode('login');
                    setPassword('');
                  }}
                  className="w-full py-2.5 bg-brand text-on-brand rounded-card font-semibold text-xs hover:brightness-95 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Kembali ke halaman masuk
                </button>
              </div>
            )}

            {/* Tab Masuk / Daftar */}
            <div className="auth-rise-r flex p-1 rounded-control bg-surface-2 border border-line" style={{ animationDelay: '0.2s' }}>
              <button
                type="button"
                onClick={() => gantiMode('login')}
                data-testid="tab-masuk"
                className={`flex-1 text-xs font-semibold py-1.5 rounded-[10px] transition-colors ${
                  mode === 'login' ? 'bg-surface text-ink shadow-2xs' : 'text-ink-2 hover:text-ink'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => gantiMode('register')}
                data-testid="tab-daftar"
                className={`flex-1 text-xs font-semibold py-1.5 rounded-[10px] transition-colors ${
                  mode === 'register' ? 'bg-surface text-ink shadow-2xs' : 'text-ink-2 hover:text-ink'
                }`}
              >
                Daftar
              </button>
            </div>

            <div className="auth-rise-r" style={{ animationDelay: '0.24s' }}>
              <h2 className="text-base font-bold text-ink">
                {mode === 'register' ? 'Daftar akun baru' : 'Masuk'}
              </h2>
              <p className="text-xs text-ink-3 mt-0.5">
                {mode === 'register'
                  ? 'Isi data di bawah, atau daftar langsung dengan Google'
                  : 'Gunakan akun instansi Anda atau akun Google'}
              </p>
            </div>

            {errorMessage && (
              <div role="alert" aria-live="assertive" className="p-3 bg-neg/15 border border-neg/30 rounded-control text-neg text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-neg shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="auth-rise-r" style={{ animationDelay: '0.32s' }}>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="nama@instansi.bumd.id"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="auth-rise-r" style={{ animationDelay: '0.42s' }}>
                  <div className="mb-1">
                    <label className="text-xs font-semibold text-ink-2">Kata Sandi</label>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full text-xs pl-9 pr-9 py-2 bg-surface border border-line-strong rounded-control text-ink placeholder-ink-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-control text-ink-3 hover:text-ink-2 hover:bg-surface-2 cursor-pointer flex items-center justify-center"
                      title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="auth-rise-r flex items-center gap-2 cursor-pointer select-none pt-1" style={{ animationDelay: '0.52s' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-line-strong accent-brand focus:ring-brand"
                  />
                  <span className="text-ink-2 text-xs">Ingat perangkat ini</span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="auth-btn-shine auth-rise-r btn-primary w-full py-2.5 px-4 disabled:opacity-50 text-xs font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer mt-2"
                  style={{ animationDelay: '0.6s' }}
                >
                  {isLoading ? (
                    <span>Memverifikasi...</span>
                  ) : (
                    <>
                      <span>Masuk</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="auth-rise-r" style={{ animationDelay: '0.32s' }}>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">Nama Lengkap</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      placeholder="Nama Anda"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="auth-rise-r" style={{ animationDelay: '0.38s' }}>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      placeholder="nama@instansi.bumd.id"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="auth-rise-r" style={{ animationDelay: '0.44s' }}>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">Instansi</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                    <select
                      value={regTenant}
                      onChange={(e) => setRegTenant(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 bg-surface border border-line-strong rounded-control text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all font-medium"
                    >
                      {daftarTenant.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="auth-rise-r grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ animationDelay: '0.5s' }}>
                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Kata Sandi</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Min. 8 karakter"
                        className="w-full text-xs pl-9 pr-9 py-2 bg-surface border border-line-strong rounded-control text-ink placeholder-ink-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-control text-ink-3 hover:text-ink-2 hover:bg-surface-2 cursor-pointer flex items-center justify-center"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Ulangi Sandi</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={regPassword2}
                        onChange={(e) => setRegPassword2(e.target.value)}
                        required
                        placeholder="Ulangi kata sandi"
                        className="w-full text-xs pl-9 pr-3 py-2 bg-surface border border-line-strong rounded-control text-ink placeholder-ink-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                <label className="auth-rise-r flex items-center gap-2 cursor-pointer select-none pt-1" style={{ animationDelay: '0.54s' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-line-strong accent-brand focus:ring-brand"
                  />
                  <span className="text-ink-2 text-xs">Ingat perangkat ini</span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  data-testid="btn-daftar"
                  className="auth-btn-shine auth-rise-r btn-primary w-full py-2.5 px-4 disabled:opacity-50 text-xs font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer mt-1"
                  style={{ animationDelay: '0.6s' }}
                >
                  {isLoading ? (
                    <span>Membuat akun...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Daftar</span>
                    </>
                  )}
                </button>

                <p className="text-[10.5px] text-ink-3 leading-relaxed text-center">
                  Dengan mendaftar, akun Anda dibuat dengan peran <strong>Pengguna</strong>. Admin instansi
                  dapat menyesuaikan peran setelahnya.
                </p>
              </form>
            )}

            {/* Google Sign-In — sengaja DI BAWAH form: email+sandi jalur utama,
                Google alternatif. Divider dipindah ke atas tombol karena posisinya
                kini mengikuti form, bukan mendahuluinya. */}
            {googleClientId ? (
              <div className="auth-rise-r space-y-2" style={{ animationDelay: '0.66s' }}>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-[10.5px] text-ink-3 font-medium">
                    {mode === 'register' ? 'atau daftar dengan Google' : 'atau masuk dengan Google'}
                  </span>
                  <div className="flex-1 h-px bg-line" />
                </div>
                {/* Instansi TIDAK dipilih di sini. Pendaftar memilihnya pada panel
                    setelah klik Google, supaya tidak ada instansi yang terpilih
                    otomatis dan alurnya sama untuk masuk maupun daftar. */}
                <div ref={googleBtnRef} className="flex justify-center min-h-[40px]" />
                {googleError && (
                  <p className="text-[11px] text-neg text-center leading-relaxed">{googleError}</p>
                )}
              </div>
            ) : (
              <div className="auth-rise-r p-2.5 bg-surface-2 border border-line rounded-control text-[10.5px] text-ink-3 leading-relaxed" style={{ animationDelay: '0.66s' }}>
                Login Google belum aktif. Untuk mengaktifkannya, isi <span className="font-mono">GOOGLE_CLIENT_ID</span> di
                berkas <span className="font-mono">.env</span> lalu mulai ulang server.
              </div>
            )}

            <p className="auth-rise-r text-[11px] text-ink-3 border-t border-line pt-4" style={{ animationDelay: '0.68s' }}>
              {mode === 'login' ? (
                <>
                  Belum punya akun?{' '}
                  <button type="button" onClick={() => gantiMode('register')} className="text-brand-ink font-semibold hover:underline">
                    Daftar sekarang
                  </button>
                </>
              ) : (
                <>
                  Sudah punya akun?{' '}
                  <button type="button" onClick={() => gantiMode('login')} className="text-brand-ink font-semibold hover:underline">
                    Masuk di sini
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-surface/70 backdrop-blur-md border-t border-line px-6 py-4 text-xs text-ink-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Aiones Boards. Portal Dashboard BUMD</span>
          <span className="flex items-center gap-4">
            <a href="/paket" className="hover:text-ink hover:underline">Paket &amp; harga</a>
            <a href="/syarat-ketentuan" className="hover:text-ink hover:underline">Syarat &amp; ketentuan</a>
          </span>
        </div>
      </footer>
    </div>
  );
};
