'use strict';
/* Klien API. Semua permintaan: POST JSON {action, token, params}.
   Body dikirim sebagai teks biasa (tanpa header khusus) agar browser tidak melakukan preflight CORS ke Apps Script. */
class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code || ''; }
}

const Api = (() => {
  const KEY = 'fw_token';
  const NAME = 'fw_user';

  const hasToken = () => !!sessionStorage.getItem(KEY);
  const save = (token, user) => { sessionStorage.setItem(KEY, token); sessionStorage.setItem(NAME, JSON.stringify(user || {})); };
  const clear = () => { sessionStorage.removeItem(KEY); sessionStorage.removeItem(NAME); };

  async function call(action, params = {}, opts = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.indexOf('GANTI') === 0) {
      throw new ApiError('Alamat server belum diatur. Isi API_URL di js/config.js.', 'CONFIG');
    }
    if (typeof Loading !== 'undefined' && !opts.quiet) Loading.start();
    try {
      let res;
      try {
        res = await fetch(CONFIG.API_URL, {
          method: 'POST',
          body: JSON.stringify({ action, token: sessionStorage.getItem(KEY) || '', params }),
          redirect: 'follow'
        });
      } catch (e) {
        throw new ApiError('Tidak bisa terhubung ke server. Periksa koneksi internet, lalu coba lagi.', 'NETWORK');
      }
      let json;
      try { json = await res.json(); }
      catch (e) { throw new ApiError('Respons server tidak bisa dibaca. Periksa pengaturan deployment Web App.', 'PARSE'); }
      if (!json.ok) {
        if (json.error === 'AUTH_REQUIRED') {
          clear();
          if (!opts.noRedirect) location.replace('login.html');
          throw new ApiError('Sesi berakhir. Silakan masuk lagi.', 'AUTH_REQUIRED');
        }
        throw new ApiError(json.error || 'Terjadi kesalahan.', 'SERVER');
      }
      return json.data;
    } finally {
      if (typeof Loading !== 'undefined' && !opts.quiet) Loading.stop();
    }
  }

  return { call, hasToken, save, clear };
})();
