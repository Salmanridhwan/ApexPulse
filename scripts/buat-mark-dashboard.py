"""Mark 3D dashboard Aiones Boards — layar isometrik + empat widget (ponytail: stdlib)."""
import math
import os

COS, SIN = math.cos(math.radians(30)), math.sin(math.radians(30))
X0, Y0 = 40, 200

TERANG = dict(muka='#17395f', kanan='#102a47', bawah='#0a1b33', kilau='#2a5580',
              putih=('#ffffff', '#dbe3ef', '#b3c2d8'), biru=('#0057ff', '#0040bf', '#002c8a'),
              teks='#9fb3cd', teks2='#c3d2e4')
GELAP = dict(muka='#24486f', kanan='#17395f', bawah='#0e2742', kilau='#3a6a9c',
             putih=('#ffffff', '#cfdaea', '#a8b9d0'), biru=('#3d8bff', '#2a6fe0', '#1b4fae'),
             teks='#a9bdd6', teks2='#cfdaea')


def p(u, v):
    return (X0 + u * COS, Y0 - u * SIN - v)


def titik(pts):
    return ' '.join('{:.1f},{:.1f}'.format(x, y) for x, y in pts)


def bidang(u1, v1, u2, v2, fill):
    return '<polygon points="{}" fill="{}"/>'.format(titik([p(u1, v1), p(u2, v1), p(u2, v2), p(u1, v2)]), fill)


def tebal(u1, v1, u2, v2, h, warna):
    atas, kanan, bawah = warna
    return (
        '<polygon points="{}" fill="{}"/>'.format(titik([p(u1, v1 + h), p(u2, v1 + h), p(u2, v2 + h), p(u1, v2 + h)]), atas)
        + '<polygon points="{}" fill="{}"/>'.format(titik([p(u2, v2 + h), p(u2, v1 + h), p(u2, v1), p(u2, v2)]), kanan)
        + '<polygon points="{}" fill="{}"/>'.format(titik([p(u1, v2 + h), p(u2, v2 + h), p(u2, v2), p(u1, v2)]), bawah)
    )


def mark(warna, ukuran=256, sederhana=False):
    c = warna
    w, h, t = 150, 112, 16
    isi = [bidang(0, 0, w, h, c['muka'])]
    if warna is GELAP:
        isi.append('<polygon points="{}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.6"/>'.format(
            titik([p(0, h), p(w, h), p(w, 0), p(w + t, -t), p(w + t, h - t), p(t, -t)])))
    isi.append('<polygon points="{}" fill="{}" opacity=".55"/>'.format(
        titik([p(0, h - 4), p(w, h - 4), p(w, h), p(0, h)]), c['kilau']))
    isi.append('<polygon points="{}" fill="{}"/>'.format(titik([p(w, h), p(w, 0), p(w + t, -t), p(w + t, h - t)]), c['kanan']))
    isi.append('<polygon points="{}" fill="{}"/>'.format(titik([p(0, 0), p(w, 0), p(w + t, -t), p(t, -t)]), c['bawah']))

    if sederhana:
        kartu = [(14, 12, 74, 100, c['putih']), (86, 12, 136, 100, c['biru'])]
    else:
        kartu = [(12, 58, 70, 100, c['putih']), (82, 58, 140, 100, c['biru']),
                 (12, 12, 70, 54, c['putih']), (82, 12, 140, 54, c['putih'])]
    for u1, v1, u2, v2, _ in kartu:
        isi.append('<polygon points="{}" fill="#06121f" opacity=".55"/>'.format(
            titik([p(u1 + 9, v1 - 13), p(u2 + 9, v1 - 13), p(u2 + 9, v2 - 13), p(u1 + 9, v2 - 13)])))
    for u1, v1, u2, v2, w2 in kartu:
        isi.append(tebal(u1, v1, u2, v2, 11 if not sederhana else 8, w2))

    if sederhana:
        return ('<svg width="{0}" height="{0}" viewBox="0 0 256 256" fill="none" '
                'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aiones Boards">'
                '<title>Aiones Boards</title>{1}</svg>').format(ukuran, ''.join(isi))

    # isi widget: grafik batang di kiri-bawah, garis data di tiga lainnya
    isi.append(bidang(18, 66, 26, 88, c['teks']))
    isi.append(bidang(30, 66, 38, 78, c['teks']))
    isi.append(bidang(42, 66, 50, 94, c['teks']))
    isi.append(bidang(88, 66, 96, 90, '#ffffff'))
    isi.append(bidang(100, 66, 108, 76, '#ffffff'))
    isi.append(bidang(112, 66, 120, 94, '#ffffff'))
    isi.append(bidang(18, 20, 62, 26, c['teks2']))
    isi.append(bidang(18, 32, 48, 38, c['teks2']))
    isi.append(bidang(88, 20, 132, 26, c['teks2']))
    isi.append(bidang(88, 32, 118, 38, c['teks2']))
    return (
        '<svg width="{0}" height="{0}" viewBox="0 0 256 256" fill="none" '
        'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aiones Boards">'
        '<title>Aiones Boards</title>{1}</svg>'.format(ukuran, ''.join(isi))
    )


def mark_kotak(warna, ukuran=256):
    """Varian 16 px: tanpa perspektif, dua panel besar — supaya tetap terbaca."""
    c = warna
    isi = ['<rect x="8" y="8" width="240" height="240" rx="52" fill="{}"/>'.format(c['muka'])]
    isi.append('<rect x="40" y="44" width="80" height="168" rx="12" fill="{}"/>'.format(c['putih'][0]))
    isi.append('<rect x="136" y="44" width="80" height="168" rx="12" fill="{}"/>'.format(c['biru'][0]))
    isi.append('<rect x="52" y="132" width="16" height="66" rx="5" fill="{}"/>'.format(c['teks']))
    isi.append('<rect x="76" y="100" width="16" height="98" rx="5" fill="{}"/>'.format(c['teks']))
    isi.append('<rect x="148" y="120" width="16" height="78" rx="5" fill="#ffffff"/>')
    isi.append('<rect x="172" y="88" width="16" height="110" rx="5" fill="#ffffff"/>')
    if warna is GELAP:
        isi.append('<rect x="8" y="8" width="240" height="240" rx="52" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="4"/>')
    return ('<svg width="{0}" height="{0}" viewBox="0 0 256 256" fill="none" '
            'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aiones Boards">'
            '<title>Aiones Boards</title>{1}</svg>').format(ukuran, ''.join(isi))

folder = r'C:\Salman\PROJEK\aiones-boards\public\brand\3d'
os.makedirs(folder, exist_ok=True)
open(os.path.join(folder, 'mark-dash.svg'), 'w', encoding='utf-8').write(mark(TERANG))
open(os.path.join(folder, 'mark-dash-gelap.svg'), 'w', encoding='utf-8').write(mark(GELAP))
open(os.path.join(folder, 'mark-dash-16.svg'), 'w', encoding='utf-8').write(mark_kotak(TERANG))
open(os.path.join(folder, 'mark-dash-16-gelap.svg'), 'w', encoding='utf-8').write(mark_kotak(GELAP))

for nama, warna, bg, src in (('ekspor-terang.html', TERANG, '#ffffff', 'mark-dash.svg'),
                             ('ekspor-gelap.html', GELAP, '#0a1b33', 'mark-dash-gelap.svg')):
    open(os.path.join(folder, nama), 'w', encoding='utf-8').write(
        '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:1024px;'
        'height:1024px;background:' + bg + ';overflow:hidden}img{display:block;width:1024px;height:1024px}'
        '</style></head><body><img src="' + src + '"></body></html>')

gaya = (
    'body{margin:0;padding:26px;font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif;'
    'background:#f4f6fa;color:#0f172a}'
    'h1{font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 16px}'
    '.baris{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}'
    '.kartu{background:#fff;border:1px solid #e3e7ef;border-radius:14px;padding:18px;display:flex;'
    'flex-direction:column;gap:12px;align-items:flex-start}'
    '.kartu.gelap{background:#0a1b33;border-color:#1b3255}'
    '.label{font-size:11px;font-weight:700;color:#8b97a8}'
    '.kartu.gelap .label{color:#8fa2bf}'
    '.deret{display:flex;gap:14px;align-items:flex-end}'
)
html = (
    '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Mark dashboard 3D</title>'
    '<style>' + gaya + '</style></head><body><h1>Mark dashboard 3D — layar + empat widget</h1>'
    '<div class="baris">'
    '<div class="kartu"><div class="deret">' +
    '<img src="mark-dash.svg" width="128" height="128"><img src="mark-dash.svg" width="64" height="64">'
    '<img src="mark-dash.svg" width="32" height="32"><img src="mark-dash-16.svg" width="16" height="16">' +
    '</div><div class="label">128 · 64 · 32 · 16 px</div></div>'
    '<div class="kartu gelap"><div class="deret">' +
    '<img src="mark-dash-gelap.svg" width="128" height="128"><img src="mark-dash-16-gelap.svg" width="32" height="32">' +
    '</div><div class="label">latar gelap</div></div>'
    '</div></body></html>'
)
open(os.path.join(folder, 'index.html'), 'w', encoding='utf-8').write(html)
print('selesai')
