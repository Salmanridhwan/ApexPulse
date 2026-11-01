import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  MailCheck,
  Eye,
  EyeOff,
  KeyRound,
  User as UserIcon,
  Mail,
  Building2,
  UserPlus,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Tenant, User } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';

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
  /** 'login' = masuk, 'register' = daftar akun baru, 'lupa' = minta reset kata sandi ke admin. */
  const [mode, setMode] = useState<'login' | 'register' | 'lupa'>('login');
  /** Pesan konfirmasi setelah permintaan lupa sandi dikirim. */
  const [lupaTerkirim, setLupaTerkirim] = useState<string | null>(null);

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
  }, [googleClientId, mode, regTenant, Boolean(pendingInfo)]);

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

  const gantiMode = (m: 'login' | 'register' | 'lupa') => {
    setMode(m);
    setErrorMessage(null);
    setGoogleError(null);
    setLupaTerkirim(null);
  };

  /** Kirim permintaan lupa sandi. Server menjawab sama untuk email terdaftar maupun tidak. */
  const kirimLupa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/lupa-sandi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Permintaan gagal dikirim.');
      setLupaTerkirim(data?.pesan || 'Permintaan sudah diteruskan ke admin instansi.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full h-12 text-sm pl-11 pr-4 bg-surface border border-line-strong rounded-xl text-ink placeholder-ink-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-ink-3 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all';
  const labelCls = 'block text-[13px] font-medium text-ink-2 mb-1.5';
  const ikonCls = 'w-[18px] h-[18px] text-ink-3 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none';
  const tombolUtama =
    'w-full h-12 bg-brand text-on-brand rounded-xl font-semibold text-sm hover:brightness-105 active:brightness-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px] shadow-brand/60 transition-all';

  /** Kolom kata sandi dengan tombol lihat/sembunyikan. */
  const kolomSandi = (
    value: string,
    onChange: (v: string) => void,
    opsi: { placeholder: string; minLength?: number; autoComplete: string; tombol?: boolean }
  ) => (
    <div className="relative">
      <KeyRound className={ikonCls} />
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={opsi.minLength}
        autoComplete={opsi.autoComplete}
        placeholder={opsi.placeholder}
        className={`${inputCls} ${opsi.tombol ? 'pr-12' : ''}`}
      />
      {opsi.tombol && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
          title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-surface"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas p-3 lg:p-4 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4 font-sans antialiased text-ink">
      {/* ===== Kolom formulir ===== */}
      <main className="flex flex-col min-h-[calc(100vh-1.5rem)] lg:min-h-0 px-3 sm:px-8 lg:px-12 xl:px-16">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <img src="/brand/logo-lockup.png" alt="Aiones Boards" width={186} height={48} className="h-7 w-auto dark:hidden" />
            <img src="/brand/logo-lockup-terang.png" alt="Aiones Boards" width={186} height={48} className="h-7 w-auto hidden dark:block" />
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center py-8">
          <div className="auth-rise w-full max-w-[420px]">
            {/* Pendaftaran diterima tetapi belum aktif: tidak ada sesi, form diganti
                panel status supaya pendaftar tahu harus menunggu persetujuan admin. */}
            {pendingInfo ? (
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-warn/15 flex items-center justify-center text-warn">
                  {pendingInfo.perluPilih ? <Building2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-[28px] font-bold tracking-tight text-ink leading-tight">
                    {pendingInfo.perluPilih ? 'Pilih instansi BUMD' : 'Menunggu persetujuan admin'}
                  </h2>
                  <p className="text-sm text-ink-2 leading-relaxed">{pendingInfo.message}</p>
                </div>
                <div className="p-4 bg-surface-2 rounded-2xl text-sm space-y-1.5">
                  {pendingInfo.email && (
                    <div className="flex items-center gap-2 text-ink-2">
                      <Mail className="w-4 h-4 text-ink-3" />
                      <span className="font-mono text-[13px]">{pendingInfo.email}</span>
                    </div>
                  )}
                  {!pendingInfo.perluPilih && (
                    <div className="flex items-center gap-2 text-ink-2">
                      <Building2 className="w-4 h-4 text-ink-3" />
                      <span>{pendingInfo.tenantName || 'Instansi yang Anda pilih'}</span>
                    </div>
                  )}
                  {!pendingInfo.perluPilih && (
                    <p className="text-xs text-ink-3 pt-1 leading-relaxed">
                      Anda belum bisa masuk sampai admin instansi menyetujui pendaftaran ini. Setelah disetujui,
                      gunakan halaman masuk seperti biasa.
                    </p>
                  )}
                </div>
                {pendingInfo.credential && (
                  <div className="p-4 bg-surface-2 rounded-2xl space-y-2.5">
                    <label htmlFor="pending-tenant" className={labelCls}>
                      Instansi BUMD
                    </label>
                    <div className="relative">
                      <Building2 className={ikonCls} />
                      <select
                        id="pending-tenant"
                        value={pendingTenant}
                        onChange={(e) => setPendingTenant(e.target.value)}
                        className={`${inputCls} bg-surface`}
                      >
                        <option value="">— Pilih instansi —</option>
                        {daftarTenant.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={
                        !pendingTenant ||
                        (!pendingInfo.perluPilih && pendingTenant === (pendingInfo.tenantId || '')) ||
                        isLoading
                      }
                      onClick={() => void masukDenganGoogle(pendingInfo.credential!, pendingTenant)}
                      className="w-full h-11 bg-surface border border-line rounded-xl font-semibold text-sm text-ink hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? 'Memproses…' : pendingInfo.perluPilih ? 'Daftar ke instansi ini' : 'Simpan instansi'}
                    </button>
                    <p className="text-xs text-ink-3 leading-relaxed">
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
                  className={tombolUtama}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Kembali ke halaman masuk
                </button>
              </div>
            ) : mode === 'lupa' ? (
              <div className="auth-rise">
                <button
                  type="button"
                  onClick={() => gantiMode('login')}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali ke halaman masuk
                </button>
                <div className="mt-6 w-12 h-12 rounded-2xl bg-brand/10 text-brand-ink flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="mt-4 text-[30px] font-bold tracking-tight text-ink leading-[1.1]">Lupa kata sandi?</h2>
                <p className="mt-2.5 text-[15px] text-ink-2 leading-relaxed">
                  Masukkan email akun Anda. Permintaan diteruskan ke admin instansi, yang akan memberikan kata sandi
                  sementara untuk Anda.
                </p>

                {lupaTerkirim ? (
                  <div className="mt-6 space-y-5">
                    <div role="status" className="p-4 rounded-xl bg-pos/10 text-sm text-ink flex items-start gap-3">
                      <MailCheck className="w-5 h-5 text-pos shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{lupaTerkirim}</span>
                    </div>
                    <p className="text-[13px] text-ink-3 leading-relaxed">
                      Setelah menerima kata sandi sementara, masuk seperti biasa. Anda akan diminta membuat kata sandi
                      baru.
                    </p>
                    <button type="button" onClick={() => gantiMode('login')} className={tombolUtama}>
                      Kembali ke halaman masuk
                    </button>
                  </div>
                ) : (
                  <form onSubmit={kirimLupa} className="mt-6 space-y-4">
                    {errorMessage && (
                      <div role="alert" className="p-3.5 bg-neg/10 rounded-xl text-neg text-sm flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{errorMessage}</span>
                      </div>
                    )}
                    <div>
                      <label htmlFor="lupa-email" className={labelCls}>
                        Email
                      </label>
                      <div className="relative">
                        <Mail className={ikonCls} />
                        <input
                          id="lupa-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoFocus
                          autoComplete="username"
                          placeholder="nama@instansi.go.id"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={isLoading} data-testid="kirim-lupa-sandi" className={tombolUtama}>
                      {isLoading ? 'Mengirim…' : 'Kirim permintaan'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold text-brand-ink bg-brand/10 rounded-full pl-2 pr-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                  Portal Dashboard BUMD
                </span>
                <h2 className="mt-4 text-[30px] sm:text-[34px] font-bold tracking-tight text-ink leading-[1.1]">
                  {mode === 'register' ? 'Mulai dengan akun baru' : 'Selamat datang kembali'}
                </h2>
                <p className="mt-2.5 text-[15px] text-ink-2 leading-relaxed">
                  {mode === 'register'
                    ? 'Daftar sekali, lalu admin instansi Anda akan mengaktifkan akunnya.'
                    : 'Masuk untuk melihat kinerja instansi Anda hari ini.'}
                </p>

                {/* Pilihan Masuk / Daftar: pil bergeser. */}
                <div className="relative mt-7 grid grid-cols-2 p-1 rounded-xl bg-surface-2">
                  <span
                    aria-hidden
                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-surface shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
                  />
                  <button
                    type="button"
                    data-testid="tab-masuk"
                    onClick={() => gantiMode('login')}
                    className={`relative h-9 text-[13px] font-semibold rounded-lg transition-colors ${
                      mode === 'login' ? 'text-ink' : 'text-ink-3 hover:text-ink-2'
                    }`}
                  >
                    Masuk
                  </button>
                  <button
                    type="button"
                    data-testid="tab-daftar"
                    onClick={() => gantiMode('register')}
                    className={`relative h-9 text-[13px] font-semibold rounded-lg transition-colors ${
                      mode === 'register' ? 'text-ink' : 'text-ink-3 hover:text-ink-2'
                    }`}
                  >
                    Daftar
                  </button>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mt-5 p-3.5 bg-neg/10 rounded-xl text-neg text-sm flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{errorMessage}</span>
                  </div>
                )}

                {mode === 'login' ? (
                  <form key="masuk" onSubmit={handleLogin} className="auth-rise mt-6 space-y-4">
                    <div>
                      <label htmlFor="masuk-email" className={labelCls}>
                        Email
                      </label>
                      <div className="relative">
                        <Mail className={ikonCls} />
                        <input
                          id="masuk-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="username"
                          placeholder="nama@instansi.go.id"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Kata sandi</label>
                      {kolomSandi(password, setPassword, {
                        placeholder: 'Kata sandi Anda',
                        autoComplete: 'current-password',
                        tombol: true,
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded accent-brand"
                        />
                        <span className="text-ink-2 text-[13px]">Ingat saya</span>
                      </label>
                      <button
                        type="button"
                        data-testid="tombol-lupa-sandi"
                        onClick={() => gantiMode('lupa')}
                        className="text-[13px] font-semibold text-brand-ink hover:underline"
                      >
                        Lupa kata sandi?
                      </button>
                    </div>

                    <button type="submit" disabled={isLoading} className={`${tombolUtama} group`}>
                      {isLoading ? (
                        <span>Memverifikasi…</span>
                      ) : (
                        <>
                          <span>Masuk</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form key="daftar" onSubmit={handleRegister} className="auth-rise mt-6 space-y-4">
                    <div>
                      <label htmlFor="daftar-nama" className={labelCls}>
                        Nama lengkap
                      </label>
                      <div className="relative">
                        <UserIcon className={ikonCls} />
                        <input
                          id="daftar-nama"
                          type="text"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          required
                          autoComplete="name"
                          placeholder="Nama Anda"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="daftar-email" className={labelCls}>
                        Email instansi
                      </label>
                      <div className="relative">
                        <Mail className={ikonCls} />
                        <input
                          id="daftar-email"
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required
                          autoComplete="email"
                          placeholder="nama@instansi.go.id"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="daftar-instansi" className={labelCls}>
                        Instansi
                      </label>
                      <div className="relative">
                        <Building2 className={ikonCls} />
                        <select
                          id="daftar-instansi"
                          value={regTenant}
                          onChange={(e) => setRegTenant(e.target.value)}
                          className={inputCls}
                        >
                          {daftarTenant.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Kata sandi</label>
                        {kolomSandi(regPassword, setRegPassword, {
                          placeholder: 'Min. 8 karakter',
                          minLength: 8,
                          autoComplete: 'new-password',
                          tombol: true,
                        })}
                      </div>
                      <div>
                        <label className={labelCls}>Ulangi sandi</label>
                        {kolomSandi(regPassword2, setRegPassword2, {
                          placeholder: 'Sekali lagi',
                          autoComplete: 'new-password',
                        })}
                      </div>
                    </div>

                    <button type="submit" disabled={isLoading} data-testid="btn-daftar" className={tombolUtama}>
                      {isLoading ? (
                        <span>Membuat akun…</span>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Buat akun</span>
                        </>
                      )}
                    </button>

                    <p className="text-xs text-ink-3 leading-relaxed text-center">
                      Akun baru berperan <strong className="font-semibold text-ink-2">Pengguna</strong> dan aktif setelah
                      disetujui admin instansi.
                    </p>
                  </form>
                )}

                {/* Google hanya tampil bila sudah dikonfigurasi. Petunjuk teknis
                    (.env) tidak ditampilkan ke pengguna akhir. */}
                {googleClientId && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-line" />
                      <span className="text-xs text-ink-3">atau lanjut dengan</span>
                      <div className="flex-1 h-px bg-line" />
                    </div>
                    {/* Instansi TIDAK dipilih di sini. Pendaftar memilihnya pada panel
                        setelah klik Google, supaya tidak ada instansi yang terpilih
                        otomatis dan alurnya sama untuk masuk maupun daftar. */}
                    <div ref={googleBtnRef} className="flex justify-center min-h-[40px]" />
                    {googleError && <p className="text-xs text-neg text-center leading-relaxed">{googleError}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="py-4 text-xs text-ink-3 flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 Aiones Boards</span>
          <span className="flex items-center gap-5">
            <a href="/paket" className="hover:text-ink">
              Paket &amp; harga
            </a>
            <a href="/syarat-ketentuan" className="hover:text-ink">
              Syarat &amp; ketentuan
            </a>
          </span>
        </footer>
      </main>

      {/* ===== Panel cuplikan produk: gradasi brand + jendela aplikasi lurus
          yang menyembul dari sudut kanan bawah. Sengaja minim teks: label
          diganti garis abu supaya terbaca sebagai gambar, bukan bacaan. ===== */}
      <aside
        className="relative hidden lg:flex flex-col overflow-hidden rounded-[28px] pt-12 xl:pt-14 pl-12 xl:pl-14 text-white bg-[linear-gradient(150deg,#22b3d6_0%,#1677b8_48%,#123d6b_100%)] dark:bg-[linear-gradient(150deg,#0f4a63_0%,#0f2f52_55%,#0b1a30_100%)]"
        aria-label="Cuplikan aplikasi"
      >
        {/* Tekstur: titik halus + dua pendar cahaya. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(180deg, #000 0%, transparent 70%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 70%)',
          }}
        />
        <div aria-hidden className="absolute -top-32 -right-24 w-[460px] h-[460px] rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="absolute bottom-0 left-1/4 w-[420px] h-[300px] rounded-full bg-[#38c6e2]/25 blur-3xl" />

        <div className="relative auth-rise-r max-w-[480px] pr-12">
          <h1 className="text-[32px] xl:text-[38px] font-bold leading-[1.12] tracking-tight">
            Rapat kinerja lebih singkat, angkanya langsung dari dokumen.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">
            Unggah laporan keuangan atau RKAP, Aiones menyusunnya menjadi dashboard yang siap dipresentasikan.
          </p>
        </div>

        {/* Jendela aplikasi: menempel ke kanan bawah, tingginya mengikuti isi. */}
        <div className="relative mt-auto pt-12">
          <div
            className="auth-rise ml-10 rounded-tl-2xl overflow-hidden bg-white dark:bg-[#12161c] text-[#1a1d1f] dark:text-[#eef1f5] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:ring-white/10"
            style={{ animationDelay: '0.15s' }}
            aria-hidden
          >
            <div className="h-9 flex items-center gap-1.5 px-4 border-b border-black/5 dark:border-white/10 bg-[#f6f8fa] dark:bg-[#0e1116]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex">
              {/* Sidebar mini */}
              <div className="w-12 shrink-0 border-r border-black/5 dark:border-white/10 py-4 flex flex-col items-center gap-3 bg-[#fafbfc] dark:bg-[#0f1318]">
                <span className="w-6 h-6 rounded-lg bg-[#1fa6cc]" />
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`w-6 h-6 rounded-lg ${i === 0 ? 'bg-[#1fa6cc]/20' : 'bg-black/[0.05] dark:bg-white/[0.07]'}`} />
                ))}
              </div>

              <div className="flex-1 min-w-0 p-5 space-y-4">
                {/* Judul halaman: garis, bukan teks. */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <span className="block w-32 h-2.5 rounded-full bg-black/[0.12] dark:bg-white/[0.16]" />
                    <span className="block w-20 h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
                  </div>
                  <span className="w-16 h-6 rounded-lg bg-[#1fa6cc]" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { v: 'Rp 748 M', d: '+7,3%', s: [4, 5, 4.6, 6, 6.4, 7.4] },
                    { v: '82,4%', d: '+1,2', s: [78, 79, 79.5, 80.6, 81.2, 82.4] },
                    { v: '31,2%', d: '−1,8', s: [35, 34.2, 33.6, 32.9, 32, 31.2] },
                  ].map((k) => {
                    const min = Math.min(...k.s);
                    const rentang = Math.max(...k.s) - min || 1;
                    const titik = k.s.map((v, i) => `${(i / (k.s.length - 1)) * 80},${22 - ((v - min) / rentang) * 18}`).join(' ');
                    return (
                      <div key={k.v} className="rounded-xl border border-black/5 dark:border-white/10 p-3 min-w-0">
                        <span className="block w-14 h-2 rounded-full bg-black/[0.08] dark:bg-white/[0.1]" />
                        <p className="mt-2 text-[17px] font-bold tabular-nums tracking-tight truncate">{k.v}</p>
                        <div className="mt-1 flex items-end justify-between gap-2">
                          <span className="text-[10px] font-semibold text-[#16a34a] dark:text-[#4ade80] bg-[#16a34a]/10 rounded-full px-1.5 py-0.5">
                            {k.d}
                          </span>
                          <svg viewBox="0 0 80 24" className="w-16 h-5">
                            <polyline points={titik} fill="none" stroke="#1fa6cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-[1.7fr_1fr] gap-3">
                  <div className="rounded-xl border border-black/5 dark:border-white/10 p-3.5">
                    <span className="block w-24 h-2 rounded-full bg-black/[0.08] dark:bg-white/[0.1]" />
                    <svg viewBox="0 0 240 90" className="mt-3 w-full h-[110px]" preserveAspectRatio="none">
                      {[50, 58, 54, 66, 62, 72, 68, 78, 76, 84, 82, 92].map((t, i) => (
                        <rect
                          key={i}
                          x={i * 20 + 4}
                          y={90 - t}
                          width="12"
                          height={t}
                          rx="3"
                          fill="#1fa6cc"
                          fillOpacity={i === 11 ? 1 : 0.3 + i * 0.045}
                        />
                      ))}
                      <path d="M0,30 L240,20" stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="4 3" fill="none" />
                    </svg>
                  </div>
                  <div className="rounded-xl border border-black/5 dark:border-white/10 p-3.5 flex flex-col">
                    <span className="block w-16 h-2 rounded-full bg-black/[0.08] dark:bg-white/[0.1]" />
                    <div className="flex-1 flex items-center justify-center pt-2">
                      <svg viewBox="0 0 42 42" className="w-[104px] h-[104px] -rotate-90">
                        <circle cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="5" />
                        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#1fa6cc" strokeWidth="5" strokeDasharray="52 48" />
                        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#8b7cf6" strokeWidth="5" strokeDasharray="26 74" strokeDashoffset="-52" />
                        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray="22 78" strokeDashoffset="-78" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
