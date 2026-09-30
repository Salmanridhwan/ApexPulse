import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { Tenant, User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
  tenants: Tenant[];
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, tenants }) => {
  const [email, setEmail] = useState('demo@apexpulse.id');
  const [password, setPassword] = useState('apexpulse2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

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
        throw new Error(data.error || 'Email atau kata sandi tidak sesuai dengan pangkalan data instansi.');
      }

      // Sesi ditandai via cookie HttpOnly yang diset server — localStorage hanya
      // menyimpan profil user untuk mempercepat boot UI (bukan kredensial).
      const store = rememberMe ? localStorage : sessionStorage;
      store.setItem('apexpulse_user', JSON.stringify(data.user));

      onLoginSuccess(data.user, 'cookie-session');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke layanan otentikasi BUMD.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans antialiased text-slate-800">
      {/* Top Gov/Enterprise App Header */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-xs">
              AP
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                ApexPulse
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  PORTAL BUMD
                </span>
              </span>
              <p className="text-[11px] text-slate-500">
                Sistem Intelijensi Kinerja & Otomasi Dashboard Daerah Terintegrasi
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Koneksi Aman TLS 1.3 Terenkripsi</span>
            </div>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-[11px] text-slate-400">Ver. 2026.1-STABLE</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left Column: Official Context & Governance Info */}
          <div className="md:col-span-5 bg-slate-50/80 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                <span>Portal Resmi Lintas Instansi Daerah</span>
              </div>

              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                  Masuk ke Sistem Pemantauan Kinerja BUMD
                </h1>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Gunakan kredensial akun instansi yang terdaftar untuk mengakses dashboard analitik, verifikasi sitasi berkas, dan penyusunan laporan evaluasi berkala.
                </p>
              </div>

              <div className="pt-2 space-y-2.5 text-xs text-slate-600 border-t border-slate-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    <strong className="text-slate-900">Validitas Data Terjamin:</strong> Seluruh metrik terhubung dengan sitasi dokumen sumber instansi.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    <strong className="text-slate-900">Kepatuhan Regulasi:</strong> Sesuai pedoman pelaporan berkala Kemendagri, BPKP, dan OJK.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    <strong className="text-slate-900">Audit Elektronik:</strong> Seluruh mutasi data dan sesi akses tersimpan pada rekam jejak sistem.
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Shield className="w-3.5 h-3.5 text-slate-700" />
                <span>Pemberitahuan Keamanan</span>
              </div>
              <p className="leading-normal">
                Hak akses portal ini dilindungi undang-undang. Penggunaan akun tanpa otorisasi resmi instansi terkait akan diproses sesuai ketentuan hukum yang berlaku.
              </p>
            </div>
          </div>

          {/* Right Column: Direct Credential Form */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Otentikasi Pengguna
                  </h2>
                  <p className="text-xs text-slate-500">
                    Silakan masukkan email kedinasan dan kata sandi Anda
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
              </div>

              {errorMessage && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Email Kedinasan / Instansi
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="nama@instansi.bumd.id"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Kata Sandi
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      Default: apexpulse2026
                    </span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full text-xs pl-9 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                      title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-slate-600 text-xs">Ingat perangkat ini</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <span>Memverifikasi Kredensial...</span>
                  ) : (
                    <>
                      <span>Masuk ke Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Official Support & Authorization Guidance */}
            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-2">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Kendala Akses atau Lupa Kredensial?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Pendaftaran akun pejabat dan penyesuaian hak akses unit kerja dikelola oleh Administrator Tata Kelola IT instansi masing-masing. Silakan hubungi bagian pengelola data atau helpdesk teknis.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Official Enterprise Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <span className="font-semibold text-slate-700">ApexPulse BUMD</span> — Sistem Otomasi Visualisasi & Intelijensi Data Instansi Daerah.
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Pusat Bantuan: helpdesk@apexpulse.id</span>
            <span>•</span>
            <span>Panduan Teknis Sistem</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
