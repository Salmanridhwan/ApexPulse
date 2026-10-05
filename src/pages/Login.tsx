import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
} from 'lucide-react';
import { Tenant, User } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';
const Hero3D = React.lazy(() => import('../components/Hero3D').then((m) => ({ default: m.Hero3D })));

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
  tenants: Tenant[];
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, tenants }) => {
  const [email, setEmail] = useState('demo@aionesboard.id');
  const [password, setPassword] = useState('aionesboard2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const loginEmail = email;
    const loginPass = password;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPass,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email atau kata sandi tidak sesuai.');
      }

      // Sesi ditandai via cookie HttpOnly yang diset server — localStorage hanya
      // menyimpan profil user untuk mempercepat boot UI (bukan kredensial).
      const store = rememberMe ? localStorage : sessionStorage;
      store.setItem('aionesboard_user', JSON.stringify(data.user));

      onLoginSuccess(data.user, 'cookie-session');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between font-sans antialiased text-ink">
      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md border-b border-line px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-control bg-brand text-white flex items-center justify-center font-bold text-sm tracking-wider">
              AP
            </div>
            <span className="font-bold text-ink text-sm tracking-tight flex items-center gap-2">
              ApexPulse
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-surface-2 text-ink-2 border border-line">
                PORTAL BUMD
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3"><span className="hidden md:block font-mono text-[11px] text-ink-3">v2026.1</span><ThemeToggle /></div>
        </div>
      </header>

      {/* Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl card overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left: konteks singkat — panel gelap senada sidebar */}
          <div className="md:col-span-5 relative bg-shell p-6 sm:p-8 border-b md:border-b-0 md:border-r border-shell-line flex flex-col justify-center space-y-5">`r`n            <div className="hidden sm:block h-40 -mt-2 -mb-1">`r`n              <React.Suspense fallback={null}>`r`n                <Hero3D className="w-full h-full" />`r`n              </React.Suspense>`r`n            </div>
            <div>
              <h1 className="text-lg font-bold text-shell-ink tracking-tight leading-snug">
                Masuk ke Portal ApexPulse
              </h1>
              <p className="text-xs text-shell-ink-2 mt-2 leading-relaxed">
                Dashboard kinerja instansi berbasis dokumen resmi RAG.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs text-shell-ink-2 border-t border-shell-line pt-4">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>Data tervalidasi dengan sitasi dokumen sumber</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>Sesuai standar pelaporan Kemendagri &amp; BPKP</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>Semua aktivitas tercatat di jejak audit</span>
              </li>
            </ul>
          </div>

          {/* Right: form */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-base font-bold text-ink">Masuk</h2>
              <p className="text-xs text-ink-3 mt-0.5">Gunakan akun instansi Anda</p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-neg/15 border border-neg/30 rounded-control text-neg text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-neg shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-3 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="nama@instansi.bumd.id"
                    className="w-full text-xs pl-9 pr-3 py-2 bg-surface border border-line-strong rounded-control text-ink placeholder-ink-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-ink-2">Kata Sandi</label>
                  <span className="text-[11px] font-mono text-ink-3">
                    Default: aionesboard2026
                  </span>
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
                    className="absolute right-2.5 top-2 text-ink-3 hover:text-ink-2"
                    title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
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
                className="btn-primary w-full py-2.5 px-4 disabled:opacity-50 text-xs font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer mt-2"
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

            <p className="text-[11px] text-ink-3 border-t border-line pt-4">
              Butuh bantuan? Hubungi admin instansi Anda.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-line px-6 py-4 text-xs text-ink-3">
        <div className="max-w-6xl mx-auto">
          © 2026 ApexPulse — Portal Dashboard BUMD
        </div>
      </footer>
    </div>
  );
};
