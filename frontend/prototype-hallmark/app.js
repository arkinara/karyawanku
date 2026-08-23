/* KaryawanKu — shared app behaviour.
 * One job: the command palette. Everything else is CSS.
 */
(function () {
  'use strict';

  var COMMANDS = [
    { label: 'Dashboard — Owner',        href: '03-dashboard-owner.html',   hint: 'Buka' },
    { label: 'Dashboard — Karyawan',     href: '04-dashboard-karyawan.html',hint: 'Buka' },
    { label: 'Daftar Karyawan',          href: '05-daftar-karyawan.html',   hint: 'Buka' },
    { label: 'Payroll Run',              href: '06-payroll-run.html',       hint: 'Buka' },
    { label: 'Slip Gaji',                href: '07-slip-gaji.html',         hint: 'Buka' },
    { label: 'Onboarding — Setup usaha', href: '01-onboarding.html',        hint: 'Buka' },
    { label: 'Masuk',                    href: '02-masuk.html',             hint: 'Buka' },
    { label: 'Indeks prototipe',         href: 'index.html',                hint: 'Buka' },
    { label: 'Setujui payroll Agustus 2026', href: '06-payroll-run.html',   hint: 'Aksi' },
    { label: 'Tinjau 2 pengajuan cuti',      href: '03-dashboard-owner.html', hint: 'Aksi' },
    { label: 'Ekspor CSV payroll',            href: '06-payroll-run.html',   hint: 'Aksi' }
  ];

  var overlay, input, list, items = [], cursor = 0, lastFocus = null;

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'palette';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="palette__panel" role="dialog" aria-modal="true" aria-label="Perintah cepat">' +
        '<div class="palette__search">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<label class="sr-only" for="palette-q">Cari halaman atau aksi</label>' +
          '<input id="palette-q" type="text" autocomplete="off" placeholder="Cari halaman atau aksi…" />' +
        '</div>' +
        '<div class="palette__list" role="listbox" aria-label="Hasil"></div>' +
        '<div class="palette__foot"><span><kbd>↑</kbd> <kbd>↓</kbd> pilih</span><span><kbd>Enter</kbd> buka</span><span><kbd>Esc</kbd> tutup</span></div>' +
      '</div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('input');
    list = overlay.querySelector('.palette__list');

    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    input.addEventListener('input', function () { render(input.value); });
    overlay.addEventListener('keydown', onKey);
  }

  function render(q) {
    var needle = (q || '').trim().toLowerCase();
    var hits = COMMANDS.filter(function (c) { return c.label.toLowerCase().indexOf(needle) > -1; });
    cursor = 0;
    if (!hits.length) {
      list.innerHTML = '<p class="palette__empty">Tidak ada hasil untuk “' + escapeHtml(q) + '”.</p>';
      items = [];
      return;
    }
    list.innerHTML = hits.map(function (c, i) {
      return '<button type="button" class="palette__item" role="option" aria-selected="' + (i === 0) + '" data-href="' + c.href + '">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>' +
        '<span>' + escapeHtml(c.label) + '</span><span class="k">' + c.hint + '</span></button>';
    }).join('');
    items = Array.prototype.slice.call(list.querySelectorAll('.palette__item'));
    items.forEach(function (el) { el.addEventListener('click', function () { go(el); }); });
  }

  function move(delta) {
    if (!items.length) return;
    items[cursor].setAttribute('aria-selected', 'false');
    cursor = (cursor + delta + items.length) % items.length;
    items[cursor].setAttribute('aria-selected', 'true');
    items[cursor].scrollIntoView({ block: 'nearest' });
  }

  function go(el) { var href = el.getAttribute('data-href'); if (href) window.location.href = href; }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[cursor]) go(items[cursor]); }
  }

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    input.value = '';
    render('');
    input.focus({ preventScroll: true });
  }

  function close() {
    overlay.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    build();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cmdk]'), function (btn) {
      btn.addEventListener('click', open);
    });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); overlay.hidden ? open() : close(); }
    });
  });
})();
