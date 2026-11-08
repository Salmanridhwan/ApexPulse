/* UX probe — dijalankan DI DALAM halaman (bukan Node).
 *
 * Pemakaian:
 *   puppeteer:    page.evaluate(`(() => { ${src}; return uxProbe({mobile:true}); })()`)
 *   browser_exec: js(`(() => { ${src}; return uxProbe({mobile:true}); })()`)
 *
 * Mengembalikan objek biasa (JSON-able). Tidak menyentuh jaringan, tidak mengubah DOM
 * selain membuat satu <canvas> 1x1 untuk membaca warna.
 *
 * Yang diukur hanya hal yang bisa dibantah angkanya. Hierarki, copy, dan alur berpikir
 * tetap dinilai manusia dari tangkapan layar.
 */
function uxProbe(opts) {
  opts = opts || {};
  var mobile = !!opts.mobile;
  var maxList = opts.maxList || 12;
  var targetMin = mobile ? 44 : 24;

  var out = {
    meta: {}, counts: {}, worst: {}, deductions: [],
    score: 100, grade: '', catatan: []
  };

  var de = document.documentElement;
  var vw = window.innerWidth;

  /* ---------- util ---------- */
  var cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  var ctx = cv.getContext('2d');

  /* Warna computed bisa berbentuk oklch()/color(display-p3 ...) di Tailwind v4.
   * fillStyle bisa mengembalikan string dengan color space yang sama, jadi regex
   * tidak cukup: warna dirasterkan 1x1 lalu pikselnya dibaca. Hasilnya selalu sRGB,
   * sama seperti yang dilihat mata. Di-cache karena warna computed banyak yang kembar. */
  var colorCache = {};
  function toRGBA(c) {
    if (!c) return null;
    if (colorCache[c]) return colorCache[c];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#123456';
    ctx.fillStyle = c;
    var gagalSet = ctx.fillStyle === '#123456' && String(c).replace(/\s/g, '').toLowerCase() !== '#123456';
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    var hasil = gagalSet ? null : { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    colorCache[c] = hasil;
    return hasil;
  }

  function blend(fg, bg) {
    var a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }

  function channel(v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function lum(c) {
    return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  }

  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function offCanvas(r) {
    var docW = Math.max(de.scrollWidth, vw);
    // Elemen yang SELURUH kotaknya di luar layar (drawer mobile tertutup yang
    // digeser -100%, panel yang disembunyikan dengan translate) tidak bisa
    // disentuh pengguna: jangan dihitung sebagai target sentuh kecil.
    if (r.right <= 0 || r.left >= vw) return true;
    return r.right < -40 || r.bottom < -40 || r.left > docW + 40;
  }

  function tersembunyi(el) {
    return !!el.closest('[aria-hidden="true"], [inert]');
  }

  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (tersembunyi(el)) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (offCanvas(r)) return false;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    return true;
  }

  function ownText(el) {
    var t = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue;
    }
    return t.replace(/\s+/g, ' ').trim();
  }

  /* textContent, bukan innerText: innerText mengembalikan '' untuk sebagian elemen
   * (subtree yang belum dilukis), dan itu memunculkan "tombol tanpa nama" palsu. */
  function namaTeks(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function sel(el) {
    if (!el || el.nodeType !== 1) return '';
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && depth < 4) {
      var s = cur.tagName.toLowerCase();
      if (cur.id) { s += '#' + cur.id; parts.unshift(s); break; }
      var cls = (typeof cur.className === 'string')
        ? cur.className.trim().split(/\s+/).filter(function (c) { return c && c.length < 24; }).slice(0, 2)
        : [];
      if (cls.length) s += '.' + cls.join('.');
      var p = cur.parentElement;
      if (p) {
        var same = 0, idx = 0;
        for (var i = 0; i < p.children.length; i++) {
          if (p.children[i].tagName === cur.tagName) { same++; if (p.children[i] === cur) idx = same; }
        }
        if (same > 1) s += ':nth-of-type(' + idx + ')';
      }
      parts.unshift(s);
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  /* Latar efektif: naik ke atas sampai warna solid. Gradien/gambar = tidak pasti. */
  function bgOf(el) {
    var cur = el, acc = null, steps = 0;
    while (cur && cur.nodeType === 1 && steps < 8) {
      var cs = getComputedStyle(cur);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      var c = toRGBA(cs.backgroundColor);
      if (c && c.a > 0.02) {
        if (c.a >= 0.99) return acc ? blend(acc, c) : c;
        acc = acc ? blend(acc, c) : c;
      }
      cur = cur.parentElement;
      steps++;
    }
    var bodyBg = document.body ? toRGBA(getComputedStyle(document.body).backgroundColor) : null;
    if (bodyBg && bodyBg.a >= 0.99) return acc ? blend(acc, bodyBg) : bodyBg;
    return acc ? blend(acc, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
  }

  function trunc(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* Teks bisa duduk di atas lapisan latar yang BUKAN leluhurnya (gambar hero,
   * gradien absolut, overlay). bgOf tidak melihat itu, jadi hasilnya "putih di atas
   * putih" yang palsu. Deteksi: ada kerabat yang menutupi titik tengah teks dan
   * membawa gambar/gradien/warna solid? Kalau ada, kontras dinyatakan tidak pasti. */
  function adaLapisanLatar(el) {
    var er = el.getBoundingClientRect();
    var cx = er.left + er.width / 2;
    var cy = er.top + er.height / 2;
    var node = el;
    for (var lv = 0; lv < 4 && node && node.parentElement; lv++) {
      node = node.parentElement;
      var kids = node.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k === el || k.contains(el)) continue;
        var r = k.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (!(r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy)) continue;
        var ks = getComputedStyle(k);
        if (ks.backgroundImage && ks.backgroundImage !== 'none') return true;
        var kc = toRGBA(ks.backgroundColor);
        if (kc && kc.a > 0.5) return true;
        if (k.querySelector('img, video, canvas, picture')) return true;
      }
    }
    return false;
  }

  var all = Array.prototype.slice.call(document.querySelectorAll('body *'));
  if (all.length > 6000) {
    out.catatan.push('DOM > 6000 elemen; pemeriksaan dibatasi pada 6000 elemen pertama.');
    all = all.slice(0, 6000);
  }

  /* ---------- 1. kontras teks ---------- */
  var lowContrast = [], tidakPasti = 0, textCount = 0;
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var t = ownText(el);
    if (!t || t.length < 2) continue;
    if (!visible(el)) continue;
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') continue;
    var cs = getComputedStyle(el);
    var fs = parseFloat(cs.fontSize) || 16;
    var fw = parseInt(cs.fontWeight, 10) || 400;
    var fg = toRGBA(cs.color);
    if (!fg || fg.a < 0.05) continue;
    var bg = bgOf(el);
    if (!bg) { tidakPasti++; continue; }
    var solid = fg.a < 0.99 ? blend(fg, bg) : fg;
    var r = ratio(solid, bg);
    var large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    var need = large ? 3 : 4.5;
    textCount++;
    if (r < need) {
      if (adaLapisanLatar(el)) { tidakPasti++; continue; }
      lowContrast.push({
        ratio: Math.round(r * 100) / 100, need: need, fontSize: fs,
        color: cs.color, bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
        text: trunc(t, 60), sel: sel(el)
      });
    }
  }
  lowContrast.sort(function (a, b) { return a.ratio - b.ratio; });
  /* Badge yang sama muncul 9 kali bukan 9 masalah: kelompokkan per teks+warna,
   * simpan jumlah kemunculannya. */
  var lowUnik = [], seenKontras = {};
  lowContrast.forEach(function (x) {
    var key = x.text + '|' + x.ratio + '|' + x.color + '|' + x.bg + '|' + x.fontSize;
    if (seenKontras[key]) { seenKontras[key].jumlah++; return; }
    x.jumlah = 1;
    seenKontras[key] = x;
    lowUnik.push(x);
  });

  /* ---------- 2. target sentuh ---------- */
  var tapSel = 'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, summary';
  var taps = Array.prototype.slice.call(document.querySelectorAll(tapSel));
  var smallTaps = [], tautanInline = 0;
  for (var j = 0; j < taps.length; j++) {
    var te = taps[j];
    if (!visible(te)) continue;
    var tcs = getComputedStyle(te);
    /* Pengecualian WCAG 2.2: tautan teks yang mengalir di dalam kalimat. */
    var inline = te.tagName === 'A' && tcs.display === 'inline' &&
      parseFloat(tcs.paddingTop) < 2 && parseFloat(tcs.paddingBottom) < 2 &&
      (tcs.backgroundColor === 'rgba(0, 0, 0, 0)' || tcs.backgroundColor === 'transparent');
    if (inline) { tautanInline++; continue; }
    var tr = te.getBoundingClientRect();
    if (tr.width < targetMin || tr.height < targetMin) {
      smallTaps.push({
        w: Math.round(tr.width), h: Math.round(tr.height),
        text: trunc(namaTeks(te) || te.getAttribute('aria-label') || te.getAttribute('value') || te.tagName, 40),
        sel: sel(te)
      });
    }
  }
  smallTaps.sort(function (a, b) { return (a.w * a.h) - (b.w * b.h); });

  /* ---------- 3. nama aksesibel ---------- */
  var noName = [];
  var named = Array.prototype.slice.call(document.querySelectorAll('a[href], button, [role="button"]'));
  for (var k = 0; k < named.length; k++) {
    var ne = named[k];
    if (!visible(ne)) continue;
    var nm = (ne.getAttribute('aria-label') || '').trim();
    if (!nm && ne.getAttribute('aria-labelledby')) {
      var lb = document.getElementById(ne.getAttribute('aria-labelledby'));
      if (lb) nm = namaTeks(lb);
    }
    if (!nm) nm = (ne.getAttribute('title') || '').trim();
    if (!nm) nm = namaTeks(ne);
    if (!nm) {
      var im = ne.querySelector('img[alt]');
      if (im) nm = (im.getAttribute('alt') || '').trim();
    }
    if (!nm) noName.push({ tag: ne.tagName.toLowerCase(), sel: sel(ne), html: trunc(ne.outerHTML, 120) });
  }

  /* ---------- 4. kolom form ---------- */
  var fields = Array.prototype.slice.call(document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
  ));
  var noLabel = [], placeholderOnly = [];
  for (var f = 0; f < fields.length; f++) {
    var fe = fields[f];
    if (!visible(fe)) continue;
    var hasLabel = false;
    if (fe.id) {
      var l = document.querySelector('label[for="' + fe.id.replace(/"/g, '\\"') + '"]');
      if (l && namaTeks(l)) hasLabel = true;
    }
    if (!hasLabel && fe.closest('label') && namaTeks(fe.closest('label'))) hasLabel = true;
    if (!hasLabel && (fe.getAttribute('aria-label') || '').trim()) hasLabel = true;
    if (!hasLabel && fe.getAttribute('aria-labelledby')) hasLabel = true;
    if (!hasLabel) {
      var ph = (fe.getAttribute('placeholder') || '').trim();
      var item = { type: fe.getAttribute('type') || fe.tagName.toLowerCase(), name: fe.getAttribute('name') || '', placeholder: ph, sel: sel(fe) };
      if (ph) placeholderOnly.push(item); else noLabel.push(item);
    }
  }

  /* ---------- 5. gambar ---------- */
  var imgs = Array.prototype.slice.call(document.images);
  var broken = [], noAlt = [], belumDimuat = 0;
  for (var m = 0; m < imgs.length; m++) {
    var img = imgs[m];
    if (!visible(img)) continue;
    if (!img.complete) { belumDimuat++; continue; }
    if (img.naturalWidth === 0) broken.push({ src: trunc(img.currentSrc || img.src, 100), sel: sel(img) });
    if (img.getAttribute('alt') === null) noAlt.push({ src: trunc(img.currentSrc || img.src, 80), sel: sel(img) });
  }

  /* ---------- 6. heading & landmark ---------- */
  var hs = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible);
  var levels = hs.map(function (h) { return parseInt(h.tagName[1], 10); });
  var jumps = [];
  for (var q = 1; q < levels.length; q++) {
    if (levels[q] - levels[q - 1] > 1) jumps.push({ dari: 'h' + levels[q - 1], ke: 'h' + levels[q], sel: sel(hs[q]) });
  }
  var h1Count = levels.filter(function (x) { return x === 1; }).length;

  /* ---------- 7. teks terpotong, font kecil, id ganda ---------- */
  var clipped = [], tiny = [];
  for (var c = 0; c < all.length; c++) {
    var ce = all[c];
    var ct = ownText(ce);
    if (!ct || ct.length < 3 || !visible(ce)) continue;
    var ccs = getComputedStyle(ce);
    var cfs = parseFloat(ccs.fontSize) || 16;
    if (cfs < 12) tiny.push({ px: cfs, text: trunc(ct, 40), sel: sel(ce) });
    if (ccs.overflowX === 'hidden' && ce.scrollWidth > ce.clientWidth + 2 && ccs.textOverflow !== 'ellipsis') {
      clipped.push({ teks: trunc(ct, 50), scrollW: ce.scrollWidth, clientW: ce.clientWidth, sel: sel(ce) });
    }
  }

  var ids = {}, dupIds = [];
  var idEls = document.querySelectorAll('[id]');
  for (var d = 0; d < idEls.length; d++) {
    var idv = idEls[d].id;
    if (!idv) continue;
    if (ids[idv]) { if (dupIds.indexOf(idv) === -1) dupIds.push(idv); } else ids[idv] = 1;
  }

  /* ---------- 8. font ---------- */
  var fams = [];
  [document.body, document.querySelector('h1'), document.querySelector('button')].forEach(function (e) {
    if (!e) return;
    var first = (getComputedStyle(e).fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
    if (first && fams.indexOf(first) === -1) fams.push(first);
  });
  /* Yang bisa dipercaya hanya status FontFace: 'error' berarti berkas font gagal
   * dimuat (CSP, 404, CORS). document.fonts.check() sering false untuk font sistem. */
  var fontGagal = [], fontTotal = 0;
  try {
    document.fonts.forEach(function (face) {
      fontTotal++;
      if (face.status === 'error') fontGagal.push(face.family + ' ' + (face.weight || '') + ' ' + (face.style || ''));
    });
  } catch (e) { /* FontFaceSet tidak tersedia */ }
  var fontStatus = fams.map(function (fam) {
    var ok = true;
    try { ok = document.fonts ? document.fonts.check('16px "' + fam + '"') : true; } catch (e) { ok = true; }
    return { family: fam, loaded: ok };
  });

  /* ---------- 9. isi halaman ---------- */
  var bodyText = document.body ? (document.body.textContent || '') : '';
  var placeholders = (bodyText.match(/lorem ipsum|TODO|FIXME|dummy text/gi) || []).length;
  var landmarks = document.querySelectorAll('main, [role="main"], nav, header, footer, [role="navigation"]').length;
  var isiHalaman = bodyText.replace(/\s+/g, ' ').trim().length;

  out.meta = {
    url: location.href,
    title: document.title,
    lang: de.getAttribute('lang') || '',
    viewport: vw + 'x' + window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    docHeight: Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0),
    horizontalOverflow: de.scrollWidth > de.clientWidth + 1,
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    panjangTeks: isiHalaman,
    landmark: landmarks
  };

  out.counts = {
    elemenDiperiksa: all.length,
    teksDiperiksa: textCount,
    kontrasRendah: lowContrast.length,
    kontrasRendahUnik: lowUnik.length,
    kontrasTidakBisaDipastikan: tidakPasti,
    targetKecil: smallTaps.length,
    targetDiperiksa: taps.length,
    tautanTeksInline: tautanInline,
    tanpaNamaAksesibel: noName.length,
    kolomTanpaLabel: noLabel.length,
    kolomHanyaPlaceholder: placeholderOnly.length,
    gambar: imgs.length,
    gambarRusak: broken.length,
    gambarBelumDimuat: belumDimuat,
    gambarTanpaAlt: noAlt.length,
    heading: levels.length,
    h1: h1Count,
    lompatanHeading: jumps.length,
    teksTerpotong: clipped.length,
    fontKecil: tiny.length,
    fontGagalMuat: fontGagal.length,
    fontFaceDiperiksa: fontTotal,
    idGanda: dupIds.length,
    copyPlaceholder: placeholders
  };

  out.worst = {
    kontras: lowUnik.slice(0, maxList),
    target: smallTaps.slice(0, maxList),
    tanpaNama: noName.slice(0, maxList),
    kolomTanpaLabel: noLabel.slice(0, maxList),
    kolomHanyaPlaceholder: placeholderOnly.slice(0, maxList),
    gambarRusak: broken.slice(0, maxList),
    gambarTanpaAlt: noAlt.slice(0, maxList),
    teksTerpotong: clipped.slice(0, maxList),
    fontKecil: tiny.slice(0, maxList),
    idGanda: dupIds.slice(0, maxList),
    lompatanHeading: jumps.slice(0, maxList)
  };
  out.fonts = { dipakai: fams, status: fontStatus, gagal: fontGagal, totalFace: fontTotal };

  /* ---------- skor + rincian potongan ---------- */
  function potong(alasan, n) {
    n = Math.round(n * 10) / 10;
    if (n <= 0) return;
    out.deductions.push({ alasan: alasan, potongan: n });
  }
  if (out.meta.horizontalOverflow) potong('overflow horizontal', 15);
  potong('kontras teks di bawah ambang', Math.min(15, lowUnik.length * 2));
  potong('target sentuh terlalu kecil', Math.min(10, smallTaps.length * 1.5));
  potong('tombol/tautan tanpa nama aksesibel', Math.min(8, noName.length * 1.5));
  potong('kolom tanpa label', Math.min(8, (noLabel.length + placeholderOnly.length * 0.5) * 2));
  potong('gambar rusak', Math.min(8, broken.length * 2));
  potong('gambar tanpa alt', Math.min(4, noAlt.length * 0.5));
  if (h1Count === 0) potong('tidak ada h1', 3);
  if (h1Count > 1) potong('h1 lebih dari satu', 3);
  potong('lompatan urutan heading', Math.min(4, jumps.length * 1.5));
  potong('teks di bawah 12px', Math.min(4, tiny.length * 0.15));
  potong('teks terpotong tanpa ellipsis', Math.min(6, clipped.length * 2));
  potong('id ganda', Math.min(3, dupIds.length));
  potong('copy placeholder', Math.min(3, placeholders * 1.5));
  potong('font gagal dimuat', Math.min(5, fontGagal.length * 5));
  if (isiHalaman < 40) potong('halaman hampir kosong', 20);

  var total = out.deductions.reduce(function (a, b) { return a + b.potongan; }, 0);
  out.score = Math.max(0, Math.min(100, Math.round(100 - total)));
  out.grade = out.score >= 90 ? 'A' : out.score >= 80 ? 'B' : out.score >= 70 ? 'C' : out.score >= 55 ? 'D' : 'E';
  out.catatan.push('Skor hanya sinyal otomatis (100 dikurangi rincian potongan). Vonis UX tetap dari mata pada 390/768/1440.');
  return out;
}
