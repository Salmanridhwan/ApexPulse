"""Mark 3D isometrik Aiones Boards — papan + panel meluncur (ponytail: stdlib)."""
import os

BIRU_ATAS, BIRU_DEPAN, BIRU_SISI = '#0057ff', '#0040bf', '#002c8a'
NAVY_ATAS, NAVY_DEPAN, NAVY_SISI = '#1e4272', '#132c4e', '#0a1b33'


def slab(x, y, w, h, s, t, atas, depan, sisi, garis=None):
    stroke = f' stroke="{garis}" stroke-width="1.5"' if garis else ''
    return (
        f'<path d="M{x},{y} L{x + w},{y} L{x + w - s},{y + h} L{x - s},{y + h} Z" fill="{atas}"{stroke}/>'
        f'<path d="M{x - s},{y + h} L{x + w - s},{y + h} L{x + w - s},{y + h + t} L{x - s},{y + h + t} Z" fill="{depan}"/>'
        f'<path d="M{x},{y} L{x - s},{y + h} L{x - s},{y + h + t} L{x},{y + t} Z" fill="{sisi}"/>'
    )


def mark(warna='terang', ukuran=256):
    if warna == 'terang':
        n_atas, n_depan, n_sisi = NAVY_ATAS, NAVY_DEPAN, NAVY_SISI
        b_atas, b_depan, b_sisi = BIRU_ATAS, BIRU_DEPAN, BIRU_SISI
        garis = 'rgba(255,255,255,.18)'
    else:
        n_atas, n_depan, n_sisi = '#2b5488', '#1b3a63', '#12294a'
        b_atas, b_depan, b_sisi = '#3d8bff', '#2a6fe0', '#1b4fae'
        garis = 'rgba(255,255,255,.28)'

    bayangan = '<ellipse cx="150" cy="200" rx="96" ry="20" fill="#0a1b33" opacity=".10"/>'
    papan = slab(34, 128, 150, 48, 30, 22, n_atas, n_depan, n_sisi, garis)
    panel = slab(124, 70, 108, 38, 28, 22, b_atas, b_depan, b_sisi, garis)
    return (
        f'<svg width="{ukuran}" height="{ukuran}" viewBox="0 0 256 256" fill="none" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aiones Boards">'
        f'<title>Aiones Boards</title>{bayangan}{papan}{panel}</svg>'
    )


folder = r'C:\Salman\PROJEK\aiones-boards\public\brand\3d'
os.makedirs(folder, exist_ok=True)
open(os.path.join(folder, 'mark-3d.svg'), 'w', encoding='utf-8').write(mark('terang'))
open(os.path.join(folder, 'mark-3d-gelap.svg'), 'w', encoding='utf-8').write(mark('gelap'))

html = """<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Mark 3D — Aiones Boards</title>
<style>
 body{margin:0;padding:28px;font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif;background:#f4f6fa;color:#0f172a}
 h1{font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 16px}
 .baris{display:flex;gap:16px;flex-wrap:wrap}
 .kartu{background:#fff;border:1px solid #e3e7ef;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
 .kartu.gelap{background:#0a1b33;border-color:#1b3255}
 .label{font-size:11px;font-weight:700;color:#8b97a8}
 .kartu.gelap .label{color:#8fa2bf}
 .deret{display:flex;gap:14px;align-items:flex-end}
</style></head><body>
<h1>Mark 3D isometrik — papan + panel meluncur</h1>
<div class="baris">
 <div class="kartu"><div class="deret"><img src="mark-3d.svg" width="128" height="128"><img src="mark-3d.svg" width="64" height="64"><img src="mark-3d.svg" width="32" height="32"><img src="mark-3d.svg" width="16" height="16"></div><div class="label">128 · 64 · 32 · 16 px</div></div>
 <div class="kartu gelap"><div class="deret"><img src="mark-3d-gelap.svg" width="128" height="128"><img src="mark-3d-gelap.svg" width="64" height="64"></div><div class="label">latar gelap</div></div>
</div>
</body></html>"""
open(os.path.join(folder, 'index.html'), 'w', encoding='utf-8').write(html)
print('selesai')
