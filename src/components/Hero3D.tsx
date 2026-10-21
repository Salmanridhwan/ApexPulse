import { useEffect, useRef, useState, type FC } from 'react';
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

/**
 * Hero 3D halaman login — komponen WebGL sungguhan (three.js), bukan CSS
 * transform. Tiga panel melayang di ruang 3D dan isinya meniru produknya:
 *   1. belakang kiri — halaman dokumen (kutipan sumber RAG)
 *   2. tengah kanan  — kartu grafik Target & Realisasi
 *   3. depan         — kartu KPI (NRW 22,4%)
 * Jadi dekorasinya menjelaskan alur "dokumen -> grafik -> angka".
 *
 * Catatan teknis:
 *  - Hanya modul three yang dipakai yang diimpor (bukan seluruh pustaka),
 *    supaya bundel halaman login tetap ringan; komponen ini juga dimuat
 *    lewat React.lazy di Login.
 *  - Isi panel dilukis ke <canvas> 2D lalu dipakai sebagai tekstur, jadi
 *    teks tetap tajam tanpa aset/font eksternal.
 *  - Warna dibaca dari token tema dan diperbarui saat data-theme berubah.
 *  - Parallax mengikuti kursor; dimatikan bila OS meminta reduced motion.
 */

type Palet = {
  gelap: boolean;
  surface: string;
  surface2: string;
  lineStrong: string;
  ink: string;
  ink3: string;
  brand: string;
  brandInk: string;
  brandSoft: string;
  pos: string;
};

const bacaVar = (nama: string, cadangan: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nama).trim();
  return v || cadangan;
};

const bacaPalet = (): Palet => ({
  gelap: document.documentElement.dataset.theme === 'dark',
  surface: bacaVar('--color-surface', '#ffffff'),
  surface2: bacaVar('--color-surface-2', '#f1f3f6'),
  lineStrong: bacaVar('--color-line-strong', '#d1d7e0'),
  ink: bacaVar('--color-ink', '#1a1d1f'),
  ink3: bacaVar('--color-ink-3', '#5b6472'),
  brand: bacaVar('--color-brand', '#1fa6cc'),
  brandInk: bacaVar('--color-brand-ink', '#0f6b85'),
  brandSoft: bacaVar('--color-brand-soft', '#e6f6fb'),
  pos: bacaVar('--color-pos', '#0f7a53'),
});

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const garis = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, warna: string, h = 7) => {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = warna;
  ctx.fill();
};

function latarKartu(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palet) {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, p.surface);
  g.addColorStop(1, p.surface2);
  rr(ctx, 2, 2, w - 4, h - 4, 26);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = p.lineStrong;
  ctx.stroke();
}

function buatTekstur(jenis: 'dokumen' | 'grafik' | 'kpi', p: Palet): CanvasTexture {
  const [w, h] = jenis === 'dokumen' ? [512, 660] : jenis === 'grafik' ? [660, 460] : [560, 300];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  latarKartu(ctx, w, h, p);

  const judul = (t: string) => {
    ctx.font = '600 20px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = p.ink3;
    ctx.fillText(t.toUpperCase(), 34, 62);
  };

  if (jenis === 'dokumen') {
    judul('Dokumen');
    let y = 98;
    for (const lebar of [0.86, 0.94, 0.7, 0.9, 0.62]) {
      garis(ctx, 34, y, (w - 68) * lebar, p.lineStrong);
      y += 26;
    }
    rr(ctx, 34, y + 12, w - 68, 132, 14);
    ctx.fillStyle = p.brandSoft;
    ctx.fill();
    ctx.fillStyle = p.brand;
    ctx.fillRect(34, y + 12, 6, 132);
    ctx.font = '700 46px Georgia, serif';
    ctx.fillStyle = p.brandInk;
    ctx.fillText('\u201c', 56, y + 64);
    garis(ctx, 98, y + 42, (w - 200) * 0.9, p.brandInk, 8);
    garis(ctx, 98, y + 70, (w - 200) * 0.62, p.brandInk, 8);
    y += 170;
    for (const lebar of [0.78, 0.52]) {
      garis(ctx, 34, y, (w - 68) * lebar, p.lineStrong);
      y += 26;
    }
  }

  if (jenis === 'grafik') {
    judul('Target & realisasi');
    const dasar = h - 46;
    const tinggi = h - 152;
    const bar = 54;
    const jarak = 26;
    [0.42, 0.66, 0.55, 0.86, 0.72, 1].forEach((v, i) => {
      const x = 34 + i * (bar + jarak);
      const tb = tinggi * v;
      const g = ctx.createLinearGradient(0, dasar - tb, 0, dasar);
      const puncak = i === 5;
      g.addColorStop(0, puncak ? p.ink : p.brand);
      g.addColorStop(1, puncak ? p.ink3 : p.brandSoft);
      rr(ctx, x, dasar - tb, bar, tb, 10);
      ctx.fillStyle = g;
      ctx.fill();
    });
    ctx.strokeStyle = p.lineStrong;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, dasar + 1);
    ctx.lineTo(w - 28, dasar + 1);
    ctx.stroke();
  }

  if (jenis === 'kpi') {
    judul('NRW');
    ctx.font = '800 92px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = p.ink;
    ctx.fillText('22,4%', 30, 186);
    ctx.font = '600 22px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = p.pos;
    ctx.fillText('\u25bc 0,6 dari 2024', 34, 232);
    ctx.strokeStyle = p.brand;
    ctx.lineWidth = 5;
    ctx.beginPath();
    const titik = [
      [w - 210, 236],
      [w - 176, 214],
      [w - 142, 224],
      [w - 108, 186],
      [w - 74, 196],
      [w - 40, 158],
    ];
    titik.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}


function buatGlow(p: Palet): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
  g.addColorStop(0, p.brand);
  g.addColorStop(0.45, p.brandSoft);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

type Panel = {
  mesh: Group;
  fase: number;
  y: number;
  z0: number;
};

export const Hero3D: FC<{ className?: string }> = ({ className = '' }) => {
  const wadah = useRef<HTMLDivElement>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    const el = wadah.current;
    if (!el) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setGagal(true);
      return;
    }

    const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let palet = bacaPalet();
    let tekstur = {
      doc: buatTekstur('dokumen', palet),
      grafik: buatTekstur('grafik', palet),
      kpi: buatTekstur('kpi', palet),
    };

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new Scene();
    const kamera = new PerspectiveCamera(36, 1, 0.1, 100);
    kamera.position.set(0.04, 0.06, 5.25);

    const akar = new Group();
    akar.rotation.set(0.14, -0.2, 0.015);
    akar.scale.setScalar(1.08);
    scene.add(akar);

    // Cahaya lembut di belakang: memisahkan panggung dari latar gelap panel.
    const glowTex = buatGlow(palet);
    const glow = new Mesh(
      new PlaneGeometry(5.6, 4.4),
      new MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    glow.position.set(0.1, 0.1, -2.4);
    scene.add(glow);

    const buatPanel = (tex: CanvasTexture, l: number, t: number, pos: [number, number, number], rot: [number, number, number]) => {
      const g = new Group();
      g.position.set(...pos);
      g.rotation.set(...rot);

      // Lapisan tepi di belakang: memberi kesan kartu punya ketebalan.
      const tepi = new Mesh(
        new PlaneGeometry(l * 1.015, t * 1.02),
        new MeshBasicMaterial({ color: palet.gelap ? 0x05080d : 0x9aa5b4, transparent: true, opacity: 0.78 }),
      );
      tepi.position.z = -0.035;

      const muka = new Mesh(new PlaneGeometry(l, t), new MeshBasicMaterial({ map: tex, transparent: true }));
      g.add(tepi, muka);
      akar.add(g);
      return g;
    };

    const panel: Panel[] = [
      { mesh: buatPanel(tekstur.doc, 1.5, 1.94, [-1.24, 0.5, -1.05], [0.02, 0.58, 0.04]), fase: 0, y: 0.5, z0: 0.04 },
      { mesh: buatPanel(tekstur.grafik, 2.05, 1.43, [0.82, 0.42, -0.15], [-0.02, -0.5, -0.03]), fase: 1.7, y: 0.42, z0: -0.03 },
      { mesh: buatPanel(tekstur.kpi, 1.72, 0.92, [-0.14, -0.86, 0.86], [0.02, 0.2, 0.02]), fase: 3.1, y: -0.86, z0: 0.02 },
    ];

    // Kursor -> rotasi panggung (parallax halus).
    const sasaran = { x: 0, y: 0 };
    const saatGerak = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      sasaran.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      sasaran.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    el.addEventListener('pointermove', saatGerak);

    // Ikuti tema: tekstur dilukis ulang saat data-theme berubah.
    const amatiTema = new MutationObserver(() => {
      const baru = bacaPalet();
      if (baru.gelap === palet.gelap && baru.surface === palet.surface) return;
      palet = baru;
      Object.values(tekstur).forEach((t) => t.dispose());
      tekstur = {
        doc: buatTekstur('dokumen', palet),
        grafik: buatTekstur('grafik', palet),
        kpi: buatTekstur('kpi', palet),
      };
      const urut = [tekstur.doc, tekstur.grafik, tekstur.kpi];
      panel.forEach((pn, i) => {
        const muka = pn.mesh.children[1] as Mesh;
        (muka.material as MeshBasicMaterial).map = urut[i];
        (muka.material as MeshBasicMaterial).needsUpdate = true;
        const tepi = pn.mesh.children[0] as Mesh;
        (tepi.material as MeshBasicMaterial).color.set(palet.gelap ? 0x05080d : 0x9aa5b4);
      });
    });
    amatiTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const ukur = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);

    let id = 0;
    const mulai = performance.now();
    const gambar = () => {
      const t = (performance.now() - mulai) / 1000;
      const k = 0.045;

      if (!kurangiGerak) {
        akar.rotation.y += (sasaran.x * 0.28 - akar.rotation.y) * k;
        akar.rotation.x += (-sasaran.y * 0.18 + 0.05 - akar.rotation.x) * k;
        akar.position.y = Math.sin(t * 0.5) * 0.05;
        panel.forEach((pn) => {
          pn.mesh.position.y = pn.y + Math.sin(t * 0.55 + pn.fase) * 0.055;
          pn.mesh.rotation.z = pn.z0 + Math.sin(t * 0.4 + pn.fase) * 0.014;
        });
      }

      renderer.render(scene, kamera);
      id = requestAnimationFrame(gambar);
    };
    gambar();

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      amatiTema.disconnect();
      el.removeEventListener('pointermove', saatGerak);
      Object.values(tekstur).forEach((t) => t.dispose());
      glowTex.dispose();
      scene.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const m = o.material as MeshBasicMaterial;
          m.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={wadah} className={`hero-webgl ${className}`} aria-hidden="true">
      {gagal && <span className="hero-webgl-fallback" />}
    </div>
  );
};
