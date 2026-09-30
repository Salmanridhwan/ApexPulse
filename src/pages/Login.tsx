import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck,
  Key,
  Layers,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
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

  const demoAccounts = [
    {
      role: 'Analis Kinerja (Default)',
      name: 'Siti Rahmawati, S.E.',
      email: 'demo@apexpulse.id',
      avatar: '👩‍💼',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
      description: 'Penyusun laporan, chat generator, koreksi angka manual F-14',
    },
    {
      role: 'Administrator Sistem',
      name: 'Budi Santoso, S.Kom, M.T.',
      email: 'admin@apexpulse.id',
      avatar: '👨‍💼',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'Akses tata kelola, integrasi RAG, probe & manajemen multi-BUMD',
    },
    {
      role: 'Direksi & Dewan Pengawas',
      name: 'Dr. Ir. Hendra Kusuma',
      email: 'direksi@apexpulse.id',
      avatar: '👔',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      description: 'Hak akses monitoring eksekutif, cetak laporan & notifikasi alert',
    },
  ];

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
        throw new Error(data.error || 'Autentikasi gagal. Silakan periksa kembali email dan kata sandi.');
      }

      // Store auth session
      if (rememberMe) {
        localStorage.setItem('apexpulse_token', data.token);
        localStorage.setItem('apexpulse_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('apexpulse_token', data.token);
        sessionStorage.setItem('apexpulse_user', JSON.stringify(data.user));
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menghubungi server.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('apexpulse2026');
    handleLogin(undefined, demoEmail, 'apexpulse2026');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Container Box */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-800/40">
        {/* Left Side: Brand & Feature Highlights */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Logo */}
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg ring-2 ring-sky-400/30">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight flex items-center gap-1.5">
                  ApexPulse
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 uppercase tracking-wider">
                    BUMD
                  </span>
                </span>
                <p className="text-[11px] text-slate-400">Portal Otomasi Dashboard RAG</p>
              </div>
            </div>

            <div className="pt-6">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
                Dashboard Otomatis dari Dokumen Resmi BUMD
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Platform sintesis analitik eksekutif instansi daerah terintegrasi langsung dengan pangkalan data retrieval tanpa risiko halusinasi model AI.
              </p>
            </div>
          </div>

          {/* Core Feature Badges */}
          <div className="relative z-10 my-8 space-y-3">
            {[
              {
                icon: FileCheck,
                title: '100% Sitasi Dokumen Terverifikasi',
                desc: 'Setiap angka terikat dengan berkas LRA, nomor halaman, dan kutipan teks asli.',
              },
              {
                icon: Layers,
                title: 'Dual Jalur RAG (A & B) + Fallback',
                desc: 'Mendukung model LLM JSON maupun agregasi metadata murni deterministik.',
              },
              {
                icon: ShieldCheck,
                title: 'Standar Audit BPKP & OJK (F-14)',
                desc: 'Dukungan koreksi manual bersertifikat, rekam jejak audit, dan isolasi tenant.',
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white">{f.title}</h3>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Info */}
          <div className="relative z-10 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Enkripsi Sesi Aktif</span>
            <span className="font-mono text-slate-500">v1.2-BUMD</span>
          </div>
        </div>

        {/* Right Side: Login Form & Quick Demo Pickers */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Masuk ke Portal
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Masukkan email dan kata sandi akun resmi instansi BUMD Anda
                </p>
              </div>
              <span className="p-2 bg-slate-100 rounded-xl text-slate-600">
                <Lock className="w-4 h-4" />
              </span>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Akun Instansi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="nama@pdam-tirta.id"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Kata Sandi (Password)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Demo: <strong className="font-mono text-slate-600">apexpulse2026</strong>
                  </span>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full text-xs pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
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
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-slate-600">Simpan sesi di peramban ini</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Kredensial...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem ApexPulse</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick 1-Click Demo Accounts Section */}
          <div className="pt-4 border-t border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Pilih Akun Demo (1-Klik Masuk Langsung)</span>
              </span>
              <span className="text-[10px] text-slate-400">Siap Presentasi</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {demoAccounts.map((account, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDemoAccount(account.email)}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50/60 hover:border-sky-300 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl p-1.5 bg-white rounded-lg border border-slate-200 shrink-0 group-hover:scale-105 transition-transform">
                      {account.avatar}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {account.name}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${account.badgeColor}`}>
                          {account.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {account.description}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-sky-600 group-hover:translate-x-0.5 transition-transform shrink-0 flex items-center gap-1">
                    <span>Masuk</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
