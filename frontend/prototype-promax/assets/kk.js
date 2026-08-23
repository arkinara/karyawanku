/* ==========================================================================
   KaryawanKu — ProMax runtime
   One shell, one icon set, one motion rhythm, shared by every page.
   Pages ship only their <main>; this file builds the rail, app bar, drawer,
   bottom nav, theme switch, toasts and dialogs around it.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- icons: Lucide geometry, one stroke width, one corner style --- */
  var ICON = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M21 12H12a2 2 0 0 0 0 4h9v-4Z"/>',
    payslip: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.2-2.9l-.06-.06A2 2 0 1 1 8.56 5.2l.06.06a1.7 1.7 0 0 0 1.88.34h.08A1.7 1.7 0 0 0 11.6 4.1V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0 1.2 2.9h.09a2 2 0 1 1 0 4H19.4Z"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
    alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    x: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',
    printer: '<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M6 4l14 8-14 8V4Z"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>',
    trend: '<path d="M3 17l6-6 4 4 7-7"/><path d="M15 8h5v5"/>',
    coffee: '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M4 21h13"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3"/><path d="M6.6 6.7A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    inbox: '<path d="M3 12h5l2 3h4l2-3h5"/><path d="M4.5 5h15l1.5 7v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7Z"/>',
    undo: '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.6-7.6L3 8"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>',
  };

  function icon(name, size, cls) {
    var d = ICON[name];
    if (!d) return '';
    var s = size || 20;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false"' + (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';
  }

  /* ---------- money / dates ---------------------------------------------- */
  var idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  function formatIDR(v) { return idr.format(v).replace(/ /g, ' '); }
  function formatNum(v) { return new Intl.NumberFormat('id-ID').format(v); }

  /* ---------- theme ------------------------------------------------------ */
  var THEME_KEY = 'kk-theme';

  function readTheme() {
    var q = new URLSearchParams(location.search).get('theme');
    if (q === 'dark' || q === 'light') return q;
    try {
      var s = localStorage.getItem(THEME_KEY);
      if (s === 'dark' || s === 'light') return s;
    } catch (e) { /* file:// with storage blocked — fall through to system */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(mode) {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.style.colorScheme = mode;
    document.querySelectorAll('[data-kk-theme-toggle]').forEach(function (btn) {
      btn.innerHTML = icon(mode === 'dark' ? 'sun' : 'moon', 19);
      var next = mode === 'dark' ? 'terang' : 'gelap';
      btn.setAttribute('aria-label', 'Ganti ke tampilan ' + next);
      btn.setAttribute('title', 'Tampilan ' + next);
    });
    document.dispatchEvent(new CustomEvent('kk:theme', { detail: { mode: mode } }));
  }

  function setTheme(mode) {
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) { /* ignore */ }
    applyTheme(mode);
    // Keep the prototype viewer and every open iframe in sync.
    try { window.parent.postMessage({ kkTheme: mode }, '*'); } catch (e) { /* ignore */ }
    document.querySelectorAll('iframe').forEach(function (f) {
      try { f.contentWindow.postMessage({ kkTheme: mode }, '*'); } catch (e) { /* ignore */ }
    });
  }

  function toggleTheme() {
    setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  }

  window.addEventListener('message', function (e) {
    if (e.data && (e.data.kkTheme === 'dark' || e.data.kkTheme === 'light')) applyTheme(e.data.kkTheme);
  });

  /* ---------- navigation model ------------------------------------------- */
  var NAV = {
    owner: {
      org: { name: 'Warung Kopi Nusantara', meta: 'Paket Gratis · 12 karyawan', mono: 'WK' },
      user: { name: 'Pak Darmawan', role: 'Pemilik', mono: 'PD' },
      primary: [
        { key: 'dashboard', label: 'Ringkasan', icon: 'dashboard', href: '03-quick-dashboard-owner.html' },
        { key: 'employees', label: 'Karyawan', icon: 'users', href: '05-employee-directory.html' },
        { key: 'attendance', label: 'Absensi', icon: 'clock', href: '#' },
        { key: 'leave', label: 'Cuti', icon: 'calendar', href: '#', badge: 2 },
        { key: 'payroll', label: 'Payroll', icon: 'wallet', href: '06-payroll-run.html' },
      ],
      secondary: [{ key: 'settings', label: 'Pengaturan', icon: 'settings', href: '#' }],
    },
    employee: {
      org: { name: 'Warung Kopi Nusantara', meta: 'Cabang Kemang', mono: 'WK' },
      user: { name: 'Siti Nurhaliza', role: 'Kasir', mono: 'SN' },
      primary: [
        { key: 'home', label: 'Beranda', icon: 'home', href: '04-quick-dashboard-employee.html' },
        { key: 'attendance', label: 'Absensi', icon: 'clock', href: '#' },
        { key: 'leave', label: 'Cuti', icon: 'calendar', href: '#', badge: 1 },
        { key: 'payslip', label: 'Slip Gaji', icon: 'payslip', href: '07-payslip-detail.html' },
        { key: 'settings', label: 'Pengaturan', icon: 'settings', href: '#' },
      ],
      secondary: [],
    },
  };

  function navItemHTML(item, active, cls) {
    var current = item.key === active;
    return '<a class="' + (cls || 'nav-item') + '" href="' + item.href + '"' +
      (current ? ' aria-current="page"' : '') + '>' +
      icon(item.icon, 20) +
      '<span class="label">' + item.label + '</span>' +
      (item.badge ? '<span class="nav-badge" aria-label="' + item.badge + ' menunggu">' + item.badge + '</span>' : '') +
      '</a>';
  }

  function railHTML(cfg, active) {
    return '' +
      '<a class="brand" href="' + cfg.primary[0].href + '">' +
        '<span class="brand-mark" aria-hidden="true">K</span>' +
        '<span class="brand-name">KaryawanKu</span>' +
      '</a>' +
      '<nav class="rail-nav" aria-label="Navigasi utama">' +
        '<p class="rail-group" id="rail-g1">Operasional</p>' +
        '<div role="group" aria-labelledby="rail-g1">' + cfg.primary.map(function (i) { return navItemHTML(i, active); }).join('') + '</div>' +
        (cfg.secondary.length
          ? '<p class="rail-group" id="rail-g2">Akun</p><div role="group" aria-labelledby="rail-g2">' +
            cfg.secondary.map(function (i) { return navItemHTML(i, active); }).join('') + '</div>'
          : '') +
      '</nav>' +
      '<div class="rail-foot">' +
        '<button type="button" class="org">' +
          '<span class="avatar avatar-sm" aria-hidden="true">' + cfg.org.mono + '</span>' +
          '<span style="min-width:0;flex:1">' +
            '<span class="t-label" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + cfg.org.name + '</span>' +
            '<span class="t-caption" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + cfg.org.meta + '</span>' +
          '</span>' +
          icon('chevronDown', 16) +
        '</button>' +
      '</div>';
  }

  function bottomNavHTML(cfg, active) {
    return cfg.primary.slice(0, 5).map(function (i) {
      var current = i.key === active;
      return '<a class="bnav-item" href="' + i.href + '"' + (current ? ' aria-current="page"' : '') + '>' +
        (current ? '<span class="pill" aria-hidden="true"></span>' : '') +
        icon(i.icon, 21) +
        '<span>' + i.label + '</span>' +
        (i.badge ? '<span class="bnav-dot" aria-hidden="true"></span><span class="sr-only">' + i.badge + ' menunggu</span>' : '') +
        '</a>';
    }).join('');
  }

  function appbarHTML(cfg, opts) {
    return '' +
      '<button type="button" class="btn btn-icon" data-kk-drawer-open aria-label="Buka menu navigasi" ' +
        'aria-expanded="false" aria-controls="kk-drawer" style="margin-left:4px">' + icon('menu', 22) + '</button>' +
      '<div style="min-width:0;flex:1">' +
        '<p class="t-h3" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (opts.title || '') + '</p>' +
        (opts.subtitle ? '<p class="t-caption" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + opts.subtitle + '</p>' : '') +
      '</div>' +
      '<button type="button" class="btn btn-icon" data-kk-theme-toggle></button>' +
      '<button type="button" class="btn btn-icon" data-kk-notif aria-label="Notifikasi, 3 belum dibaca" style="position:relative">' +
        icon('bell', 20) +
        '<span aria-hidden="true" style="position:absolute;top:9px;right:9px;width:8px;height:8px;border-radius:50%;background:hsl(var(--danger));box-shadow:0 0 0 2px hsl(var(--surface))"></span>' +
      '</button>' +
      '<button type="button" class="btn btn-icon" aria-label="Akun saya · ' + cfg.user.name + '" style="width:44px">' +
        '<span class="avatar avatar-sm" aria-hidden="true" style="background:hsl(var(--primary));color:hsl(var(--on-primary))">' + cfg.user.mono + '</span>' +
      '</button>';
  }

  function drawerHTML(cfg, active) {
    return '' +
      '<div style="display:flex;align-items:center;gap:8px;height:var(--appbar-h);padding:0 8px 0 16px;border-bottom:1px solid hsl(var(--outline-variant))">' +
        '<span class="brand-mark" aria-hidden="true">K</span>' +
        '<span class="brand-name" style="flex:1">KaryawanKu</span>' +
        '<button type="button" class="btn btn-icon" data-kk-drawer-close aria-label="Tutup menu">' + icon('close', 20) + '</button>' +
      '</div>' +
      '<nav class="rail-nav" aria-label="Navigasi utama (mobile)">' +
        cfg.primary.concat(cfg.secondary).map(function (i) { return navItemHTML(i, active); }).join('') +
      '</nav>' +
      '<div class="rail-foot">' +
        '<div class="org" style="cursor:default">' +
          '<span class="avatar avatar-sm" aria-hidden="true">' + cfg.user.mono + '</span>' +
          '<span style="min-width:0;flex:1">' +
            '<span class="t-label" style="display:block">' + cfg.user.name + '</span>' +
            '<span class="t-caption" style="display:block">' + cfg.user.role + ' · ' + cfg.org.name + '</span>' +
          '</span>' +
        '</div>' +
        '<a class="nav-item" href="02-auth-sign-in.html" style="color:hsl(var(--danger))">' + icon('logout', 20) + '<span class="label">Keluar</span></a>' +
      '</div>';
  }

  /* ---------- shell assembly -------------------------------------------- */
  function buildShell() {
    var body = document.body;
    var role = body.dataset.kkShell;              // 'owner' | 'employee' | absent
    if (!role || !NAV[role]) return;

    var cfg = NAV[role];
    var active = body.dataset.kkNav || '';
    var main = document.querySelector('[data-kk-main]');
    if (!main) return;

    var skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main';
    skip.textContent = 'Lompat ke konten utama';

    var shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML =
      '<aside class="rail">' + railHTML(cfg, active) + '</aside>' +
      '<div class="main-col">' +
        '<header class="appbar">' + appbarHTML(cfg, {
          title: body.dataset.kkTitle || '',
          subtitle: body.dataset.kkSubtitle || '',
        }) + '</header>' +
      '</div>';

    body.insertBefore(skip, body.firstChild);
    body.insertBefore(shell, main);
    shell.querySelector('.main-col').appendChild(main);

    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.dataset.kkDrawerClose = '';

    var drawer = document.createElement('aside');
    drawer.className = 'drawer';
    drawer.id = 'kk-drawer';
    drawer.setAttribute('aria-label', 'Menu navigasi');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = drawerHTML(cfg, active);

    var bnav = document.createElement('nav');
    bnav.className = 'bottomnav';
    bnav.setAttribute('aria-label', 'Navigasi utama');
    bnav.innerHTML = bottomNavHTML(cfg, active);

    body.appendChild(scrim);
    body.appendChild(drawer);
    body.appendChild(bnav);

    wireDrawer(drawer, scrim);
  }

  /* ---------- drawer ---------------------------------------------------- */
  function wireDrawer(drawer, scrim) {
    var opener = null;

    function focusables() {
      return Array.prototype.filter.call(
        drawer.querySelectorAll('a[href], button:not(:disabled)'),
        function (el) { return el.offsetParent !== null; }
      );
    }

    function open(trigger) {
      opener = trigger || null;
      drawer.dataset.open = 'true';
      scrim.dataset.open = 'true';
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.querySelectorAll('[data-kk-drawer-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      var f = focusables();
      if (f.length) f[0].focus();
    }

    function close() {
      delete drawer.dataset.open;
      delete scrim.dataset.open;
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      document.querySelectorAll('[data-kk-drawer-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (opener) opener.focus();
    }

    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-kk-drawer-open]');
      if (o) { open(o); return; }
      if (e.target.closest('[data-kk-drawer-close]')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (drawer.dataset.open !== 'true') return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // A resize past the desktop breakpoint makes the drawer redundant.
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (ev) {
      if (ev.matches && drawer.dataset.open === 'true') close();
    });
  }

  /* ---------- toasts ---------------------------------------------------- */
  function toastRegion() {
    var r = document.querySelector('.toast-region');
    if (!r) {
      r = document.createElement('div');
      r.className = 'toast-region';
      r.setAttribute('role', 'status');
      r.setAttribute('aria-live', 'polite');
      document.body.appendChild(r);
    }
    return r;
  }

  /* opts: { tone:'success'|'danger'|'info', undo:fn, timeout:ms } */
  function toast(message, opts) {
    opts = opts || {};
    var tone = opts.tone || 'info';
    var el = document.createElement('div');
    el.className = 'toast toast-' + tone;
    el.innerHTML =
      '<span class="icon" style="flex:none;display:grid">' +
        icon(tone === 'success' ? 'checkCircle' : tone === 'danger' ? 'alert' : 'info', 19) +
      '</span>' +
      '<span class="msg">' + message + '</span>' +
      (opts.undo ? '<button type="button" class="undo">Batalkan</button>' : '');

    var timer;
    function dismiss() {
      clearTimeout(timer);
      el.dataset.leaving = 'true';
      setTimeout(function () { el.remove(); }, 220);
    }
    if (opts.undo) {
      el.querySelector('.undo').addEventListener('click', function () { opts.undo(); dismiss(); });
    }
    toastRegion().appendChild(el);
    timer = setTimeout(dismiss, opts.timeout || (opts.undo ? 6000 : 4000));
    return dismiss;
  }

  /* ---------- confirm dialog -------------------------------------------- */
  /* opts: { title, body, confirm, cancel, tone:'primary'|'danger' } -> Promise<bool> */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog');
      dlg.className = 'kk-dialog';
      dlg.setAttribute('aria-labelledby', 'kk-dlg-title');
      var danger = opts.tone === 'danger';
      dlg.innerHTML =
        '<div class="dialog-body">' +
          '<div style="display:flex;gap:12px">' +
            '<span class="icon-tile ' + (danger ? 'icon-tile-danger' : 'icon-tile-primary') + '">' +
              icon(danger ? 'alert' : 'info', 19) + '</span>' +
            '<div style="min-width:0">' +
              '<h2 class="t-h2" id="kk-dlg-title">' + opts.title + '</h2>' +
              '<p class="t-body-sm t-muted" style="margin-top:6px">' + opts.body + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dialog-actions">' +
          '<button type="button" class="btn btn-outline" value="cancel">' + (opts.cancel || 'Batal') + '</button>' +
          '<button type="button" class="btn ' + (danger ? 'btn-filled' : 'btn-filled') + '" value="ok"' +
            (danger ? ' style="background:hsl(var(--danger));color:#fff"' : '') + '>' + (opts.confirm || 'Lanjutkan') + '</button>' +
        '</div>';

      function finish(ok) {
        dlg.close();
        dlg.remove();
        resolve(ok);
      }
      dlg.querySelector('[value="cancel"]').addEventListener('click', function () { finish(false); });
      dlg.querySelector('[value="ok"]').addEventListener('click', function () { finish(true); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); finish(false); });
      document.body.appendChild(dlg);
      dlg.showModal();
      dlg.querySelector('[value="cancel"]').focus();
    });
  }

  /* ---------- reveal on scroll ------------------------------------------ */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.dataset.in = 'true'; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var group = entry.target.parentElement ? Array.prototype.indexOf.call(entry.target.parentElement.children, entry.target) : 0;
        entry.target.style.setProperty('--delay', Math.min(group, 8) * 45 + 'ms');
        entry.target.dataset.in = 'true';
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- generic table sort ---------------------------------------- */
  /* <th data-sort="text|num|date"> + <button class="th-sort"> inside */
  function initSortables() {
    document.querySelectorAll('table[data-sortable]').forEach(function (table) {
      var tbody = table.tBodies[0];
      if (!tbody) return;
      table.querySelectorAll('th[data-sort]').forEach(function (th, colIndex) {
        var btn = th.querySelector('.th-sort');
        if (!btn) return;
        btn.addEventListener('click', function () {
          var idx = Array.prototype.indexOf.call(th.parentElement.children, th);
          var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
          table.querySelectorAll('th[data-sort]').forEach(function (o) { o.removeAttribute('aria-sort'); });
          th.setAttribute('aria-sort', dir);
          var type = th.dataset.sort;
          var rows = Array.prototype.slice.call(tbody.rows);
          rows.sort(function (a, b) {
            var av = cellValue(a.children[idx], type);
            var bv = cellValue(b.children[idx], type);
            if (av < bv) return dir === 'ascending' ? -1 : 1;
            if (av > bv) return dir === 'ascending' ? 1 : -1;
            return 0;
          });
          rows.forEach(function (r) { tbody.appendChild(r); });
          announce('Tabel diurutkan berdasarkan ' + (th.dataset.sortLabel || btn.textContent.trim()) +
            ', ' + (dir === 'ascending' ? 'naik' : 'turun'));
        });
      });
    });
  }

  function cellValue(cell, type) {
    if (!cell) return '';
    var raw = cell.dataset.value != null ? cell.dataset.value : cell.textContent.trim();
    if (type === 'num') return parseFloat(String(raw).replace(/[^\d.-]/g, '')) || 0;
    if (type === 'date') return new Date(raw).getTime() || 0;
    return String(raw).toLowerCase();
  }

  /* ---------- live region ----------------------------------------------- */
  var liveEl;
  function announce(msg) {
    if (!liveEl) {
      liveEl = document.createElement('p');
      liveEl.className = 'sr-only';
      liveEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveEl);
    }
    liveEl.textContent = '';
    setTimeout(function () { liveEl.textContent = msg; }, 40);
  }

  /* ---------- form validation ------------------------------------------- */
  /* Validates on blur (never on keystroke), clears while the user retypes. */
  function initValidation() {
    document.querySelectorAll('form[data-kk-validate]').forEach(function (form) {
      var fields = form.querySelectorAll('[data-rule]');

      fields.forEach(function (input) {
        input.addEventListener('blur', function () { validate(input); });
        input.addEventListener('input', function () {
          if (input.getAttribute('aria-invalid') === 'true') clearError(input);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var bad = [];
        fields.forEach(function (input) { if (!validate(input)) bad.push(input); });
        if (bad.length) {
          bad[0].focus();
          announce(bad.length + ' kolom perlu diperbaiki');
          return;
        }
        var btn = form.querySelector('[type="submit"]');
        if (btn) {
          btn.setAttribute('aria-busy', 'true');
          setTimeout(function () {
            btn.removeAttribute('aria-busy');
            var to = form.dataset.kkNext;
            if (to) { location.href = to; } else { toast('Berhasil masuk.', { tone: 'success' }); }
          }, 900);
        }
      });
    });
  }

  function errorEl(input) {
    var id = input.getAttribute('aria-describedby');
    return id ? document.getElementById(id.split(' ').filter(function (x) { return x.indexOf('err-') === 0; })[0]) : null;
  }

  function clearError(input) {
    input.setAttribute('aria-invalid', 'false');
    var el = errorEl(input);
    if (el) el.dataset.show = 'false';
  }

  function showError(input, msg) {
    input.setAttribute('aria-invalid', 'true');
    var el = errorEl(input);
    if (el) {
      el.innerHTML = icon('alert', 14) + '<span>' + msg + '</span>';
      el.dataset.show = 'true';
    }
  }

  function validate(input) {
    var rule = input.dataset.rule || '';
    var v = input.value.trim();
    if (rule.indexOf('required') > -1 && !v) {
      showError(input, input.dataset.msgRequired || 'Kolom ini wajib diisi.');
      return false;
    }
    if (v && rule.indexOf('email') > -1 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      showError(input, 'Format email belum benar. Contoh: nama@usaha.com');
      return false;
    }
    if (v && rule.indexOf('min') > -1) {
      var m = /min:(\d+)/.exec(rule);
      if (m && v.length < Number(m[1])) {
        showError(input, 'Minimal ' + m[1] + ' karakter.');
        return false;
      }
    }
    clearError(input);
    return true;
  }

  /* ---------- password reveal ------------------------------------------- */
  function initPasswordToggles() {
    document.querySelectorAll('[data-kk-pw-toggle]').forEach(function (btn) {
      var input = document.getElementById(btn.dataset.kkPwToggle);
      if (!input) return;
      function paint() {
        var shown = input.type === 'text';
        btn.innerHTML = icon(shown ? 'eyeOff' : 'eye', 19);
        btn.setAttribute('aria-label', shown ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
        btn.setAttribute('aria-pressed', String(shown));
      }
      btn.addEventListener('click', function () {
        input.type = input.type === 'password' ? 'text' : 'password';
        paint();
      });
      paint();
    });
  }

  /* ---------- progress rings -------------------------------------------- */
  function initRings() {
    document.querySelectorAll('[data-kk-ring]').forEach(function (el) {
      var pct = Math.max(0, Math.min(100, Number(el.dataset.kkRing) || 0));
      var circle = el.querySelector('.value');
      if (!circle) return;
      var r = circle.r.baseVal.value;
      var c = 2 * Math.PI * r;
      circle.style.strokeDasharray = c.toFixed(1);
      circle.style.strokeDashoffset = c.toFixed(1);
      requestAnimationFrame(function () {
        circle.style.strokeDashoffset = (c * (1 - pct / 100)).toFixed(1);
      });
    });
  }

  /* ---------- elapsed-time counters ------------------------------------- */
  function initTickers() {
    document.querySelectorAll('[data-kk-since]').forEach(function (el) {
      var base = Number(el.dataset.kkSince) || 0; // minutes already worked
      var start = Date.now();
      function paint() {
        var mins = base + Math.floor((Date.now() - start) / 60000);
        var h = String(Math.floor(mins / 60)).padStart(2, '0');
        var m = String(mins % 60).padStart(2, '0');
        el.textContent = h + ':' + m;
        el.setAttribute('datetime', 'PT' + Number(h) + 'H' + Number(m) + 'M');
      }
      paint();
      setInterval(paint, 30000);
    });
  }

  /* ---------- async button demo ----------------------------------------- */
  /* data-kk-async='{"ms":900,"toast":"...","tone":"success","confirm":{...}}' */
  function initAsyncButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-kk-async]');
      if (!btn) return;
      e.preventDefault();
      var cfg = {};
      try { cfg = JSON.parse(btn.dataset.kkAsync); } catch (err) { /* ignore */ }

      function run() {
        btn.setAttribute('aria-busy', 'true');
        setTimeout(function () {
          btn.removeAttribute('aria-busy');
          if (cfg.done) {
            btn.innerHTML = icon('check', 18) + '<span>' + cfg.done + '</span>';
            btn.disabled = true;
          }
          if (cfg.toast) {
            toast(cfg.toast, {
              tone: cfg.tone || 'success',
              undo: cfg.undo ? function () { toast('Dibatalkan.', { tone: 'info' }); } : null,
            });
          }
          if (cfg.status) {
            document.querySelectorAll(cfg.status).forEach(function (el) { el.hidden = !el.hidden; });
          }
        }, cfg.ms || 1100);
      }

      if (cfg.confirm) {
        confirmDialog(cfg.confirm).then(function (ok) { if (ok) run(); });
      } else {
        run();
      }
    });
  }

  /* ---------- boot ------------------------------------------------------ */
  applyTheme(readTheme());

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-kk-theme-toggle]')) toggleTheme();
    var notif = e.target.closest('[data-kk-notif]');
    if (notif) toast('3 notifikasi: 2 pengajuan cuti, 1 payroll menunggu persetujuan.', { tone: 'info' });
  });

  function boot() {
    buildShell();
    applyTheme(readTheme());          // repaint toggles created by the shell
    initReveal();
    initSortables();
    initValidation();
    initPasswordToggles();
    initRings();
    initTickers();
    initAsyncButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ---------- public surface -------------------------------------------- */
  window.KK = {
    icon: icon,
    toast: toast,
    confirm: confirmDialog,
    announce: announce,
    formatIDR: formatIDR,
    formatNum: formatNum,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    nav: NAV,
  };
})();
