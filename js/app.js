'use strict';
/* Fungsi bersama: format, escape HTML, toast, indikator memuat. */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const Fmt = {
  rupiah(n) {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? '-' : '') + 'Rp' + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  compact(n) {
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    const t = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
    if (a >= 1e9) return s + t(a / 1e9) + ' M';
    if (a >= 1e6) return s + t(a / 1e6) + ' jt';
    if (a >= 1e3) return s + t(a / 1e3) + ' rb';
    return s + a;
  },
  tanggal(s) {
    const p = String(s).split('-');
    return p.length === 3 ? `${+p[2]} ${BULAN[+p[1] - 1]} ${p[0]}` : String(s);
  },
  tanggalPendek(s) {
    const p = String(s).split('-');
    return p.length === 3 ? `${+p[2]} ${BULAN[+p[1] - 1]}` : String(s);
  }
};

/** Hindari XSS: semua teks dari server yang masuk innerHTML harus lewat sini. */
function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tanggal hari ini (yyyy-MM-dd) menurut zona waktu Asia/Jakarta. */
function todayJakarta() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

function toast(message, type) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

const Loading = {
  n: 0,
  start() { this.n++; const b = document.getElementById('loadbar'); if (b) b.hidden = false; document.body.setAttribute('aria-busy', 'true'); },
  stop() {
    this.n = Math.max(0, this.n - 1);
    if (!this.n) { const b = document.getElementById('loadbar'); if (b) b.hidden = true; document.body.removeAttribute('aria-busy'); }
  }
};
