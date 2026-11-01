import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, EVENT_TEMA, getInitialTheme, ThemeMode } from '../theme';

/** Tombol saklar terang/gelap berbentuk pil dengan knob timbul. */
export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') !== mode) applyTheme(mode);
  }, [mode]);

  // Tema bisa diganti dari tempat lain (menu akun); saklar ini ikut menyesuaikan.
  useEffect(() => {
    const ikut = (e: Event) => setMode((e as CustomEvent<ThemeMode>).detail);
    window.addEventListener(EVENT_TEMA, ikut);
    return () => window.removeEventListener(EVENT_TEMA, ikut);
  }, []);

  const gelap = mode === 'dark';

  return (
    <button
      type="button"
      onClick={() => setMode(gelap ? 'light' : 'dark')}
      role="switch"
      aria-checked={gelap}
      aria-label={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      title={gelap ? 'Mode terang' : 'Mode gelap'}
      className="relative w-[58px] h-8 rounded-full bg-surface-2 border border-line shadow-inset shrink-0 transition-colors"
    >
      <Sun className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warn" />
      <Moon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-ink" />
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-surface border border-line shadow-pop-sm flex items-center justify-center text-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          gelap ? 'translate-x-[26px]' : 'translate-x-0'
        }`}
      >
        {gelap ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
      </span>
    </button>
  );
};
