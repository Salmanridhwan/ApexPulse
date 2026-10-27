"""Sembilan kandidat mark 3D dashboard Aiones Boards (ponytail: stdlib)."""
import math
import os

C, S = math.cos(math.radians(30)), math.sin(math.radians(30))

NAVY = ('#2a5580', '#17395f', '#0b2340')
NAVY_TUA = ('#1c3f66', '#12294a', '#08172a')
BIRU = ('#3d86ff', '#0057ff', '#0039a8')
PUTIH = ('#ffffff', '#eef3fa', '#c6d4e6')


def proj(x, y, z):
    return ((x - y) * C, (x + y) * S - z)


def kotak(x, y, z, w, d, h, warna):
    x1, y1, z1 = x + w, y + d, z + h
    p = proj
    return [
        ([p(x, y, z1), p(x1, y, z1), p(x1, y1, z1), p(x, y1, z1)], warna[0]),
        ([p(x, y1, z1), p(x1, y1, z1), p(x1, y1, z), p(x, y1, z)], warna[1]),
        ([p(x1, y, z1), p(x1, y1, z1), p(x1, y1, z), p(x1, y, z)], warna[2]),
    ]


def susun(poligon):
    pts = [q for poly, _ in poligon for q in poly]
    xs = [q[0] for q in pts]
    ys = [q[1] for q in pts]
    lebar, tinggi = max(xs) - min(xs), max(ys) - min(ys)
    skala = min(232.0 / lebar, 232.0 / tinggi)
    tx = 128 - (min(xs) + lebar / 2) * skala
    ty = 128 - (min(ys) + tinggi / 2) * skala
    badan = ''.join(
        '<polygon points="{}" fill="{}"/>'.format(
            ' '.join('{:.1f},{:.1f}'.format(a * skala + tx, b * skala + ty) for a, b in poly), fill)
        for poly, fill in poligon)
    return ('<svg width="256" height="256" viewBox="0 0 256 256" fill="none" '
            'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aiones Boards">'
            '<title>Aiones Boards</title>' + badan + '</svg>')


def layar(w=150, d=14, h=100):
    return kotak(0, 0, 0, w, d, h, NAVY)


# 1 — layar + empat widget
def k1():
    p = layar()
    p += kotak(12, 14, 54, 58, 9, 40, PUTIH)
    p += kotak(82, 14, 54, 58, 9, 40, BIRU)
    p += kotak(12, 14, 8, 58, 9, 38, PUTIH)
    p += kotak(82, 14, 8, 58, 9, 38, PUTIH)
    return p


# 2 — papan tidur + balok widget
def k2():
    p = kotak(0, 0, 0, 160, 120, 12, NAVY_TUA)
    p += kotak(16, 18, 12, 34, 34, 46, PUTIH)
    p += kotak(62, 18, 12, 34, 34, 70, BIRU)
    p += kotak(108, 18, 12, 34, 34, 30, PUTIH)
    p += kotak(16, 70, 12, 126, 34, 16, PUTIH)
    return p


# 3 — layar + satu kartu meluncur keluar tepi kanan
def k3():
    p = layar(w=132)
    p += kotak(14, 14, 54, 50, 9, 38, PUTIH)
    p += kotak(72, 14, 54, 46, 9, 38, PUTIH)
    p += kotak(14, 14, 8, 50, 9, 38, BIRU)
    p += kotak(72, 14, 8, 46, 9, 38, PUTIH)
    p += kotak(132, 0, 26, 56, 14, 56, BIRU)   # kartu meluncur dari tepi kanan
    return p


# 4 — satu widget besar + tiga kecil
def k4():
    p = layar()
    p += kotak(12, 14, 8, 66, 9, 86, BIRU)
    p += kotak(86, 14, 60, 52, 9, 34, PUTIH)
    p += kotak(86, 14, 32, 52, 9, 20, PUTIH)
    p += kotak(86, 14, 8, 52, 9, 16, PUTIH)
    return p


# 5 — dua layar, masing-masing berisi widget
def k5():
    p = kotak(0, 0, 0, 76, 14, 96, NAVY)
    p += kotak(10, 14, 52, 56, 8, 32, PUTIH)
    p += kotak(10, 14, 10, 56, 8, 34, BIRU)
    p += kotak(88, 0, 0, 76, 14, 96, NAVY)
    p += kotak(98, 14, 52, 56, 8, 32, PUTIH)
    p += kotak(98, 14, 10, 26, 8, 34, PUTIH)
    p += kotak(128, 14, 10, 26, 8, 34, PUTIH)
    return p


# 6 — grid 3 x 2
def k6():
    p = layar(w=156, h=104)
    for i in range(3):
        for j in range(2):
            warna = BIRU if (i == 2 and j == 1) else PUTIH
            p += kotak(12 + i * 46, 14, 10 + j * 46, 38, 8, 38, warna)
    return p


# 7 — layar + diagram batang 3D
def k7():
    p = layar(w=150, h=96)
    p += kotak(12, 14, 8, 126, 9, 8, PUTIH)  # alas grafik
    for i, tinggi in enumerate((26, 44, 34, 62)):
        warna = BIRU if i == 3 else PUTIH
        p += kotak(20 + i * 30, 14, 16, 22, 9, tinggi, warna)
    return p


# 8 — kubus dashboard, widget di dua sisi
def k8():
    p = kotak(0, 0, 0, 108, 108, 108, NAVY)
    p += kotak(10, 108, 56, 40, 8, 40, PUTIH)   # sisi depan
    p += kotak(58, 108, 56, 40, 8, 40, BIRU)
    p += kotak(10, 108, 10, 88, 8, 34, PUTIH)
    p += kotak(108, 10, 56, 8, 40, 40, PUTIH)   # sisi kanan
    p += kotak(108, 58, 10, 8, 40, 34, PUTIH)
    return p


# 9 — layar + satu panel melayang di depan
def k9():
    p = layar(w=136, h=96)
    p += kotak(8, 14, 10, 44, 8, 70, PUTIH)
    p += kotak(60, 14, 10, 30, 8, 30, PUTIH)
    p += kotak(60, 14, 48, 30, 8, 32, PUTIH)
    p += kotak(24, 44, 26, 84, 12, 50, BIRU)   # panel melayang
    return p


# 10 — kubus dengan chart di ketiga sisi
def k10():
    p = kotak(0, 0, 0, 110, 110, 110, NAVY)
    # sisi depan (y = 110): empat batang
    for x, t in ((14, 30), (40, 54), (66, 40), (92, 66)):
        warna = BIRU if t == 66 else PUTIH
        p += kotak(x, 110, 10, 18, 7, t, warna)
    # sisi kanan (x = 110): tiga batang
    for y, t in ((16, 46), (46, 26), (76, 62)):
        warna = BIRU if t == 62 else PUTIH
        p += kotak(110, y, 10, 7, 24, t, warna)
    # sisi atas (z = 110): tiga batang pendek
    for x, t in ((16, 22), (48, 38), (80, 28)):
        warna = BIRU if t == 38 else PUTIH
        p += kotak(x, 22, 110, 24, 60, t, warna)
    return p

# --- keluarga kubus: chart di tiap sisi -----------------------------------
def _kubus_dasar():
    return kotak(0, 0, 0, 110, 110, 110, NAVY)


def k11():
    """A — batang di ketiga sisi."""
    p = _kubus_dasar()
    for x, t in ((12, 28), (38, 52), (64, 38), (90, 64)):
        p += kotak(x, 110, 10, 18, 7, t, BIRU if t == 64 else PUTIH)
    for y, t in ((12, 44), (38, 24), (64, 58), (90, 32)):
        p += kotak(110, y, 10, 7, 18, t, BIRU if t == 58 else PUTIH)
    for x, y, t in ((20, 20, 22), (66, 20, 40), (20, 66, 32), (66, 66, 50)):
        p += kotak(x, y, 110, 22, 22, t, BIRU if t == 50 else PUTIH)
    return p


def k12():
    """B — batang depan, tren menurun di kanan, ubin di atas."""
    p = _kubus_dasar()
    for x, t in ((12, 30), (38, 50), (64, 40), (90, 62)):
        p += kotak(x, 110, 10, 18, 7, t, BIRU if t == 62 else PUTIH)
    for i, t in enumerate((58, 44, 30, 18)):
        p += kotak(110, 12 + i * 26, 10, 7, 18, t, BIRU if i == 0 else PUTIH)
    for i in range(3):
        p += kotak(16 + i * 28, 24, 110, 22, 58, 6, BIRU if i == 1 else PUTIH)
    return p


def k13():
    """C — batang depan, batang kanan, satu blok besar di atas."""
    p = _kubus_dasar()
    for x, t in ((12, 34), (38, 26), (64, 46), (90, 36)):
        p += kotak(x, 110, 10, 18, 7, t, PUTIH)
    for y, t in ((12, 28), (38, 40), (64, 30), (90, 48)):
        p += kotak(110, y, 10, 7, 18, t, PUTIH)
    p += kotak(20, 20, 110, 46, 46, 46, BIRU)
    p += kotak(20, 74, 110, 30, 20, 20, PUTIH)
    p += kotak(60, 74, 110, 30, 20, 20, PUTIH)
    return p

# --- kubus final: chart di tiga sisi --------------------------------------
def k14():
    p = kotak(0, 0, 0, 110, 110, 110, NAVY)
    # sisi depan: batang naik, biru di ujung
    for x, t in ((12, 26), (38, 44), (64, 34), (90, 60)):
        p += kotak(x, 110, 10, 18, 7, t, BIRU if t == 60 else PUTIH)
    # sisi kanan: batang menurun, biru di awal
    for i, t in enumerate((54, 38, 30, 22)):
        p += kotak(110, 12 + i * 26, 10, 7, 18, t, BIRU if i == 0 else PUTIH)
    # sisi atas: batang mendatar, biru di tengah
    for i, panjang in enumerate((34, 54, 28, 66)):
        p += kotak(18 + i * 24, 26, 110, 18, panjang, 8, BIRU if i == 3 else PUTIH)
    return p

# --- set final kubus dashboard --------------------------------------------
PALET_GELAP = ('#315e8c', '#1f4468', '#102a47')


def kubus_chart(navy=NAVY, ukuran=256, sederhana=False):
    p = kotak(0, 0, 0, 110, 110, 110, navy)
    if sederhana:
        for x, t in ((14, 30), (40, 48), (66, 38), (90, 56)):
            p += kotak(x, 110, 12, 16, 6, t, BIRU if t == 56 else PUTIH)
        return p
    for x, t in ((14, 26), (38, 42), (62, 34), (86, 54)):
        p += kotak(x, 110, 12, 16, 6, t, BIRU if t == 54 else PUTIH)
    for i, t in enumerate((50, 36, 28, 20)):
        p += kotak(110, 14 + i * 24, 12, 6, 16, t, BIRU if i == 0 else PUTIH)
    for i, panjang in enumerate((30, 48, 26, 58)):
        p += kotak(20 + i * 22, 28, 110, 16, panjang, 7, BIRU if i == 3 else PUTIH)
    return p


def svg_kubus(navy, ukuran=256, sederhana=False):
    poligon = kubus_chart(navy, sederhana=sederhana)
    pts = [q for poly, _ in poligon for q in poly]
    xs = [q[0] for q in pts]
    ys = [q[1] for q in pts]
    lebar, tinggi = max(xs) - min(xs), max(ys) - min(ys)
    skala = min(232.0 / lebar, 232.0 / tinggi)
    tx = 128 - (min(xs) + lebar / 2) * skala
    ty = 128 - (min(ys) + tinggi / 2) * skala
    badan = ''.join(
        '<polygon points="{}" fill="{}"/>'.format(
            ' '.join('{:.1f},{:.1f}'.format(a * skala + tx, b * skala + ty) for a, b in poly), fill)
        for poly, fill in poligon)
    return ('<svg width="{0}" height="{0}" viewBox="0 0 256 256" fill="none" '
            'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aiones Boards">'
            '<title>Aiones Boards</title>{1}</svg>').format(ukuran, badan)

# --- kubus campuran: tiap sisi beda isi ------------------------------------
def k15():
    """A — batang (depan), daftar baris (kanan), dua kartu (atas)."""
    p = kotak(0, 0, 0, 110, 110, 110, NAVY)
    for x, t in ((14, 28), (40, 48), (66, 36), (90, 58)):
        p += kotak(x, 110, 12, 16, 6, t, BIRU if t == 58 else PUTIH)
    for i in range(4):  # baris daftar
        warna = BIRU if i == 0 else PUTIH
        p += kotak(110, 14 + i * 24, 18, 6, 14, 9, warna)
    p += kotak(20, 22, 110, 30, 62, 10, PUTIH)   # kartu besar di atas
    p += kotak(58, 22, 110, 28, 30, 10, BIRU)
    return p


def k16():
    """B — dua kartu (depan), batang (kanan), garis naik (atas)."""
    p = kotak(0, 0, 0, 110, 110, 110, NAVY)
    p += kotak(14, 110, 12, 44, 6, 62, PUTIH)
    p += kotak(64, 110, 12, 34, 6, 44, BIRU)
    for i, t in enumerate((52, 34, 40, 22)):
        p += kotak(110, 14 + i * 24, 12, 6, 16, t, BIRU if i == 0 else PUTIH)
    for i, panjang in enumerate((22, 34, 46, 62)):  # garis naik
        p += kotak(18 + i * 24, 30, 110, 16, panjang, 7, BIRU if i == 3 else PUTIH)
    return p


def k17():
    """C — batang (depan), baris (kanan), satu blok KPI besar (atas)."""
    p = kotak(0, 0, 0, 110, 110, 110, NAVY)
    for x, t in ((14, 26), (40, 42), (66, 32), (90, 52)):
        p += kotak(x, 110, 12, 16, 6, t, PUTIH)
    for i in range(3):
        p += kotak(110, 16 + i * 30, 16, 6, 16, 12, BIRU if i == 2 else PUTIH)
    p += kotak(26, 26, 110, 58, 58, 14, BIRU)
    return p

# --- set final: kubus campuran A ------------------------------------------
def kubus_campur(navy=NAVY, sederhana=False):
    p = kotak(0, 0, 0, 110, 110, 110, navy)
    if sederhana:
        for x, t in ((16, 28), (44, 46), (72, 34)):
            p += kotak(x, 110, 12, 20, 6, t, PUTIH)
        p += kotak(24, 28, 110, 60, 54, 10, BIRU)
        return p
    for x, t in ((14, 26), (38, 44), (62, 34), (86, 56)):
        p += kotak(x, 110, 12, 16, 6, t, BIRU if t == 56 else PUTIH)
    for i in range(4):  # daftar baris di sisi kanan
        warna = BIRU if i == 0 else PUTIH
        p += kotak(110, 16 + i * 24, 20, 6, 14, 11, warna)
    p += kotak(18, 24, 110, 44, 56, 10, PUTIH)   # kartu besar di atas
    p += kotak(66, 24, 110, 26, 28, 10, BIRU)    # kartu kecil biru
    return p


def svg_kubus_campur(navy, sederhana=False):
    poligon = kubus_campur(navy, sederhana=sederhana)
    pts = [q for poly, _ in poligon for q in poly]
    xs = [q[0] for q in pts]
    ys = [q[1] for q in pts]
    lebar, tinggi = max(xs) - min(xs), max(ys) - min(ys)
    skala = min(232.0 / lebar, 232.0 / tinggi)
    tx = 128 - (min(xs) + lebar / 2) * skala
    ty = 128 - (min(ys) + tinggi / 2) * skala
    badan = ''.join(
        '<polygon points="{}" fill="{}"/>'.format(
            ' '.join('{:.1f},{:.1f}'.format(a * skala + tx, b * skala + ty) for a, b in poly), fill)
        for poly, fill in poligon)
    return ('<svg width="{0}" height="{0}" viewBox="0 0 256 256" fill="none" '
            'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aiones Boards">'
            '<title>Aiones Boards</title>{1}</svg>').format(256, badan)

folder = r'C:\Salman\PROJEK\aiones-boards\public\brand\3d'
os.makedirs(folder, exist_ok=True)

kandidat = [
    ('1', 'Layar + empat widget', 'Layar isometrik, empat kartu menonjol, satu biru.', k1),
    ('2', 'Papan tidur + balok', 'Papan datar 3D dengan balok widget berdiri.', k2),
    ('3', 'Kartu meluncur keluar', 'Layar navy dengan satu kartu biru menembus tepi kanan.', k3),
    ('4', 'Satu widget dominan', 'Kartu biru besar di kiri, tiga kartu kecil di kanan.', k4),
    ('5', 'Dua layar bersebelahan', 'Dua layar berdiri, masing-masing berisi widget.', k5),
    ('6', 'Grid 3 x 2', 'Enam widget tipis, satu biru di sudut.', k6),
    ('7', 'Diagram batang 3D', 'Layar dengan empat batang naik di dalamnya.', k7),
    ('8', 'Kubus dashboard', 'Kubus navy dengan widget di sisi depan dan kanan.', k8),
    ('9', 'Panel melayang', 'Layar navy dengan satu panel biru melayang di depan.', k9),
    ('10', 'Kubus + chart tiap sisi', 'Kubus navy dengan diagram batang di sisi depan, kanan, dan atas.', k10),
    ('11', 'Kubus A — batang tiga sisi', 'Batang di depan, kanan, dan atas; satu biru tiap sisi.', k11),
    ('12', 'Kubus B — tren + ubin', 'Batang di depan, tren menurun di kanan, ubin tipis di atas.', k12),
    ('13', 'Kubus C — blok besar di atas', 'Batang di dua sisi, satu blok biru besar di sisi atas.', k13),
    ('14', 'Kubus final', 'Batang naik di depan, menurun di kanan, mendatar di atas.', k14),
    ('15', 'Kubus campur A', 'Batang di depan, daftar baris di kanan, dua kartu di atas.', k15),
    ('16', 'Kubus campur B', 'Dua kartu di depan, batang di kanan, garis naik di atas.', k16),
    ('17', 'Kubus campur C', 'Batang di depan, baris di kanan, satu blok KPI besar di atas.', k17),
]

kartu = []
for nomor, nama, ket, fn in kandidat:
    open(os.path.join(folder, 'kandidat-{}.svg'.format(nomor)), 'w', encoding='utf-8').write(susun(fn()))
    kartu.append(
        '<div class="kartu"><div class="no">{0}</div><img src="kandidat-{0}.svg" width="196" height="196">'
        '<div class="nama">{1}</div><div class="ket">{2}</div></div>'.format(nomor, nama, ket))

gaya = (
    'body{margin:0;padding:22px;font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif;'
    'background:#f4f6fa;color:#0f172a}'
    'h1{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 14px}'
    '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:840px}'
    '.kartu{background:#fff;border:1px solid #e3e7ef;border-radius:14px;padding:11px;position:relative}'
    '.no{position:absolute;top:9px;left:11px;font-size:12px;font-weight:900;color:#0057ff}'
    '.nama{font-size:12px;font-weight:800;margin:5px 0 2px}'
    '.ket{font-size:10.5px;color:#64748b;line-height:1.35}'
)
html = ('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Sembilan kandidat mark</title>'
        '<style>' + gaya + '</style></head><body><h1>Sembilan kandidat mark dashboard 3D</h1>'
        '<div class="grid">' + ''.join(kartu) + '</div></body></html>')
open(os.path.join(folder, 'kandidat.html'), 'w', encoding='utf-8').write(html)
# --- berkas final kubus ---
open(os.path.join(folder, 'mark-kubus.svg'), 'w', encoding='utf-8').write(svg_kubus(NAVY))
open(os.path.join(folder, 'mark-kubus-gelap.svg'), 'w', encoding='utf-8').write(svg_kubus(PALET_GELAP))
open(os.path.join(folder, 'mark-kubus-16.svg'), 'w', encoding='utf-8').write(svg_kubus(NAVY, sederhana=True))
# --- berkas final kubus campuran ---
open(os.path.join(folder, 'mark-campur.svg'), 'w', encoding='utf-8').write(svg_kubus_campur(NAVY))
open(os.path.join(folder, 'mark-campur-gelap.svg'), 'w', encoding='utf-8').write(svg_kubus_campur(PALET_GELAP))
open(os.path.join(folder, 'mark-campur-16.svg'), 'w', encoding='utf-8').write(svg_kubus_campur(NAVY, sederhana=True))
print('selesai')
