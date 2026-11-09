# Catatan Keuangan — Dashboard

Dashboard web statis (HTML, CSS, JavaScript, Chart.js) untuk aplikasi pencatatan keuangan WhatsApp.
Semua data dan logika ada di backend Google Apps Script; repositori ini **hanya tampilan**.

## Isi
```
index.html        pengarah ke login/dashboard
login.html        masuk dengan kode dari WhatsApp
dashboard.html    ringkasan, grafik, tabel transaksi
css/style.css
js/config.js      <- SATU-SATUNYA berkas yang perlu Anda ubah (alamat Web App)
js/api.js  js/app.js  js/login.js  js/dashboard.js
```

## Pasang
1. Buka `js/config.js`, ganti `GANTI_DENGAN_URL_WEB_APP` dengan alamat Web App Apps Script
   (berakhiran `/exec`). Alamat ini **bukan rahasia**.
2. Settings > Pages > Source: *Deploy from a branch* > Branch `main` / folder `/ (root)` > Save.
3. Buka alamat `https://USERNAME.github.io/NAMA-REPO/`.

## Keamanan
- **Jangan pernah** menaruh token WhatsApp, password, atau ID spreadsheet di repositori ini.
- Keamanan ada di login (kode sekali pakai lewat WhatsApp) dan token sesi, bukan di alamat Web App.
- Token sesi disimpan di `sessionStorage` dan hilang saat tab ditutup.
- Repositori GitHub Pages gratis bersifat publik: kode terlihat, data keuangan tidak.

Panduan lengkap (deployment, Meta, pengujian) ada di berkas `PANDUAN-DEPLOYMENT.md` dalam paket.
