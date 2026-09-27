(function () {
'use strict';

/* ── Formats & Helpers ── */
var FMT_ALIAS = { jpg: 'jpeg', tif: 'tiff' };
var MIME_MAP  = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp' };

function normFmt(r) { var l = (r || '').toLowerCase().replace(/^\./, ''); return FMT_ALIAS[l] || l; }
function isHeic(n) { return /\.(heic|heif)$/i.test(n || ''); }
function getExt(n) { return (n || '').split('.').pop().toLowerCase() || '?'; }
function outName(orig, fmt) { return orig.replace(/\.[^.]+$/, '') + '_converted.' + (fmt === 'jpeg' ? 'jpg' : fmt); }
function uid() { return Date.now() + '-' + Math.random().toString(36).slice(2); }
function fmtBytes(b, d) {
  d = d === undefined ? 1 : d;
  if (!b || b === 0) return '0 B';
  var k = 1024, s = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(Math.abs(b)) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(d)) + ' ' + s[i];
}

/* ── 24-bit BMP Encoder ── */
function encodeBMP(ctx, w, h) {
  var rp = (4 - ((w * 3) % 4)) % 4, rs = w * 3 + rp, fs = 54 + rs * h;
  var buf = new ArrayBuffer(fs), dv = new DataView(buf);
  dv.setUint8(0, 0x42); dv.setUint8(1, 0x4d);
  dv.setUint32(2, fs, true); dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, -h, true);
  dv.setUint16(26, 1, true); dv.setUint16(28, 24, true);
  dv.setUint32(34, rs * h, true); dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true);
  var px = ctx.getImageData(0, 0, w, h).data;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var s = (y * w + x) * 4, dd = 54 + y * rs + x * 3;
      dv.setUint8(dd, px[s + 2]); dv.setUint8(dd + 1, px[s + 1]); dv.setUint8(dd + 2, px[s]);
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

/* ── File to ImageBitmap ── */
function fileToBitmap(file) {
  return new Promise(function (resolve, reject) {
    if (isHeic(file.name)) {
      if (typeof heic2any === 'undefined') {
        reject(new Error('heic2any library not loaded'));
        return;
      }
      heic2any({ blob: file, toType: 'image/png', quality: 1 }).then(function (c) {
        if (Array.isArray(c)) c = c[0];
        createImageBitmap(c).then(resolve).catch(reject);
      }).catch(reject);
      return;
    }
    createImageBitmap(file).then(resolve).catch(function () {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); createImageBitmap(img).then(resolve).catch(reject); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Cannot decode image')); };
      img.src = url;
    });
  });
}

/* ── Image Conversion Core ── */
function processImage(file, format, quality) {
  var fmt = normFmt(format);
  var q = Math.max(0.01, Math.min(1, Number(quality) / 100));

  return fileToBitmap(file).then(function (src) {
    var w = src.width, h = src.height;
    if (!w || !h) throw new Error('Zero dimensions');

    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');

    if (fmt === 'jpeg' || fmt === 'bmp') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(src, 0, 0, w, h);
    if (src.close) src.close();

    return new Promise(function (resolve, reject) {
      if (fmt === 'bmp') {
        resolve({ blob: encodeBMP(ctx, w, h), width: w, height: h });
        return;
      }
      var mime = MIME_MAP[fmt] || 'image/png';
      cv.toBlob(function (b) {
        if (b && b.size > 0) {
          resolve({ blob: b, width: w, height: h });
        } else {
          cv.toBlob(function (pb) {
            pb ? resolve({ blob: pb, width: w, height: h }) : reject(new Error('Export failed'));
          }, 'image/png');
        }
      }, mime, q);
    });
  });
}

/* ── Thumbnail Generator ── */
function makePreview(file) {
  return new Promise(function (resolve) {
    fileToBitmap(file).then(function (bmp) {
      var sc = Math.min(1, 100 / bmp.width, 100 / bmp.height);
      var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      c.toBlob(function (b) { resolve(b ? URL.createObjectURL(b) : null); }, 'image/jpeg', 0.8);
    }).catch(function () { resolve(null); });
  });
}

/* ── State ── */
var files = [];
var isConverting = false;
var targetFormat = 'jpeg';
var targetQuality = 90;

/* ── DOM Elements ── */
var dz = document.getElementById('dz');
var fi = document.getElementById('file-input');
var selFmt = document.getElementById('sel-fmt');
var rngQ = document.getElementById('rng-q');
var qDisp = document.getElementById('q-disp');
var qBox = document.getElementById('q-box');
var btnConv = document.getElementById('btn-conv');
var btnDlAll = document.getElementById('btn-dl-all');
var btnClrAll = document.getElementById('btn-clr-all');
var queueEl = document.getElementById('queue');
var statCount = document.getElementById('stat-count');
var statSaved = document.getElementById('stat-saved');
var btnExpandTab = document.getElementById('btn-expand-tab');

/* ── Render ── */
function render() {
  var total = files.length;
  var done = files.filter(function (f) { return f.status === 'done'; }).length;
  var pending = files.filter(function (f) { return f.status === 'idle' || f.status === 'error'; }).length;
  var saved = files.reduce(function (a, f) { return a + (f.result ? f.result.savedBytes : 0); }, 0);

  statCount.textContent = total + ' file' + (total !== 1 ? 's' : '');
  if (saved > 0) {
    statSaved.textContent = '· Saved ' + fmtBytes(saved);
  } else {
    statSaved.textContent = '';
  }

  btnDlAll.style.display = done > 0 ? '' : 'none';
  btnClrAll.style.display = total > 0 ? '' : 'none';

  btnConv.disabled = pending === 0 || isConverting;
  btnConv.innerHTML = isConverting
    ? '<span class="spin">⟳</span> Converting...'
    : '✦ Convert ' + (pending > 0 ? pending + ' ' : '') + 'Image' + (pending !== 1 ? 's' : '');

  // Render Queue Cards
  queueEl.innerHTML = '';
  files.forEach(function (entry) {
    var card = document.createElement('div');
    card.className = 'q-card ' + entry.status;
    card.id = 'qc-' + entry.id;

    var thumbContent = entry.preview
      ? '<img src="' + entry.preview + '" alt="">'
      : '<span class="q-thumb-ph">🖼️</span>';

    var stLabels = {
      idle: ['st-idle', 'Ready'],
      converting: ['st-conv', 'Converting...'],
      done: ['st-done', 'Done'],
      error: ['st-err', 'Failed']
    };
    var st = stLabels[entry.status] || stLabels.idle;

    var sizeInfo = fmtBytes(entry.file.size);
    if (entry.status === 'done' && entry.result) {
      sizeInfo += ' → ' + fmtBytes(entry.result.convertedSize);
      if (entry.result.savingsPercent > 0) {
        sizeInfo += ' (-' + entry.result.savingsPercent + '%)';
      }
    }

    var actionsHtml = '';
    if (entry.status === 'done' && entry.result) {
      actionsHtml += '<button class="q-btn dl" data-dl="' + entry.id + '" title="Download">⬇</button>';
    }
    if (entry.status !== 'converting') {
      actionsHtml += '<button class="q-btn rm" data-rm="' + entry.id + '" title="Remove">✕</button>';
    }

    card.innerHTML =
      '<div class="q-thumb">' + thumbContent + '</div>' +
      '<div class="q-info">' +
        '<div class="q-name" title="' + entry.file.name + '">' + entry.file.name + '</div>' +
        '<div class="q-meta">' +
          '<span class="q-st ' + st[0] + '">' + st[1] + '</span>' +
          '<span>' + sizeInfo + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="q-actions">' + actionsHtml + '</div>';

    queueEl.appendChild(card);
  });
}

/* ── File Operations ── */
function addFiles(newFiles) {
  var allowed = newFiles.filter(function (f) {
    return /\.(heic|heif|jpg|jpeg|png|webp|avif|gif|bmp)$/i.test(f.name);
  });
  if (!allowed.length) return;

  var entries = allowed.map(function (f) {
    return {
      id: uid(),
      file: f,
      preview: null,
      status: 'idle',
      result: null,
      error: null
    };
  });

  files = files.concat(entries);
  render();

  entries.forEach(function (e) {
    makePreview(e.file).then(function (thumbUrl) {
      var target = files.find(function (x) { return x.id === e.id; });
      if (target && thumbUrl) {
        target.preview = thumbUrl;
        render();
      }
    });
  });
}

function removeFile(id) {
  var target = files.find(function (x) { return x.id === id; });
  if (target) {
    if (target.preview) URL.revokeObjectURL(target.preview);
    if (target.result && target.result.url) URL.revokeObjectURL(target.result.url);
  }
  files = files.filter(function (x) { return x.id !== id; });
  render();
}

function clearAll() {
  files.forEach(function (f) {
    if (f.preview) URL.revokeObjectURL(f.preview);
    if (f.result && f.result.url) URL.revokeObjectURL(f.result.url);
  });
  files = [];
  render();
}

function downloadOne(id) {
  var target = files.find(function (x) { return x.id === id; });
  if (!target || !target.result || !target.result.url) return;
  var a = document.createElement('a');
  a.href = target.result.url;
  a.download = target.result.downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadAll() {
  var done = files.filter(function (f) { return f.status === 'done' && f.result && f.result.blob; });
  if (!done.length) return;

  if (typeof JSZip === 'undefined') {
    alert('JSZip not available');
    return;
  }

  var zip = new JSZip();
  done.forEach(function (f, i) {
    zip.file(f.result.downloadName || ('image_' + (i + 1)), f.result.blob);
  });

  zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }).then(function (blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'converted_images.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

/* ── Conversion Execution ── */
function startConvert() {
  var toConv = files.filter(function (f) { return f.status === 'idle' || f.status === 'error'; });
  if (!toConv.length || isConverting) return;

  isConverting = true;
  toConv.forEach(function (f) { f.status = 'converting'; f.error = null; });
  render();

  var idx = 0;
  function processNext() {
    if (idx >= toConv.length) {
      isConverting = false;
      render();
      return;
    }
    var entry = toConv[idx++];
    processImage(entry.file, targetFormat, targetQuality).then(function (res) {
      var url = URL.createObjectURL(res.blob);
      if (entry.result && entry.result.url) URL.revokeObjectURL(entry.result.url);
      entry.status = 'done';
      entry.result = {
        url: url,
        blob: res.blob,
        downloadName: outName(entry.file.name, targetFormat),
        format: targetFormat,
        width: res.width,
        height: res.height,
        convertedSize: res.blob.size,
        savedBytes: entry.file.size - res.blob.size,
        savingsPercent: entry.file.size > 0 ? Math.round(((entry.file.size - res.blob.size) / entry.file.size) * 100) : 0
      };
      render();
      processNext();
    }).catch(function (err) {
      entry.status = 'error';
      entry.error = err && err.message ? err.message : 'Error';
      render();
      processNext();
    });
  }
  processNext();
}

/* ── Events ── */
dz.addEventListener('click', function () { fi.click(); });
dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', function (e) {
  if (!e.relatedTarget || !e.relatedTarget.closest('#dz')) dz.classList.remove('over');
});
dz.addEventListener('drop', function (e) {
  e.preventDefault();
  dz.classList.remove('over');
  addFiles(Array.from(e.dataTransfer.files));
});

fi.addEventListener('change', function (e) {
  addFiles(Array.from(e.target.files));
  this.value = '';
});

selFmt.addEventListener('change', function () {
  targetFormat = this.value;
  qBox.style.display = ['jpeg', 'webp', 'avif'].indexOf(targetFormat) !== -1 ? '' : 'none';
});

rngQ.addEventListener('input', function () {
  targetQuality = Number(this.value);
  qDisp.textContent = this.value + '%';
});

btnConv.addEventListener('click', startConvert);
btnDlAll.addEventListener('click', downloadAll);
btnClrAll.addEventListener('click', clearAll);

queueEl.addEventListener('click', function (e) {
  var rm = e.target.closest('[data-rm]');
  if (rm) { removeFile(rm.dataset.rm); return; }
  var dl = e.target.closest('[data-dl]');
  if (dl) { downloadOne(dl.dataset.dl); return; }
});

function openStudioTab(tab) {
  var url = 'index.html' + (tab ? '?tab=' + tab : '');
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  } else {
    window.open(url, '_blank');
  }
}

btnExpandTab.addEventListener('click', function () { openStudioTab(''); });
document.getElementById('pop-tab-conv').addEventListener('click', function () { openStudioTab('converter'); });
document.getElementById('pop-tab-pdf').addEventListener('click', function () { openStudioTab('pdf'); });
document.getElementById('pop-tab-vid').addEventListener('click', function () { openStudioTab('video'); });
var popTabComp = document.getElementById('pop-tab-comp');
if (popTabComp) {
  popTabComp.addEventListener('click', function () { openStudioTab('compress'); });
}

render();

})();
