'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const COLORS = { masuk: '#137A4B', keluar: '#C23B32', garis: '#DDE1DB', abu: '#5E6A63' };
  const KAT = ['#1B2420', '#3E6A8A', '#C69B3A', '#7A4E7E', '#2E8B8B', '#8A8F3C', '#A35D6A', '#7C8A95'];
  const today = todayJakarta();
  const state = {
    from: '', to: '', page: 1, pageSize: 20, q: '', jenis: '', kategori: '',
    user: null, cats: { pengeluaran: [], pemasukan: [] }, rows: [], total: 0, editing: null, deleting: null
  };
  const charts = {};

  /* ---------- Periode ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = (y, m) => new Date(y, m, 0).getDate();

  function computePeriod() {
    const mode = $('#mode').value;
    if (mode === 'bulan') {
      const v = $('#inMonth').value;
      if (!/^\d{4}-\d{2}$/.test(v)) return null;
      const [y, m] = v.split('-').map(Number);
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
    }
    if (mode === 'tahun') {
      const y = Number($('#inYear').value);
      if (!(y >= 2000 && y <= 2100)) return null;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    const f = $('#inFrom').value, t = $('#inTo').value;
    if (!f || !t || f > t) return null;
    return { from: f, to: t };
  }

  function updateModeFields() {
    const mode = $('#mode').value;
    $('#gBulan').hidden = mode !== 'bulan';
    $('#gTahun').hidden = mode !== 'tahun';
    $('#gDari').hidden = mode !== 'rentang';
    $('#gSampai').hidden = mode !== 'rentang';
  }

  function applyPeriod() {
    const p = computePeriod();
    if (!p) { toast('Periode tidak valid. Periksa tanggal yang dipilih.', 'error'); return; }
    state.from = p.from; state.to = p.to; state.page = 1;
    $('#printPeriod').textContent = `Laporan keuangan ${Fmt.tanggal(p.from)} sampai ${Fmt.tanggal(p.to)}`;
    refreshAll();
  }

  /* ---------- Muat data ---------- */
  async function refreshAll() {
    try {
      await Promise.all([loadSummary(), loadTransactions()]);
    } catch (e) {
      if (e.code !== 'AUTH_REQUIRED') toast(e.message, 'error');
    }
  }

  async function loadSummary() {
    const d = await Api.call('summary', { from: state.from, to: state.to });
    renderLedger(d);
    renderCharts(d);
  }

  function renderLedger(d) {
    const r = d.ringkasan;
    $('#kSaldo').textContent = 'Saldo berjalan sampai ' + Fmt.tanggal(state.to);
    const saldo = $('#vSaldo');
    saldo.textContent = Fmt.rupiah(d.saldo_berjalan);
    saldo.className = 'v' + (d.saldo_berjalan < 0 ? ' neg' : '');
    $('#vMasuk').textContent = Fmt.rupiah(r.total_pemasukan);
    $('#vKeluar').textContent = Fmt.rupiah(r.total_pengeluaran);
    const sel = $('#vSelisih');
    sel.textContent = (r.arus_bersih > 0 ? '+' : '') + Fmt.rupiah(r.arus_bersih);
    sel.className = 'v' + (r.arus_bersih > 0 ? ' pos' : r.arus_bersih < 0 ? ' neg' : '');
    $('#vJumlah').textContent = String(r.jumlah_transaksi);
    $('#vKategori').textContent = r.kategori_terbesar ? `${r.kategori_terbesar.nama} (${Fmt.rupiah(r.kategori_terbesar.total)})` : 'Belum ada';

    const total = r.total_pemasukan + r.total_pengeluaran;
    const inPct = total ? (r.total_pemasukan / total) * 100 : 0;
    $('#flowIn').style.width = inPct + '%';
    $('#flowOut').style.width = (total ? 100 - inPct : 0) + '%';
    $('#flowInTxt').textContent = total ? `Pemasukan ${Math.round(inPct)}%` : 'Belum ada transaksi';
    $('#flowOutTxt').textContent = total ? `Pengeluaran ${Math.round(100 - inPct)}%` : '';
  }

  /* ---------- Grafik ---------- */
  const tip = () => ({ callbacks: { label: (c) => ' ' + Fmt.rupiah(c.raw) } });
  const valueAxis = () => ({ beginAtZero: true, ticks: { callback: (v) => Fmt.compact(v) }, grid: { color: COLORS.garis } });
  const catAxis = () => ({ grid: { display: false } });

  function draw(id, cfg, hasData) {
    const canvas = $('#' + id);
    const panel = canvas.closest('.panel');
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    $('.chartbox', panel).hidden = !hasData;
    $('.empty', panel).hidden = hasData;
    if (hasData) charts[id] = new Chart(canvas, cfg);
  }

  function renderCharts(d) {
    if (typeof Chart === 'undefined') { toast('Library grafik gagal dimuat. Muat ulang halaman.', 'error'); return; }
    Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
    Chart.defaults.color = COLORS.abu;
    const r = d.ringkasan;

    // 1. Pemasukan vs pengeluaran
    draw('cFlow', {
      type: 'bar',
      data: { labels: ['Pemasukan', 'Pengeluaran'], datasets: [{ data: [r.total_pemasukan, r.total_pengeluaran], backgroundColor: [COLORS.masuk, COLORS.keluar], maxBarThickness: 72 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip() }, scales: { y: valueAxis(), x: catAxis() } }
    }, r.total_pemasukan + r.total_pengeluaran > 0);

    // 2. Pengeluaran per kategori (maks 8 teratas)
    const top = r.per_kategori.slice(0, 8);
    draw('cKategori', {
      type: 'bar',
      data: { labels: top.map((k) => k.nama), datasets: [{ data: top.map((k) => k.total), backgroundColor: COLORS.keluar, maxBarThickness: 22 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip() }, scales: { x: valueAxis(), y: catAxis() } }
    }, top.length > 0);

    // 3. Tren harian pengeluaran
    const hari = r.harian || [];
    draw('cHarian', {
      type: 'line',
      data: { labels: hari.map((h) => Fmt.tanggalPendek(h.tanggal)), datasets: [{ data: hari.map((h) => h.pengeluaran), borderColor: COLORS.keluar, backgroundColor: 'rgba(194,59,50,0.12)', fill: true, tension: 0.25, pointRadius: hari.length > 40 ? 0 : 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip() }, scales: { y: valueAxis(), x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } }
    }, hari.some((h) => h.pengeluaran > 0));

    // 4. Persentase kategori (7 teratas + Lainnya)
    const cats = r.per_kategori.slice();
    const head = cats.slice(0, 7);
    const rest = cats.slice(7).reduce((a, k) => a + k.total, 0);
    if (rest > 0) head.push({ nama: 'Lainnya', total: rest });
    const sum = head.reduce((a, k) => a + k.total, 0);
    draw('cPersen', {
      type: 'doughnut',
      data: { labels: head.map((k) => k.nama), datasets: [{ data: head.map((k) => k.total), backgroundColor: KAT, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${Fmt.rupiah(c.raw)} (${sum ? Math.round((c.raw / sum) * 1000) / 10 : 0}%)` } }
        }
      }
    }, head.length > 0);

    // 5. Perbandingan bulanan (tahun dari tanggal akhir periode)
    const bln = d.bulanan;
    $('#tBulanan').textContent = `Perbandingan bulanan ${d.tahun}`;
    draw('cBulanan', {
      type: 'bar',
      data: {
        labels: BULAN,
        datasets: [
          { label: 'Pemasukan', data: bln.map((b) => b.pemasukan), backgroundColor: COLORS.masuk },
          { label: 'Pengeluaran', data: bln.map((b) => b.pengeluaran), backgroundColor: COLORS.keluar }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: tip() }, scales: { y: valueAxis(), x: catAxis() } }
    }, bln.some((b) => b.pemasukan > 0 || b.pengeluaran > 0));

    // 6. Laporan tahunan: arus kas bersih per bulan
    const tm = bln.reduce((a, b) => a + b.pemasukan, 0);
    const tk = bln.reduce((a, b) => a + b.pengeluaran, 0);
    $('#tTahunan').textContent = `Laporan tahunan ${d.tahun}`;
    $('#sTahunan').textContent = `Pemasukan ${Fmt.rupiah(tm)}, pengeluaran ${Fmt.rupiah(tk)}, arus kas bersih ${Fmt.rupiah(tm - tk)}.`;
    draw('cTahunan', {
      type: 'bar',
      data: { labels: BULAN, datasets: [{ label: 'Arus kas bersih', data: bln.map((b) => b.arus_bersih), backgroundColor: bln.map((b) => (b.arus_bersih >= 0 ? COLORS.masuk : COLORS.keluar)) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip() }, scales: { y: { ticks: { callback: (v) => Fmt.compact(v) }, grid: { color: COLORS.garis } }, x: catAxis() } }
    }, tm + tk > 0);
  }

  /* ---------- Tabel transaksi ---------- */
  async function loadTransactions() {
    const p = { from: state.from, to: state.to, page: state.page, pageSize: state.pageSize };
    if (state.jenis) p.jenis = state.jenis;
    if (state.kategori) p.kategori = state.kategori;
    if (state.q) p.q = state.q;
    const d = await Api.call('tx_list', p);
    if (!d.items.length && d.total > 0 && state.page > 1) { state.page -= 1; return loadTransactions(); }
    state.rows = d.items;
    state.total = d.total;
    renderTable();
  }

  function renderTable() {
    const body = $('#trxBody');
    $('#trxEmpty').hidden = state.rows.length > 0;
    body.innerHTML = state.rows.map((t, i) => {
      const masuk = t.jenis_transaksi === 'pemasukan';
      return `<tr data-i="${i}">
        <td data-label="Tanggal">${esc(Fmt.tanggal(t.tanggal_transaksi))}</td>
        <td data-label="Deskripsi">${t.deskripsi ? esc(t.deskripsi) : '<span class="muted">-</span>'}</td>
        <td data-label="Jenis"><span class="tag ${masuk ? 'pemasukan' : 'pengeluaran'}">${masuk ? 'Pemasukan' : 'Pengeluaran'}</span></td>
        <td data-label="Kategori">${esc(t.kategori)}</td>
        <td data-label="Nominal" class="num ${masuk ? 'pos' : 'neg'}">${masuk ? '+' : '-'}${esc(Fmt.rupiah(t.nominal))}</td>
        <td data-label="Sumber">${esc(t.sumber_input)}</td>
        <td class="aksi noprint"><button class="linkbtn" type="button" data-act="edit">Ubah</button><button class="linkbtn danger" type="button" data-act="del">Hapus</button></td>
      </tr>`;
    }).join('');

    const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const start = state.total ? (state.page - 1) * state.pageSize + 1 : 0;
    const end = Math.min(state.total, state.page * state.pageSize);
    $('#pageInfo').textContent = state.total ? `${start}–${end} dari ${state.total} transaksi` : '';
    $('#btnPrev').disabled = state.page <= 1;
    $('#btnNext').disabled = state.page >= pages;
  }

  function fillCategoryFilter() {
    const all = Array.from(new Set([...state.cats.pengeluaran, ...state.cats.pemasukan])).sort();
    const sel = $('#fFilterKategori');
    sel.innerHTML = '<option value="">Semua</option>';
    all.forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
  }

  /* ---------- Tambah / ubah ---------- */
  function fillFormCats(jenis, selected) {
    const list = state.cats[jenis] || [];
    const names = selected && !list.includes(selected) ? [selected, ...list] : list;
    const sel = $('#fKategori');
    sel.innerHTML = '';
    names.forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
    if (selected) sel.value = selected;
  }

  function openForm(tx) {
    state.editing = tx || null;
    $('#formTitle').textContent = tx ? 'Ubah transaksi' : 'Tambah transaksi';
    $('#fJenis').value = tx ? tx.jenis_transaksi : 'pengeluaran';
    fillFormCats($('#fJenis').value, tx ? tx.kategori : '');
    $('#fTanggal').max = today;
    $('#fTanggal').value = tx ? tx.tanggal_transaksi : today;
    $('#fNominal').value = tx ? tx.nominal : '';
    $('#fDeskripsi').value = tx ? tx.deskripsi : '';
    $('#formError').textContent = '';
    $('#dlgForm').showModal();
  }

  function validateForm(v) {
    if (!v.tanggal_transaksi) return 'Tanggal wajib diisi.';
    if (v.tanggal_transaksi > today) return 'Tanggal tidak boleh di masa depan.';
    if (!v.kategori) return 'Pilih kategori.';
    if (!Number.isInteger(v.nominal) || v.nominal <= 0) return 'Nominal harus bilangan bulat lebih dari nol.';
    return '';
  }

  async function submitForm(ev) {
    ev.preventDefault();
    const v = {
      jenis_transaksi: $('#fJenis').value,
      tanggal_transaksi: $('#fTanggal').value,
      kategori: $('#fKategori').value,
      nominal: Number($('#fNominal').value),
      deskripsi: $('#fDeskripsi').value.trim()
    };
    const err = validateForm(v);
    if (err) { $('#formError').textContent = err; return; }
    const btn = $('#btnSave');
    btn.disabled = true;
    try {
      if (state.editing) {
        const t = state.editing, ch = {};
        ['jenis_transaksi', 'tanggal_transaksi', 'kategori', 'nominal', 'deskripsi'].forEach((k) => { if (String(v[k]) !== String(t[k])) ch[k] = v[k]; });
        if (!Object.keys(ch).length) { $('#dlgForm').close(); toast('Tidak ada perubahan.'); return; }
        await Api.call('tx_update', { transaction_id: t.transaction_id, changes: ch });
        toast('Transaksi diperbarui.', 'ok');
      } else {
        await Api.call('tx_create', v);
        toast('Transaksi disimpan.', 'ok');
      }
      $('#dlgForm').close();
      refreshAll();
    } catch (e) {
      if (e.code !== 'AUTH_REQUIRED') $('#formError').textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Hapus ---------- */
  function openDelete(tx) {
    state.deleting = tx;
    $('#delText').textContent = `${tx.jenis_transaksi === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} ${Fmt.rupiah(tx.nominal)} · ${tx.kategori} · ${Fmt.tanggal(tx.tanggal_transaksi)}${tx.deskripsi ? ' · ' + tx.deskripsi : ''}`;
    $('#dlgDelete').showModal();
  }

  async function confirmDelete() {
    const btn = $('#btnConfirmDel');
    btn.disabled = true;
    try {
      await Api.call('tx_delete', { transaction_id: state.deleting.transaction_id });
      $('#dlgDelete').close();
      toast('Transaksi dihapus.', 'ok');
      refreshAll();
    } catch (e) {
      $('#dlgDelete').close();
      if (e.code !== 'AUTH_REQUIRED') toast(e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Ekspor & cetak ---------- */
  async function doExport() {
    try {
      const d = await Api.call('export', { from: state.from, to: state.to });
      const blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = d.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Ekspor selesai (${d.jumlah_baris} baris).`, 'ok');
    } catch (e) {
      if (e.code !== 'AUTH_REQUIRED') toast(e.message, 'error');
    }
  }

  /* ---------- Admin: pengguna ---------- */
  async function loadUsers() {
    const list = await Api.call('users');
    $('#usersBody').innerHTML = list.map((u) => `<tr>
      <td data-label="Nama">${esc(u.nama)}</td>
      <td data-label="Peran">${esc(u.role)}</td>
      <td data-label="Status">${u.status_aktif ? 'Aktif' : 'Nonaktif'}</td>
      <td data-label="Nomor">${esc(u.nomor_whatsapp)}</td>
      <td class="aksi">
        <button class="linkbtn" type="button" data-a="${u.status_aktif ? 'deactivate' : 'activate'}" data-id="${esc(u.user_id)}">${u.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <button class="linkbtn danger" type="button" data-a="delete" data-id="${esc(u.user_id)}">Hapus akun</button>
      </td></tr>`).join('');
  }

  async function openUsers() {
    $('#userError').textContent = '';
    $('#dlgUsers').showModal();
    try { await loadUsers(); } catch (e) { if (e.code !== 'AUTH_REQUIRED') $('#userError').textContent = e.message; }
  }

  async function userAction(aksi, params, okMsg) {
    try {
      await Api.call('user_manage', { aksi, params });
      toast(okMsg, 'ok');
      $('#userError').textContent = '';
      await loadUsers();
    } catch (e) {
      if (e.code !== 'AUTH_REQUIRED') $('#userError').textContent = e.message;
    }
  }

  /* ---------- Event ---------- */
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  function bind() {
    $('#mode').addEventListener('change', () => { updateModeFields(); applyPeriod(); });
    ['#inMonth', '#inYear', '#inFrom', '#inTo'].forEach((s) => $(s).addEventListener('change', applyPeriod));
    $('#btnAdd').addEventListener('click', () => openForm(null));
    $('#btnExport').addEventListener('click', doExport);
    $('#btnPrint').addEventListener('click', () => window.print());
    $('#btnLogout').addEventListener('click', async () => {
      try { await Api.call('logout', {}, { noRedirect: true, quiet: true }); } catch (e) { /* abaikan */ }
      Api.clear();
      location.replace('login.html');
    });

    $('#fCari').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.page = 1; loadTransactions().catch((er) => er.code !== 'AUTH_REQUIRED' && toast(er.message, 'error')); }, 350));
    $('#fFilterJenis').addEventListener('change', (e) => { state.jenis = e.target.value; state.page = 1; loadTransactions().catch((er) => er.code !== 'AUTH_REQUIRED' && toast(er.message, 'error')); });
    $('#fFilterKategori').addEventListener('change', (e) => { state.kategori = e.target.value; state.page = 1; loadTransactions().catch((er) => er.code !== 'AUTH_REQUIRED' && toast(er.message, 'error')); });
    $('#btnPrev').addEventListener('click', () => { if (state.page > 1) { state.page--; loadTransactions().catch((er) => er.code !== 'AUTH_REQUIRED' && toast(er.message, 'error')); } });
    $('#btnNext').addEventListener('click', () => { state.page++; loadTransactions().catch((er) => er.code !== 'AUTH_REQUIRED' && toast(er.message, 'error')); });

    $('#trxBody').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const tx = state.rows[Number(btn.closest('tr').dataset.i)];
      if (!tx) return;
      if (btn.dataset.act === 'edit') openForm(tx); else openDelete(tx);
    });

    $('#fJenis').addEventListener('change', () => fillFormCats($('#fJenis').value, ''));
    $('#txForm').addEventListener('submit', submitForm);
    $('#btnCancelForm').addEventListener('click', () => $('#dlgForm').close());
    $('#btnCancelDel').addEventListener('click', () => $('#dlgDelete').close());
    $('#btnConfirmDel').addEventListener('click', confirmDelete);

    $('#btnUsers').addEventListener('click', openUsers);
    $('#btnCloseUsers').addEventListener('click', () => $('#dlgUsers').close());
    $('#usersBody').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'delete' && !window.confirm('Hapus akun ini? Transaksi lama tetap tersimpan sebagai arsip.')) return;
      const msg = a === 'activate' ? 'Pengguna diaktifkan.' : a === 'deactivate' ? 'Pengguna dinonaktifkan.' : 'Akun dihapus.';
      userAction(a, { user_id: b.dataset.id }, msg);
    });
    $('#userForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const nama = $('#uNama').value.trim(), nomor = $('#uNomor').value.trim();
      if (!nama || !nomor) { $('#userError').textContent = 'Nama dan nomor wajib diisi.'; return; }
      userAction('add', { nama, nomor, role: $('#uRole').value }, 'Pengguna ditambahkan.').then(() => { $('#uNama').value = ''; $('#uNomor').value = ''; });
    });
  }

  /* ---------- Mulai ---------- */
  async function init() {
    if (!Api.hasToken()) { location.replace('login.html'); return; }
    bind();
    $('#inMonth').value = today.substring(0, 7);
    $('#inYear').value = today.substring(0, 4);
    $('#inFrom').value = today.substring(0, 8) + '01';
    $('#inTo').value = today;
    updateModeFields();
    try {
      state.user = await Api.call('me');
      state.cats = await Api.call('categories');
    } catch (e) {
      if (e.code !== 'AUTH_REQUIRED') toast(e.message, 'error');
      return;
    }
    $('#userName').textContent = state.user.nama;
    if (state.user.role === 'admin') $('#btnUsers').hidden = false;
    fillCategoryFilter();
    applyPeriod();
  }

  init();
})();
