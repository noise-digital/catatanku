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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const nomor = form.nomor.value.trim();
    const kode = form.kode.value.trim();
    if (!/^\d{8,15}$/.test(nomor.replace(/[\s+\-]/g, ''))) { msg.textContent = 'Nomor tidak valid. Contoh: 628123456789.'; return; }
    if (!/^\d{6}$/.test(kode)) { msg.textContent = 'Kode harus 6 digit angka.'; return; }
    btn.disabled = true;
    try {
      const d = await Api.call('login', { nomor, kode }, { noRedirect: true });
      Api.save(d.token, d.user);
      location.replace('dashboard.html');
    } catch (err) {
      msg.textContent = err.message + (err.code === 'SERVER' ? ' Minta kode baru dengan mengirim LOGIN ke bot.' : '');
      btn.disabled = false;
    }
  });
})();
