/* ==========================================================================
   KaryawanKu — "Cap & Kain" · shared behaviour
   One file, feature-detected per page. No framework, no build step.
   The one authored motion moment lives in initPayroll(): the draft is
   klowong (drawn but un-dyed) until it is stamped, then the rows dye.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var rupiah = function (n) {
    return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
  };
  window.rupiah = rupiah;

  /* ---------- Drawer (mobile selvedge rail) ------------------------------
     The rail is visibility:hidden while closed, so it leaves the tab order;
     the trigger owns aria-expanded and the rail owns a real close button. */
  function initDrawer() {
    var openers = $$('[data-drawer-open]');
    if (!openers.length) return;
    var rail = $('#rail');
    var scrim = $('.scrim');

    function set(open) {
      document.body.classList.toggle('drawer-open', open);
      openers.forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
      if (!rail) return;
      // while it overlays the page it behaves as a dialog, not as a permanent rail
      if (open) {
        rail.setAttribute('role', 'dialog');
        rail.setAttribute('aria-modal', 'true');
        rail.setAttribute('aria-label', 'Navigasi utama');
      } else {
        rail.removeAttribute('role');
        rail.removeAttribute('aria-modal');
        rail.removeAttribute('aria-label');
      }
    }

    // Tab must not walk out of an open drawer into the scrimmed page behind it
    function trap(e) {
      if (e.key !== 'Tab' || !rail || !document.body.classList.contains('drawer-open')) return;
      var f = $$('a[href], button:not([disabled])', rail);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!rail.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function open() {
      set(true);
      var first = rail && rail.querySelector('[data-drawer-close]');
      if (first) first.focus();
    }
    function close() {
      set(false);
      if (openers[0]) openers[0].focus();
    }

    openers.forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      if (rail && rail.id) b.setAttribute('aria-controls', rail.id);
      b.addEventListener('click', open);
    });
    if (scrim) scrim.addEventListener('click', close);
    $$('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) close();
      else trap(e);
    });
  }

  /* ---------- Password reveal ------------------------------------------- */
  function initPwToggle() {
    $$('[data-pw-toggle]').forEach(function (btn) {
      var input = document.getElementById(btn.getAttribute('data-pw-toggle'));
      if (!input) return;
      var ico = btn.querySelector('.ico');
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
        if (ico) ico.className = 'ico ' + (show ? 'ico-eye-off' : 'ico-eye');
      });
    });
  }

  /* ---------- Sign in: real validation, announced error state ------------ */
  function initSignIn() {
    var form = $('#formMasuk');
    if (!form) return;
    var email = $('#email');
    var pw = $('#password');
    var btn = $('#btnMasuk');

    function mark(input, errId, bad) {
      var field = input.closest('.field');
      if (field) field.classList.toggle('is-error', bad);
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      // recovery copy is only useful if it is wired to the field that failed
      if (bad) input.setAttribute('aria-describedby', errId);
      else input.removeAttribute('aria-describedby');
    }
    email.addEventListener('input', function () { if (email.value.trim()) mark(email, 'emailErr', false); });
    pw.addEventListener('input', function () { if (pw.value.trim()) mark(pw, 'pwErr', false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var badEmail = !/^\S+@\S+\.\S+$/.test(email.value.trim());
      var badPw = pw.value.trim().length < 6;
      mark(email, 'emailErr', badEmail);
      mark(pw, 'pwErr', badPw);
      if (badEmail) { email.focus(); return; }
      if (badPw) { pw.focus(); return; }
      btn.setAttribute('data-loading', 'true');
      setTimeout(function () { window.location.href = '03-quick-dashboard-owner.html'; }, 700);
    });
  }

  /* ---------- Onboarding wizard ----------------------------------------- */
  function initWizard() {
    var host = $('#wizard');
    if (!host) return;
    var names = { 1: 'Profil Usaha', 2: 'Komponen Gaji', 3: 'Konfirmasi' };
    var step = 1;
    var back = $('#btnBack');
    var next = $('#btnNext');

    function render() {
      $$('[data-step]', host).forEach(function (s) {
        s.hidden = Number(s.getAttribute('data-step')) !== step;
      });
      $$('.step').forEach(function (li) {
        var n = Number(li.getAttribute('data-stepitem'));
        li.classList.toggle('is-now', n === step);
        li.classList.toggle('is-done', n < step);
        var cap = li.querySelector('.step__cap');
        cap.innerHTML = n < step ? '<span class="ico ico-check" aria-hidden="true"></span>' : String(n);
      });
      var now = $('#stepNow'), nm = $('#stepName');
      if (now) now.textContent = String(step);
      if (nm) nm.textContent = names[step];
      back.disabled = step === 1;
      next.textContent = step === 3 ? 'Selesai & Mulai' : 'Lanjut';
    }

    next.addEventListener('click', function () {
      if (step < 3) { step++; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      next.setAttribute('data-loading', 'true');
      setTimeout(function () { window.location.href = '03-quick-dashboard-owner.html'; }, 700);
    });
    back.addEventListener('click', function () {
      if (step > 1) { step--; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    $$('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { step = Number(b.getAttribute('data-goto')); render(); });
    });
    render();
  }

  /* ---------- Payroll: the stamp -----------------------------------------
     Draft rows are klowong — drawn but not dyed. Stamping inks the seal and
     dyes the rows left to right, then locks the run. This is the product's
     own irreversibility, not decoration.                                   */
  function initPayroll() {
    var btn = $('#btnCap');
    if (!btn) return;
    var confirmBar = $('#capConfirm');
    var actionBar = $('#capActions');

    $$('[data-cap-cancel]').forEach(function (b) {
      b.addEventListener('click', function () {
        confirmBar.hidden = true;
        actionBar.hidden = false;
        btn.focus();
      });
    });

    btn.addEventListener('click', function () {
      actionBar.hidden = true;
      confirmBar.hidden = false;
      var yes = $('#btnCapYes');
      if (yes) yes.focus();
    });

    var yes = $('#btnCapYes');
    if (!yes) return;
    yes.addEventListener('click', function () {
      yes.setAttribute('data-loading', 'true');
      setTimeout(stamp, 620);
    });

    function stamp() {
      $$('#payrollRows tr').forEach(function (tr, i) {
        tr.style.setProperty('--d', (i * 55) + 'ms');
        tr.classList.add('dyeing');
        setTimeout(function () {
          tr.classList.remove('klowong');
          tr.classList.add('tercap');
        }, i * 55 + 160);
      });
      $$('#payrollCards > li').forEach(function (li, i) {
        setTimeout(function () { li.classList.remove('klowong'); li.classList.add('tercap'); }, i * 55 + 160);
      });

      var seal = $('#seal');
      if (seal) {
        setTimeout(function () {
          seal.classList.remove('seal--draft');
          seal.classList.add('seal--tercap', 'seal--press');
          var word = $('#sealWord');
          if (word) word.textContent = 'Tercap';
          var arc = $('#sealArc');
          if (arc) arc.textContent = 'DISETUJUI 19 AGUSTUS 2026 ·';
        }, 260);
      }

      setTimeout(function () {
        var notis = $('#payrollNotis');
        if (notis) {
          notis.className = 'notis notis--nila';
          notis.innerHTML =
            '<span class="notis__ico"><span class="ico ico-lock ico--sm" aria-hidden="true"></span></span>' +
            '<div class="grow"><strong>Terkunci — sudah disetujui</strong>' +
            '<p>Slip gaji dikirim ke 12 karyawan. Rincian periode ini tidak dapat diubah lagi.</p></div>' +
            '<span class="tag tag--nila none">Tercap</span>';
        }

        $('#capConfirm').hidden = true;
        var done = $('#capDone');
        if (done) { done.hidden = false; done.focus(); }
      }, 700);
    }
  }

  /* ---------- Employee dashboard: clock out ----------------------------- */
  function initClock() {
    var btn = $('#btnClockOut');
    if (!btn) return;
    btn.addEventListener('click', function () {
      btn.setAttribute('data-loading', 'true');
      setTimeout(function () {
        btn.removeAttribute('data-loading');
        btn.disabled = true;
        btn.textContent = 'Sudah clock out 09:14';
        var st = $('#workState');
        if (st) {
          st.className = 'tag tag--on-nila none';
          st.innerHTML = '<span class="tag__dot"></span>Selesai bekerja';
        }
        var note = $('#clockNote');
        if (note) note.textContent = 'Tercatat 1 jam 29 menit · 07:45 – 09:14 WIB · lokasi terverifikasi.';
      }, 620);
    });
  }

  /* ---------- Directory: search + status filter + real empty state ------- */
  function initDirectory() {
    var search = $('#cari');
    if (!search) return;
    var rows = $$('[data-emp]');
    var chips = $$('[data-status-tab]');
    var count = $('#hasil');
    var empty = $('#kosong');
    var table = $('#tabelKaryawan');
    var list = $('#listKaryawan');
    var pager = $('#pager');
    var clearBtn = $('#bersihkan');
    var onPage = rows.length / 2; // each person appears once in the table and once in the card list
    var status = 'semua';

    function apply() {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (el) {
        var hay = (el.getAttribute('data-emp') || '').toLowerCase();
        var st = el.getAttribute('data-status');
        var ok = (!q || hay.indexOf(q) !== -1) && (status === 'semua' || st === status);
        el.hidden = !ok;
        if (ok) shown++;
      });
      shown = shown / 2;

      var filtering = q !== '' || status !== 'semua';
      if (count) {
        count.textContent = filtering
          ? shown + ' dari ' + onPage + ' karyawan di halaman ini cocok'
          : '12 karyawan terdaftar · 11 aktif · 1 nonaktif';
      }
      var none = shown === 0;
      if (empty) empty.hidden = !none;
      if (table) table.hidden = none;
      if (list)  list.hidden = none;
      if (pager) pager.hidden = none;
      if (none) {
        var term = $('#kosongTerm');
        if (term) term.textContent = q ? '“' + search.value.trim() + '”' : 'filter ini';
      }
    }

    function selectChip(chip) {
      status = chip.getAttribute('data-status-tab');
      chips.forEach(function (o) {
        var on = o === chip;
        o.setAttribute('aria-pressed', on ? 'true' : 'false');
        o.className = 'btn btn--sm ' + (on ? 'btn--cap' : 'btn--garis');
      });
      apply();
    }

    search.addEventListener('input', apply);
    chips.forEach(function (c) { c.addEventListener('click', function () { selectChip(c); }); });
    if (clearBtn) clearBtn.addEventListener('click', function () {
      search.value = '';
      selectChip(chips[0]);
      search.focus();
    });
  }

  /* ---------- Payslip: download feedback --------------------------------- */
  function initPayslip() {
    var btn = $('#btnPdf');
    if (!btn) return;
    btn.addEventListener('click', function () {
      btn.setAttribute('data-loading', 'true');
      setTimeout(function () {
        btn.removeAttribute('data-loading');
        btn.innerHTML = '<span class="ico ico-check ico--sm" aria-hidden="true"></span>Slip gaji tersimpan';
        setTimeout(function () {
          btn.innerHTML = '<span class="ico ico-down ico--sm" aria-hidden="true"></span>Unduh PDF';
        }, 2400);
      }, 800);
    });
  }

  /* ---------- Viewer (index.html) --------------------------------------- */
  function initViewer() {
    var frame = $('#frame');
    if (!frame) return;
    var box = $('#frameBox');
    var tabs = $$('[data-page]');
    var label = $('#nowShowing');

    function select(btn) {
      tabs.forEach(function (t) {
        var on = t === btn;
        t.className = 'btn btn--sm ' + (on ? 'btn--cap' : 'btn--garis');
        t.setAttribute('aria-current', on ? 'page' : 'false');
      });
      frame.src = btn.getAttribute('data-page');
      if (label) label.textContent = btn.getAttribute('data-title');
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { select(t); }); });

    $$('[data-vp]').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-vp]').forEach(function (o) {
          var on = o === b;
          o.className = 'btn btn--sm ' + (on ? 'btn--cap' : 'btn--garis');
          o.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        var w = b.getAttribute('data-vp');
        box.style.width = w === 'full' ? '100%' : w + 'px';
      });
    });
    var start = tabs.filter(function (t) { return t.hasAttribute('data-default'); })[0] || tabs[0];
    select(start);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDrawer();
    initPwToggle();
    initSignIn();
    initWizard();
    initPayroll();
    initClock();
    initDirectory();
    initPayslip();
    initViewer();
  });
})();
