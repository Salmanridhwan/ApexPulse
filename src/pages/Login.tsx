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
  const [regTenant, setRegTenant] = useState<string>(() => tenants[0]?.id || 'tenant-pdam');

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Sign-In
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  /** Simpan profil user untuk boot UI cepat (sesi asli tetap cookie HttpOnly). */
  const simpanSesi = (user: User, remember: boolean) => {
    const store = remember ? localStorage : sessionStorage;
    store.setItem('aionesboard_user', JSON.stringify(user));
    onLoginSuccess(user, 'cookie-session');
  };

  // Ambil konfigurasi auth (Client ID Google) sekali saat halaman dibuka.
  useEffect(() => {
    let batal = false;
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!batal && cfg?.googleClientId) setGoogleClientId(cfg.googleClientId);
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
  const masukDenganGoogle = async (credential: string) => {
    setErrorMessage(null);
    setGoogleError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, tenantId: regTenant }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Login Google gagal.');
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
    muatSkripGoogle()
      .then(() => {
        if (batal || !window.google?.accounts?.id || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (resp) => {
            if (resp?.credential) void masukDenganGoogle(resp.credential);
          },
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
        });
      })
      .catch(() => setGoogleError('Tidak bisa memuat tombol Google. Periksa koneksi Anda.'));
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, mode]);

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
      if (!response.ok) throw new Error(data.error || 'Email atau kata sandi tidak sesuai.');
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
    if (regPassword.length < 8) {
      setErrorMessage('Kata sandi minimal 8 karakter.');
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
      {/* Latar bergerak: dokumen RAG mengalir menjadi dashboard. */}
      <AuthBackdrop />

      {/* Header */}
      <header className="relative z-10 bg-surface/70 backdrop-blur-md border-b border-line px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="auth-logo-pulse w-8 h-8 rounded-control bg-brand text-on-brand flex items-center justify-center font-bold text-sm tracking-wider">
              AB
            </div>
            <span className="font-bold text-ink text-sm tracking-tight flex items-center gap-2">
              Aiones Boards
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-surface-2 text-ink-2 border border-line">
                PORTAL BUMD
              </span>
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
            <div className="hidden sm:block h-40 -mt-2 -mb-1">
              <React.Suspense fallback={null}>
                <Hero3D className="w-full h-full" />
              </React.Suspense>
            </div>
            <div className="auth-rise-l" style={{ animationDelay: '0.15s' }}>
              <h1 className="text-lg font-bold text-shell-ink tracking-tight leading-snug">
                {mode === 'register' ? 'Buat Akun Aiones Boards' : 'Masuk ke Portal Aiones Boards'}
              </h1>
              <p className="text-xs text-shell-ink-2 mt-2 leading-relaxed">
                Dashboard kinerja instansi berbasis dokumen resmi RAG.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs text-shell-ink-2 border-t border-shell-line pt-4">
              <li className="auth-rise-l flex items-start gap-2.5" style={{ animationDelay: '0.3s' }}>
                <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>Data tervalidasi dengan sitasi dokumen sumber</span>
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
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-5 bg-surface/85 backdrop-blur-sm">
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

            {/* Google Sign-In (tampil bila Client ID tersedia) */}
            {googleClientId ? (
              <div className="auth-rise-r space-y-2" style={{ animationDelay: '0.28s' }}>
                <div ref={googleBtnRef} className="flex justify-center min-h-[40px]" />
                {googleError && (
                  <p className="text-[11px] text-neg text-center leading-relaxed">{googleError}</p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-line" />
                  <span className="text-[10.5px] text-ink-3 font-medium">atau dengan email</span>
                  <div className="flex-1 h-px bg-line" />
                </div>
              </div>
            ) : (
              <div className="auth-rise-r p-2.5 bg-surface-2 border border-line rounded-control text-[10.5px] text-ink-3 leading-relaxed" style={{ animationDelay: '0.28s' }}>
                Login Google belum aktif. Untuk mengaktifkannya, isi <span className="font-mono">GOOGLE_CLIENT_ID</span> di
                berkas <span className="font-mono">.env</span> lalu mulai ulang server.
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
                      {tenants.map((t) => (
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
                  Dengan mendaftar, akun Anda dibuat dengan peran <strong>Analis</strong>. Admin instansi
                  dapat menyesuaikan peran setelahnya.
                </p>
              </form>
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
        <div className="max-w-6xl mx-auto">
          © 2026 Aiones Boards. Portal Dashboard BUMD
        </div>
      </footer>
    </div>
  );
};
