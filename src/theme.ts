export type ThemeMode = 'light' | 'dark';

const KEY = 'aiones-theme';

/**
 * Tema awal: pilihan tersimpan pengguna, kalau belum ada pakai GELAP.
 *
 * Gelap dijadikan bawaan (bukan mengikuti setelan sistem) karena seluruh tampilan
 * dirancang untuk latar gelap. Preferensi sistem sengaja tidak dipakai supaya
 * pengguna dengan OS bertema terang tetap mendapat tampilan yang sama.
 */
export function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* localStorage tidak tersedia */
  }
  return 'dark';
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* abaikan */
  }
}

import { useEffect, useState } from 'react';

/** Mode tema aktif (reaktif terhadap perubahan atribut data-theme pada <html>). */
export function useThemeMode(): ThemeMode {
  const baca = (): ThemeMode =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const [mode, setMode] = useState<ThemeMode>(baca);
  useEffect(() => {
    const obs = new MutationObserver(() => setMode(baca()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return mode;
}
