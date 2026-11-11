'use strict';
(() => {
  if (Api.hasToken()) { location.replace('dashboard.html'); return; }
  const form = document.getElementById('loginForm');
  const msg = document.getElementById('loginMsg');
  const btn = document.getElementById('btnLogin');

  if (!CONFIG.API_URL || CONFIG.API_URL.indexOf('GANTI') === 0) {
    msg.textContent = 'Alamat server belum diatur. Isi API_URL di js/config.js.';
    btn.disabled = true;
    return;
  }

  async function login(id, kode) {
    msg.textContent = '';
    if (!/^\d{5,15}$/.test(id)) { msg.textContent = 'ID Telegram hanya berisi angka.'; return; }
    if (!/^\d{6}$/.test(kode)) { msg.textContent = 'Kode harus 6 digit angka.'; return; }
    btn.disabled = true;
    try {
      const d = await Api.call('login', { id, kode }, { noRedirect: true });
      Api.save(d.token, d.user);
      location.replace('dashboard.html');
    } catch (err) {
      msg.textContent = err.message + (err.code === 'SERVER' ? ' Minta kode baru dengan mengirim LOGIN ke bot.' : '');
      btn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    login(form.tgid.value.trim(), form.kode.value.trim());
  });

  // Masuk satu ketukan: tautan dari bot berbentuk login.html#id=...&kode=...
  // Bagian setelah # tidak pernah dikirim ke server; langsung dihapus dari alamat setelah dibaca.
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('id') && h.get('kode')) {
    history.replaceState(null, '', location.pathname + location.search);
    form.tgid.value = h.get('id');
    form.kode.value = h.get('kode');
    login(h.get('id').trim(), h.get('kode').trim());
  }
})();
