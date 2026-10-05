import React, { useEffect, useRef } from 'react';

/**
 * Objek 3D dekoratif (torus knot glossy) untuk panel hero.
 * three.js dimuat dinamis supaya tidak membebani bundle awal; objek bergerak
 * mengikuti kursor dan berhenti berputar bila pengguna memilih "reduce motion".
 */
export const Hero3D: React.FC<{ className?: string }> = ({ className = '' }) => {
  const wadah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    let batal = false;
    let bersihkan: (() => void) | null = null;

    import('three').then((THREE) => {
      if (batal || !el) return;
      const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // WebGL tidak tersedia — panel tetap tampil tanpa objek 3D.
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.z = 6;

      const bahan = new THREE.MeshPhysicalMaterial({
        color: 0x8f90e4,
        metalness: 0.25,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        emissive: 0x2a3a5f,
        emissiveIntensity: 0.35,
      });
      const geo = new THREE.TorusKnotGeometry(1.05, 0.36, 180, 24);
      const knot = new THREE.Mesh(geo, bahan);
      scene.add(knot);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const l1 = new THREE.PointLight(0x38c6e2, 70, 20);
      l1.position.set(3, 3, 4);
      const l2 = new THREE.PointLight(0xf2503a, 50, 20);
      l2.position.set(-4, -2, 3);
      scene.add(l1, l2);

      const ukur = () => {
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      ukur();
      const ro = new ResizeObserver(ukur);
      ro.observe(el);

      let tx = 0;
      let ty = 0;
      const gerak = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        tx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 2;
        ty = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 2;
      };
      window.addEventListener('pointermove', gerak);

      let raf = 0;
      let t = 0;
      const gambar = () => {
        t += 0.008;
        if (!kurangiGerak) {
          knot.rotation.y += 0.006;
          knot.rotation.x += 0.003;
          knot.position.y = Math.sin(t * 2) * 0.12;
        }
        // Parallax halus mengikuti kursor.
        camera.position.x += (tx * 0.9 - camera.position.x) * 0.05;
        camera.position.y += (-ty * 0.9 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(gambar);
      };
      gambar();

      bersihkan = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', gerak);
        ro.disconnect();
        geo.dispose();
        bahan.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      batal = true;
      bersihkan?.();
    };
  }, []);

  return <div ref={wadah} className={className} aria-hidden="true" />;
};
