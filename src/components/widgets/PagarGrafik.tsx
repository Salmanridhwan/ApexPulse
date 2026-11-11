import React from 'react';

/**
 * PAGAR SATU KARTU GRAFIK.
 *
 * Mengganti bentuk chart berarti mengganti mesin gambar di dalam kartu (ECharts,
 * HTML, atau SVG). Kalau salah satu bentuk gagal dirender, React tanpa pagar
 * akan melepas seluruh pohon halaman dan pengguna melihat layar "Halaman gagal
 * dimuat". Dengan pagar ini, kegagalan terkurung di kartu itu saja: kartu
 * menampilkan keterangan singkat dan tombol Coba lagi, kartu lain tetap hidup.
 */
interface Props {
  children: React.ReactNode;
}

interface State {
  galat: string | null;
}

export class PagarGrafik extends React.Component<Props, State> {
  state: State = { galat: null };

  static getDerivedStateFromError(e: unknown): State {
    return { galat: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.error('Bentuk grafik gagal dirender:', e);
  }

  render() {
    if (this.state.galat) {
      return (
        <div
          data-testid="grafik-gagal"
          className="h-full w-full flex flex-col items-center justify-center gap-2 px-4 text-center"
        >
          <span className="text-[11px] font-medium text-ink-2">Bentuk grafik ini gagal ditampilkan.</span>
          <span className="text-[10px] text-ink-3 leading-snug">
            Pilih bentuk lain dari menu ⋯, atau coba lagi.
          </span>
          <button
            type="button"
            onClick={() => this.setState({ galat: null })}
            className="px-2.5 py-1 min-h-9 rounded-control text-[11px] font-semibold border border-line bg-surface text-ink-2 hover:bg-surface-2 transition-colors"
          >
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
