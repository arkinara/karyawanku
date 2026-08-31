# KaryawanKu — Backend API

Backend untuk KaryawanKu: API-only **Node.js + Fastify** dengan **SQLite** (better-sqlite3), **Drizzle ORM**, auth email/password (bcryptjs + JWT), dan validasi **zod**.

## Persyaratan

- Node.js ≥ 22

## Setup

```bash
npm install
cp .env.example .env
```

Sesuaikan nilai di `.env` (wajib isi `JWT_SECRET`).

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan server dev dengan hot-reload (tsx watch) |
| `npm run build` | Kompilasi TypeScript ke `dist/` |
| `npm start` | Jalankan hasil build |
| `npm run db:migrate` | Terapkan skema ke DB (`drizzle-kit push`) — **wajib dijalankan eksplisit, tidak otomatis saat boot** |
| `npm run db:seed` | Isi data demo (1 bisnis + 4 user: owner, manager, 2 karyawan) |
| `npm test` | Jalankan test (vitest) |

> **Migrasi & boot (ticket #46):** server **tidak** menjalankan migrasi otomatis saat start.
> Skema diterapkan hanya lewat `npm run db:migrate` (deploy step). Untuk convenience dev/test,
> set `MIGRATE_ON_BOOT=1` agar `boot()` menjalankan `migrate()` dulu. Saat start, server
> memeriksa skema: bila tabel belum ada, di produksi (`NODE_ENV=production`) gagal cepat dengan
> pesan jelas, di non-produksi hanya menulis peringatan.

## Struktur

```
src/
  index.ts        # entry: boot() — migrasi hanya bila MIGRATE_ON_BOOT=1, lalu start server
  app.ts          # build Fastify app (helmet, CORS allowlist, rate limit, body limits, error handler)
  db/
    schema.ts     # tabel businesses, users, sessions, password_resets, employees + scaffold (cuti, shift, absensi, payroll)
    index.ts      # koneksi DB
    migrate.ts    # drizzle-kit push
    seed.ts       # data demo
  lib/
    capabilities.ts # matriks capability per peran (ticket #49) + hasCapability + export frontend
    auth.ts            # hash/verify password, JWT, requireAuth/requireOwner/requireCapability
    errors.ts          # ApiError + turunannya
    attendance-status.ts # hitung status hadir/telat + late_minutes dari jam shift
  routes/
    auth.ts            # POST sign-up/sign-in/sign-out/sign-out-all/refresh, GET me
    password-reset.ts  # POST forgot-password / reset-password
    businesses.ts      # POST onboarding signup (bisnis + owner) + GET/PATCH profil bisnis (owner)
    business-default-components.ts # GET/PUT komponen gaji default per bisnis (owner)
    users.ts           # CRUD user (users.manage; penugasan role manager/owner hanya owner)
    employees.ts       # CRUD karyawan (owner / self)
    employees-import.ts # import CSV: preview + commit
    salary-components.ts   # CRUD komponen gaji + preview formula
    salary-assignments.ts  # penugasan komponen gaji ke karyawan
    attendance.ts      # clock-in/out, list, aggregate bulanan, manual (attendance.manage)
    leave-types.ts     # jenis cuti: READ semua role dalam bisnis, WRITE owner-only + seed default
    leave-balances.ts  # saldo cuti per karyawan/tahun + reset tahunan
    leave-requests.ts  # pengajuan cuti (karyawan) + approve/reject (leave.approve)
    shifts.ts          # CRUD shift template (roster.publish, business-scoped, soft-delete)
    shift-assignments.ts # penugasan shift per karyawan/tanggal + upcoming 3 hari
    roster-publish.ts  # publish/unpublish roster shift secara batch (roster.publish)
    payroll-runs.ts    # buat run payroll draft + hitung gaji/BPJS/PPh21 per karyawan + koreksi/approve/lock
    thr.ts             # hitung THR + catat pencairan (Permenaker 6/2016) — calculate/disburse/payments
    payslips.ts        # daftar & unduh slip gaji PDF (owner semua, karyawan miliknya)
    payroll-export.ts  # ekspor rekap payroll ke CSV / XLSX (owner)
    dashboard.ts       # GET /dashboard — agregasi quick dashboard sesuai role (owner tim, employee diri sendiri)
    audit-logs.ts      # GET /audit-logs — riwayat audit append-only, owner-only, read-only (ticket #57)
  lib/
    auth.ts            # hash/verify password, JWT (access+refresh), sesi revocable, requireAuth/requireOwner/requireCapability
    errors.ts          # ApiError + turunannya
    audit.ts           # recordAudit(...): satu-satunya jalur tulis audit_logs + redaksi field sensitif (ticket #57)
    attendance-status.ts # hitung status hadir/telat + late_minutes dari jam shift
    overtime.ts      # hitung lembur murni: clock-out vs jam selesai shift + grace, override (ticket #54)
    bpjs.ts            # kalkulasi BPJS Kesehatan + Ketenagakerjaan dari gaji pokok
    pph21.ts           # kalkulasi PPh21 progresif (PTKP + lapisan tarif)
    thr.ts             # kalkulasi THR murni (Permenaker 6/2016) — masa kerja + basis upah tetap
    payroll.ts         # engine komputasi payroll per karyawan (gaji/BPJS/PPh21/take-home)
    payslip-breakdown.ts # komposisi breakdown slip gaji (earnings/deductions/totals) dari detail_breakdown
    payslip-pdf.ts     # generator PDF slip gaji (pdfkit) → Buffer
    payslip-store.ts   # simpan/baca file PDF slip gaji di filesystem
    payslip-generator.ts # buat record payslips + generate PDF untuk seluruh item satu run
tests/            # vitest: auth, sessions, refresh, forgot-password, businesses, business-default-components, users, employees, employees-import, schema, salary-components, salary-assignments, attendance-*, leave-*, shifts, shift-assignments, roster-publish, payroll-runs, payroll-approval, payslips, payroll-export, audit-log, overtime, thr, bpjs, pph21
drizzle/          # file migrasi SQL (generated)
data/             # file DB lokal (git-ignored) + data/payslips/ (PDF slip gaji, git-ignored)
```

## Kontrak pagination (ticket #58)

Semua list endpoint memakai kontrak pagination yang sama, **page-based** (bukan cursor/offset), agar frontend cukup mengimplementasikannya sekali.

**Parameter query** (keduanya opsional):

| Param | Default | Maks | Keterangan |
|---|---|---|---|
| `page` | `1` | — | Halaman, 1-indexed |
| `limit` | `20` | `100` | Ukuran halaman; nilai > 100 di-clamp ke 100 |

Nilai `page`/`limit` yang invalid (negatif, nol, non-numerik, bukan integer) di-fallback ke default secara diam-diam — tidak ada error. Helper bersama `src/lib/pagination.ts` (`parsePagination`, `paginateResult`, `offsetOf`) dipakai semua rute.

**Envelope respons** untuk semua list endpoint:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "has_more": false
}
```

- `total` = jumlah baris yang cocok setelah filter (bukan ukuran halaman).
- `has_more` = `page * limit < total` (masih ada halaman berikutnya).
- Urutan selalu deterministik: kolom sort default + **tiebreaker id** (`ASC`/`DESC`) sehingga tidak ada baris yang melompat/duplikat antar halaman.

**Sort default per endpoint:**

| Endpoint | Sort default |
|---|---|
| `GET /api/employees` | `nama_lengkap` ASC |
| `GET /api/users` | `nama` ASC |
| `GET /api/payslips`, `/api/payslips/employee/:employeeId` | `created_at` DESC |
| `GET /api/attendance/employee/:employeeId` | `tanggal` DESC |
| `GET /api/leave-requests` | `created_at` DESC |
| `GET /api/shift-assignments` | `tanggal` DESC |

Filter tetap berjalan di SQL (bukan JS setelah fetch penuh). Endpoint yang TIDAK di-paginasi: `GET /api/leave-types` dan `GET /api/leave-balances` (dataset kecil tetap), `GET /api/shift-assignments/upcoming` (jendela 3 hari, tetap `assignments`), `GET /api/audit-logs` (pakai kontrak `limit`/`offset` sendiri, ticket #57), dan seluruh endpoint ekspor (CSV/XLSX, payroll-runs) yang membaca langsung dari DB tanpa batas.

## Endpoint

Prefix: `/api`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/auth/sign-up` | — | Buat bisnis + owner dalam satu transaksi, balas `{ user, token, refreshToken }`. Email unik secara global (duplikat di bisnis mana pun → 409, tanpa baris yatim) |
| POST | `/auth/sign-in` | — | Masuk, balas `{ user, token, refreshToken }` |
| POST | `/auth/sign-out` | Bearer | Cabut sesi saat ini (set `revoked_at`), balas `{ ok: true }`; token lama langsung 401 |
| POST | `/auth/sign-out-all` | Bearer | Cabut semua sesi user (semua perangkat), balas `{ ok: true, sessions_revoked: N }` |
| POST | `/auth/refresh` | — | Tukar `{ refresh_token }` dengan access + refresh baru; sesi lama dicabut (rotasi). Refresh token bekas / sudah dicabut → 401 |
| GET | `/auth/me` | Bearer | User saat ini (hanya access token) + `capabilities` (capability peran user) + `role_capabilities` (matriks lengkap untuk frontend) |
| POST | `/auth/forgot-password` | — | Body `{ email }`, buat token reset sekali pakai (hash sha256, kedaluwarsa 1 jam). Pengiriman email di luar scope — tautan dicatat ke log server. Respons generik sama untuk email terdaftar/tdk (anti-enumerasi). Rate limit 3×/jam/email |
| POST | `/auth/reset-password` | — | Body `{ token, password }`, validasi token, set hash baru, tandai token terpakai, cabut semua sesi user. Token bekas/kedaluwarsa → 400 |
| POST | `/businesses` | — | **Signup onboarding (disarankan untuk Owner baru):** buat bisnis + user pertama (role=owner) dalam satu transaksi, balas `{ user, token, refreshToken, business }`. Body: `{ nama_bisnis, jenis_usaha: 'fnb'|'jasa', alamat, owner: { nama, email, password } }`. Email unik secara global (duplikat → 409), password minimal 8 karakter |
| GET | `/businesses/:id` | Owner | Profil bisnis (hanya bisnis milik caller; bisnis lain → 403) |
| PATCH | `/businesses/:id` | Owner | Update subset `{ nama_bisnis?, jenis_usaha?, alamat? }`, balas business terbaru |
| GET | `/users?page=&limit=` | users.manage | Daftar user (scoped bisnis) |
| POST | `/users` | users.manage | Buat user. Penetapan role `manager`/`owner` hanya oleh owner (non-owner → 403) |
| PATCH | `/users/:id` | users.manage | Update user (role/employee_id/status). Ubah role hanya oleh owner; status user manager/owner hanya oleh owner |
| DELETE | `/users/:id` | users.manage | Soft-delete user. Menonaktifkan user manager/owner hanya oleh owner |
| GET | `/employees?page=&limit=&jenis_kontrak=&status=` | Owner | Daftar karyawan (scoped bisnis, filter & paginasi, sort `nama_lengkap` ASC) |
| POST | `/employees` | Owner | Buat karyawan (validasi KTP/NPWP/umur, custom_fields JSON) |
| GET | `/employees/:id` | Owner / karyawan terkait | Detail karyawan (custom_fields ter-parse) |
| PATCH | `/employees/:id` | Owner | Update subset field + toggle status + merge custom_fields |
| DELETE | `/employees/:id` | Owner | Soft-delete (status → nonaktif) |
| POST | `/employees/import/preview` | Owner | Upload CSV (max 5 MB), kembalikan rows + detected headers + suggested mapping |
| POST | `/employees/import/commit` | Owner | Buat banyak karyawan valid sekaligus (transaksi), `{ created, skipped, errors }` |
| GET | `/salary-components?active=true&defaults=true` | Owner | Daftar komponen gaji (scoped bisnis; default termasuk nonaktif, filter `active=true`; `defaults=true` hanya komponen `is_default=true`) |
| POST | `/salary-components` | Owner | Buat komponen gaji (`nama_komponen`, `tipe`, `nominal`/`formula`, `aktif`, `is_fixed?` — `is_fixed=true` menandai tunjangan tetap yang masuk basis THR) |
| POST | `/salary-components/preview-formula` | Owner | Evaluasi formula terhadap `{ formula, variables }` → `{ result }` |
| PATCH | `/salary-components/:id` | Owner | Update subset field + toggle `aktif` / `is_fixed` (soft, tanpa hapus histori) |
| DELETE | `/salary-components/:id` | Owner | Soft-delete (set `aktif=false`) → `{ ok: true }` |
| GET | `/businesses/:id/default-salary-components` | Owner | Daftar komponen gaji default bisnis (hanya `is_default=true`, urut nama) |
| PUT | `/businesses/:id/default-salary-components` | Owner | Set komponen default: body `{ component_ids: string[] }` ATAU `{ components: [{ nama_komponen, tipe, nominal?, formula?, aktif?, is_fixed? }] }`. Tandai `is_default=true` pada yang dipilih, reset `is_default=false` pada semua komponen lain di bisnis (transaksional). `component_ids` lintas-bisnis → 400 tanpa mengubah set yang ada |
| GET | `/employees/:employeeId/salary-assignments?includeInactive=true` | Owner / karyawan terkait | Daftar penugasan komponen gaji + detail komponen (`nilai_efektif`) |
| POST | `/employees/:employeeId/salary-assignments` | Owner | Tugaskan komponen gaji ke karyawan (opsional `override_nominal`, cek duplikat aktif → 409) |
| PATCH | `/salary-assignments/:id` | Owner | Update `override_nominal` / toggle `aktif` |
| DELETE | `/salary-assignments/:id` | Owner | Soft-delete penugasan (set `aktif=false`) → `{ ok: true }` |
| POST | `/attendance/clock-in` | Karyawan / Owner | Clock-in: `{ employee_id?, catatan?, client_timestamp?, submission_method? }`, hitung status + late_minutes otomatis dari shift. Waktu otoritatif = jam server (ticket #59) |
| POST | `/attendance/clock-out` | Karyawan / Owner | Clock-out: `{ employee_id?, client_timestamp?, submission_method? }`, catat waktu keluar (jam server) + turunkan `overtime_minutes` dari clock-out melebihi jam selesai shift (+15 mnt grace, default; ticket #54) |
| GET | `/attendance/today` | Karyawan / Owner | Absensi hari ini milik user |
| GET | `/attendance/employee/:employeeId?start=&end=&page=&limit=` | Owner / karyawan terkait | Daftar absensi (filter rentang tanggal, sort `tanggal` DESC) |
| GET | `/attendance/aggregate/:employeeId?period=YYYY-MM` | Owner / karyawan terkait | Rekap bulanan `{ hadir, telat, absen, izin, total_late_minutes, total_overtime_minutes }` |
| POST | `/attendance/manual` | attendance.manage | Entri/koreksi manual (upsert by `employee_id`+`tanggal`); owner & manager. Menerima `overtime_minutes` (0–720), ditolak untuk hari `absen` |
| PATCH | `/attendance/:id` | attendance.manage | Koreksi subset field catatan absensi; owner & manager. Menerima `overtime_override_minutes` (0–720, `null` untuk kembali ke nilai turunan) yang menang atas turunan |
| GET | `/leave-types` | Semua role dalam bisnis | Daftar jenis cuti (seed default otomatis: Tahunan 12/carry-over 5, Sakit 5, Izin 3, Melahirkan 90). **READ** terbuka untuk semua user terautentikasi dalam bisnis (owner/manager/employee); **WRITE** (POST/PATCH/DELETE) owner-only. Bisnis di token tidak dikenal → 404 (ticket #56) |
| POST | `/leave-types` | Owner | Buat jenis cuti (`nama_jenis_cuti`, `default_kuota_hari`, `kebijakan_sisa`, `carry_over_max_days`) |
| PATCH | `/leave-types/:id` | Owner | Update subset field jenis cuti |
| DELETE | `/leave-types/:id` | Owner | Soft-delete jenis cuti (set `aktif=false`) → `{ ok: true }` |
| GET | `/leave-balances?employee_id=&tahun=` | Owner / karyawan terkait | Saldo cuti per tahun (auto-create bila belum ada); employee hanya saldo sendiri |
| PATCH | `/leave-balances/:id` | Owner | Penyesuaian saldo (`kuota_hari` / `terpakai_hari`) |
| POST | `/admin/leave-reset` | Owner | Reset tahunan saldo cuti manual/backfill (`{ tahun? }`), idempoten, carry-over/hangus per kebijakan. Tetap owner-only; reset otomatis berjalan saat server start (ticket #56) |
| POST | `/leave-requests` | Karyawan / Owner | Ajukan cuti (`leave_type_id`, `tanggal_mulai`, `tanggal_selesai`, `alasan`), status default `pending`, divalidasi vs sisa kuota |
| GET | `/leave-requests?status=&employee_id=&page=&limit=` | Owner / Karyawan | Riwayat pengajuan cuti (owner semua di bisnis; karyawan milik sendiri) |
| GET | `/leave-requests/:id` | Owner / karyawan terkait | Detail pengajuan cuti |
| PATCH | `/leave-requests/:id/approve` | leave.approve | Setujui cuti (status → `disetujui`, tambah `terpakai_hari`, catat approver). Manager tidak bisa menyetujui cutinya sendiri |
| PATCH | `/leave-requests/:id/reject` | leave.approve | Tolak cuti (status → `ditolak`, tanpa ubah saldo) |
| GET | `/shifts?includeInactive=true` | roster.publish | Daftar shift template (scoped bisnis; default aktif saja) |
| POST | `/shifts` | roster.publish | Buat shift (`nama_shift` Pagi/Siang/Malam/Libur, `jam_mulai`, `jam_selesai`, `aktif?`); `jam_selesai` tidak boleh lebih awal dari `jam_mulai` |
| PATCH | `/shifts/:id` | roster.publish | Update subset field shift |
| DELETE | `/shifts/:id` | roster.publish | Soft-delete shift (set `aktif=false`); assignment lama tetap mereferensikan shift ini |
| GET | `/shift-assignments?start=&end=&employee_id=&page=&limit=` | Owner / Karyawan | Daftar penugasan shift dalam rentang (owner semua di bisnis + optional filter; karyawan hanya milik sendiri DAN hanya `published=true`) |
| POST | `/shift-assignments` | roster.publish | Tugaskan shift ke karyawan pada tanggal (`published` default `false`); validasi shift + karyawan di bisnis yang sama |
| PATCH | `/shift-assignments/:id` | roster.publish | Update subset field penugasan (validasi silang bisnis bila ganti shift/karyawan) |
| DELETE | `/shift-assignments/:id` | roster.publish | Hapus penugasan shift (hard delete) → `{ ok: true }` |
| GET | `/shift-assignments/upcoming` | Owner / Karyawan | Jadwal 3 hari ke depan, hanya `published=true` (owner bisnis-wide, karyawan milik sendiri) |
| POST | `/roster/publish` | roster.publish | Publish batch roster: body `{ assignment_ids: [] }` ATAU `{ start, end, employee_ids? }`; set `published=true` + catat `published_at` & `published_by_user_id`; balas `{ updated, published_at, published_by_user_id }`. Publish ulang = no-op |
| POST | `/roster/unpublish` | roster.publish | Kembalikan `published=false` untuk koreksi owner/manager (field audit dipertahankan) |
| POST | `/payroll-runs` | Owner | Buat run payroll draft: body `{ periode: 'YYYY-MM' }`, auto-buat `payroll_items` utk tiap karyawan `status=aktif`, hitung gaji pokok/tunjangan/BPJS/PPh21/take-home + `detail_breakdown` JSON. Duplikat periode → 409. Balas `{ run, items }` |
| GET | `/payroll-runs?periode=` | Owner | Daftar run payroll di bisnis (opsional filter `periode`) |
| GET | `/payroll-runs/:id` | Owner / karyawan terkait | Detail run + item; owner lihat semua, karyawan hanya item miliknya |
| PATCH | `/payroll-items/:id` | Owner | Koreksi item payroll saat `status=draft`: body `{ koreksi, catatan_koreksi? }`; `koreksi` ditambahkan ke `take_home`. Setelah approve/lock → 409 |
| POST | `/payroll-runs/:id/approve` | Owner | Setujui run: `draft → disetujui`, set `approved_at` + `approved_by_user_id`, generate slip PDF per item. Re-approve → 409 (tanpa duplikasi payslip) |
| POST | `/payroll-runs/:id/lock` | Owner | Kunci run setelah disetujui (`disetujui → locked`), menolak semua edit lanjutan |
| GET | `/payslips?page=&limit=` | Owner / Karyawan | Daftar slip gaji (owner semua di bisnis; karyawan hanya miliknya) |
| GET | `/payslips/employee/:employeeId?page=&limit=` | Owner / Karyawan terkait | Daftar slip gaji karyawan tertentu (owner bebas; karyawan hanya diri sendiri) |
| GET | `/payslips/:id` | Owner / Karyawan terkait | Detail slip gaji + breakdown inline: `{ id, payroll_item_id, employee, periode, breakdown: { earnings[], deductions[] }, totals, pdf_url }`. Breakdown disusun dari `payroll_items.detail_breakdown` (earning/deduction lines) + komponen BPJS/PPh21; total_earnings − total_deductions = take_home (toleransi ±1 IDR). Owner semua di bisnis; karyawan hanya miliknya; lintas-bisnis / tidak ada → 404 |
| GET | `/payslips/:id/download` | Owner / Karyawan terkait | Unduh PDF slip gaji (`Content-Type: application/pdf`, nama `slip-gaji-{nama}-{periode}.pdf`) |
| GET | `/payroll-runs/:id/export.csv` | Owner | Ekspor rekap payroll CSV (BOM UTF-8) atau XLSX (`?format=xlsx`), termasuk baris total |
| GET | `/dashboard` | Owner / Karyawan | Ringkasan quick dashboard, payload berbeda sesuai role. **Owner**: `today_attendance` (hadir/telat/absen/izin hari ini), `pending_leaves` (5 pengajuan pending terbaru + nama karyawan), `upcoming_shifts` (3 hari ke depan, published, seluruh tim), `payroll_summary` (total & take-home periode berjalan + `last_run_periode`), `metrics` (total_karyawan/total_aktif). **Employee**: `my_today` (status check-in hari ini, `null` bila belum ada), `upcoming_shifts` (3 hari ke depan, published, milik sendiri), `my_recent_payslips` (3 slip terakhir, terbaru dulu). Semua query di-scope server-side (`business_id`/`employee_id` dari token); employee tidak bisa memfilter via `?employee_id=` (403) |
| GET | `/audit-logs?entity_type=&entity_id=&actor_user_id=&start=&end=&limit=&offset=` | Owner | Riwayat audit (append-only, ticket #57) bisnis caller, terbaru dulu. Filter: `entity_type`, `entity_id`, `actor_user_id`, rentang `start`/`end` (YYYY-MM-DD). Paginasi `limit` (default 50, clamp maks 100) + `offset`. Balas `{ logs: [{ id, actor: { id, nama, email }, action, entity_type, entity_id, before, after, created_at }], total, limit, offset }`. Manager/karyawan → 403. **Tidak ada rute update/delete** |
| POST | `/thr/calculate` | Bearer | Hitung THR (pratinjau, tanpa menulis): body `{ employee_id, periode: 'YYYY', tanggal_bayar: 'YYYY-MM-DD' }` → `{ employee, calculation, disbursement_preview }`. Karyawan harus di bisnis caller (lain → 404) |
| POST | `/thr/disburse` | payroll.run | Catat pencairan THR: body sama, menulis baris `thr_payments` + audit `thr.disburse`. Idempoten — duplikat `(employee_id, periode)` → 409 |
| GET | `/thr/payments?periode=YYYY` | Bearer | Daftar pencairan THR bisnis caller (opsional filter `periode`), urut periode + nama karyawan. Semua role bisa membaca |
| GET | `/thr/payments/:id` | Bearer | Detail satu pembayaran THR (scoped bisnis; lain → 404) |

Catatan absensi: status `hadir`/`telat` dihitung otomatis dari `jam_mulai` shift (shift_assignments) saat clock-in, fallback `08:00` bila tak ada shift. Owner boleh clock-in/out atas nama karyawan lain via `employee_id`; employee hanya untuk dirinya sendiri.

Catatan lembur (ticket #54): lembur diturunkan saat clock-out dari selisih clock-out terhadap `jam_selesai` shift (shift_assignments; fallback `16:00` bila tak ada shift) dikurangi grace 15 menit (konstanta `DEFAULT_GRACE_MINUTES` di `src/lib/overtime.ts`). Shift lintas tengah malam (jam_selesai < jam_mulai, mis. Malam 22:00–06:00) ditangani: clock-out sebelum jam selesai berikutnya → 0 lembur. Hasil turunan disimpan di `attendance_records.overtime_minutes`; owner/manager dapat meng-override via `PATCH /api/attendance/:id` dengan `overtime_override_minutes` (0–720) yang menang atas nilai turunan, atau `null` untuk kembali ke turunan. Entri manual menerima `overtime_minutes` (0–720); nilai di luar batas ditolak 422 dan lembur tidak bisa dicatat untuk hari `absen`. Lembur dijumlahkan di aggregate bulanan sebagai `total_overtime_minutes`.

Catatan integritas absensi (ticket #59): `clock_in`/`clock_out` yang tersimpan adalah **jam server** (`Date.now()` saat request diproses) — bukan waktu yang dikirim klien. Waktu dari klien (`client_timestamp`) disimpan terpisah sebagai klaim di `client_claim_at` (clock-in) / `clock_out_client_claim_at` (clock-out) dan **tidak pernah** menjadi waktu otoritatif. Toleransi selisih klaim vs jam server adalah konstanta bernama `TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000` (5 menit) di `src/routes/attendance.ts`. Klaim di masa depan melebihi toleransi ditolak 422; klaim `live` yang meleset ke masa lalu melebihi toleransi **diterima tapi ditandai** `time_drift_detected = true` untuk review, dan dicatat ke audit log dengan aksi `attendance.time_drift`. Antrian offline tetap berfungsi: flush `submission_method = 'offline_queue'` mempertahankan waktu aksi asli klien sebagai `clock_in`/`clock_out` (karena itu durasi offline yang sah) dan tidak ditandai drift. Guard identitas: employee yang mengirim `employee_id` selain miliknya ditolak 403 dan percobaannya dicatat ke audit log (`attendance.impersonation.blocked`); owner/manager (dengan `attendance.manage`) boleh mencatat untuk karyawan mana pun di bisnisnya. Entri/koreksi manual (`POST /api/attendance/manual`, `PATCH /api/attendance/:id`) tetap hanya untuk `attendance.manage` dan memakai waktu yang ditentukan owner/manual — tidak ada jalur `client_timestamp`. Lokasi belum diimplementasikan (tiket terpisah).

Catatan cuti: saldo cuti dibuat otomatis saat pertama kali di-query per tahun. Kuota cuti tahunan mengikuti UU Cipta Kerja — masa kerja ≥ 1 tahun mendapat `default_kuota_hari` penuh (12), masa kerja < 1 tahun diprorata (`default_kuota_hari × bulan kerja / 12`). Sisa tahun lalu dipindah ke tahun baru bila `kebijakan_sisa='carry-over'` (maks `carry_over_max_days`), hangus bila `hangus`.

Kontrak otorisasi jenis cuti (ticket #56): **READ** (`GET /api/leave-types`) terbuka untuk **semua user terautentikasi dalam bisnis** — owner, manager, dan employee (employee membutuhkan jenis cuti untuk mengisi formulir pengajuan). **WRITE** (`POST`, `PATCH`, `DELETE /api/leave-types`) tetap **owner-only**. Seed default (`ensureLeaveTypesSeeded`) di-scope ke `business_id` caller, tidak pernah men-seed jenis cuti global ke bisnis lain; bila `business_id` di token tidak merujuk ke bisnis yang dikenal, `GET` menolak dengan 404. Kolom `leave_requests.tanggal_selesi` (typo) telah di-rename menjadi `tanggal_selesai` (migrasi `0014_rename-tanggal-selesi.sql`) — seluruh route, respons API, test, dan frontend memakai nama baru.

Reset tahunan terjadwal (ticket #56): `POST /api/admin/leave-reset` tetap tersedia sebagai pemicu manual/backfill dan owner-only. Selain itu, `runYearlyResetIfNeeded` dijalankan **otomatis saat server start** (hook di `src/index.ts`): ia memeriksa tabel key-value `system_state` untuk key `last_leave_reset_year`. Belum ada baris → catat tahun berjalan lalu jalankan reset untuk semua bisnis; baris ada dengan tahun sama → tidak melakukan apa-apa (idempoten, aman dijalankan berulang); baris ada dengan tahun lama → tahun berganti, jalankan reset untuk tahun baru. `runYearlyReset` sendiri idempoten (baris saldo yang sudah ada tidak dibuat ulang), dan hasil per bisnis (`created`/`skipped`) dicatat ke log server agar bisa diinspeksi. Key `last_thr_reset_year` dicadangkan di `system_state` untuk proses THR berkala.

Catatan payroll: `POST /api/payroll-runs` membuat satu run `status=draft` per `(business_id, periode)` (duplikat → 409). Hanya karyawan `status=aktif` yang diikutkan. Per karyawan: `gaji_pokok` = jumlah komponen earning bernama "Gaji Pokok"; `total_tunjangan` = jumlah komponen earning lain (pakai `override_nominal` bila ada, formula dievaluasi — formula tak terselesaikan membuat run gagal dgn pesan jelas); `total_bpjs_kesehatan` = 1% gaji pokok; `total_bpjs_tk` = JHT 2% + JP 1%; `pph21` = PPh21 progresif bulanan dari gross tahunan (12×gross bulanan); `take_home` = gross − (BPJS + PPh21). Seluruh sub-kalkulasi tersimpan di kolom `payroll_items.detail_breakdown` (JSON). `employees.ptkp_status` (TK/0, K/0, K/1, K/2, K/3; nullable) menentukan PTKP PPh21; bila kosong default TK/0 dgn penanda di breakdown.

Variabel formula (ticket #54): selain `hadir`/`telat`/`absen`/`izin`, formula komponen gaji kini bisa memakai `jam_lembur` (total jam lembur periode = `total_overtime_minutes` / 60), `tarif_lembur` (upah lembur per jam = `(gaji_pokok / 173) × 1.5`, sesuai UU Cipta Kerja / Kepmenakertrans 102/2004), dan `gaji_pokok`. Contoh: komponen earning dengan formula `jam_lembur * tarif_lembur`. Variabel yang diizinkan `validateFormula` (lihat `SAMPLE_SALARY_VARIABLES` di `src/lib/formula.ts`) kini ter-resolve di payroll run — `jam_kerja` belum tersedia di runtime (di luar scope ticket ini).

Catatan persetujuan & slip gaji: `PATCH /api/payroll-items/:id` memungkinkan Owner mengoreksi item saat run `status=draft` (nilai `koreksi` ditambahkan ke `take_home`); setelah approve/lock semua edit ditolak 409. `POST /api/payroll-runs/:id/approve` memindahkan run ke `disetujui`, mencatat `approved_at` + `approved_by_user_id`, lalu otomatis membuat satu record `payslips` per item dan men-generate PDF slip gaji (pdfkit) yang disimpan di `backend/data/payslips/{payslip_id}.pdf` (lokasi bisa di-override via env `PAYSLIP_DIR`); `pdf_url` disimpan di DB. Re-approve idempoten — tidak menduplikasi payslip. `POST /api/payroll-runs/:id/lock` mengunci run setelah disetujui. `GET /api/payslips*` scoped: Owner melihat semua di bisnis, karyawan hanya miliknya. `GET /api/payslips/:id` mengembalikan breakdown inline (earnings/deductions dengan `nama_komponen`, `nominal`, `formula`) yang disusun dari `detail_breakdown` + komponen BPJS/PPh21; PDF slip gaji merender bagian Pendapatan & Potongan per komponen sebelum take-home (maks 10 baris per bagian, sisanya diringkas "+N komponen lainnya"). `GET /api/payroll-runs/:id/export.csv` (owner) menghasilkan CSV UTF-8 (BOM) berisi Nama, NIP/ID, Gaji Pokok, Total Tunjangan, BPJS Kesehatan (employee), BPJS Ketenagakerjaan (employee), PPh 21, Koreksi, Take-Home plus baris total; `?format=xlsx` menghasilkan file XLSX (exceljs).

Catatan: saat `POST/PATCH /users` mengirim `employee_id`, sistem memvalidasi karyawan tsb ada di bisnis yang sama.

Catatan THR (ticket #55, Permenaker 6/2016): THR Keagamaan wajib dibayarkan setahun sekali menjelang hari raya keagamaan, paling lambat 7 hari sebelumnya. Basis upah = gaji pokok + tunjangan tetap (`salary_components.is_fixed = true`); tunjangan variabel/tidak tetap tidak dihitung. Karyawan masa kerja ≥ 12 bulan menerima 1× basis upah; masa kerja 1–11 bulan diprorata (`upah × bulan / 12`, dibulatkan ke rupiah penuh); < 1 bulan tidak berhak (0). `POST /api/thr/calculate` hanya pratinjau; `POST /api/thr/disburse` (butuh capability `payroll.run` = owner) menulis baris `thr_payments` dan mencatat audit `thr.disburse` dalam satu transaksi. Unik constraint `(employee_id, periode)` mencegah pembayaran ganda per tahun (duplikat → 409). Masa kerja dihitung dari `employees.tanggal_masuk` terhadap `tanggal_bayar`; tanggal masuk null/valid tapi di masa depan → 0. Pembayaran tercatat, bukan transfer uang (eksekusi bank di luar scope). `GET /api/thr/payments*` bisa dibaca semua role dalam bisnisnya.

Catatan audit (ticket #57): setiap perubahan consequential pada payroll (buat run, koreksi item, approve, lock), komponen & penugasan gaji, absensi manual/koreksi, keputusan cuti (approve/reject), mutasi role/status user, dan pengaturan bisnis dicatat ke tabel append-only `audit_logs` lewat satu helper `src/lib/audit.ts` (`recordAudit(...)`). Actor diambil dari sesi terautentikasi (JWT), **bukan** dari body request; `before`/`after` menyimpan snapshot JSON dengan field sensitif (password hash, token/jti/refresh, secret) otomatis diredaksi menjadi `[redacted]`. Perubahan dan baris audit-nya ditulis dalam transaksi yang sama sehingga atomik — gagal satu, batal keduanya. Tidak ada rute API yang mengubah/menghapus baris audit, dan helper-nya memperingatkan agar tidak pernah backdate/edit. Pembaca: `GET /api/audit-logs` (owner-only).

## Keamanan (ticket #46)

### Rotasi JWT_SECRET

`JWT_SECRET` menandatangani seluruh access + refresh token (HS256). Server **menolak start** bila
`JWT_SECRET` kosong atau lebih pendek dari 32 karakter (lihat `backend/.env.example`).

**Rotasi nilai `JWT_SECRET` membatalkan SEMUA token yang masih beredar** — setiap user harus login
ulang (refresh token lama pun 401 karena tanda tangannya berubah). Langkah rotasi aman:

1. Generate secret baru: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. Update `JWT_SECRET` di environment (Vault / env penyedia hosting), bukan di repo.
3. Restart server. Token lama otomatis tidak valid.

> Jangan pernah commit `.env` (sudah di-`.gitignore`, bersama `.env.*` kecuali `.env.example`).

### CORS allowlist

`origin: true` diganti dengan allowlist dari env `ALLOWED_ORIGINS` (comma-separated, tanpa spasi).
Default bila env kosong: `http://localhost:3000`. Origin di luar allowlist ditolak dengan `403
{ error: { message: 'Asal (origin) tidak diizinkan.' } }`. Request non-browser (tanpa header
`Origin`) tetap dilayani tanpa header CORS.

```
ALLOWED_ORIGINS=https://app.karyawanku.id,http://localhost:3000
```

### Rate limit

`@fastify/rate-limit` (in-memory, per IP). Hanya endpoint auth yang dibatasi:

| Endpoint | Default | Override env |
|---|---|---|
| `POST /api/auth/sign-in` | 5 percobaan / 60 dtk / IP | `RATE_LIMIT_SIGNIN_MAX`, `RATE_LIMIT_SIGNIN_WINDOW_MS` |
| `POST /api/auth/sign-up` | 3 percobaan / 60 dtk / IP | `RATE_LIMIT_SIGNUP_MAX`, `RATE_LIMIT_SIGNUP_WINDOW_MS` |

Saat batas tercapai: `429 { "error": "rate_limited", "message": "Terlalu banyak permintaan. Silakan coba lagi nanti." }`.
Rate limit dijalankan sebelum validasi kredensial, sehingga tidak membocorkan keberadaan email.
Endpoint lain tidak dibatasi (skip). Sisi admin/forgot-password memakai counter in-memory sendiri.

### Helmet

`@fastify/helmet` dengan konfigurasi sesuai JSON API: **CSP dimatikan** (`contentSecurityPolicy:
false`), `X-Frame-Options: DENY` (`frameguard: { action: 'deny' }`), plus default lain (HSTS,
`X-Content-Type-Options: nosniff`, dst). Semua respons API mendapat header ini.

### Body size limits

| Tipe | Default | Override env |
|---|---|---|
| JSON (`application/json`) | 1 MB | `BODY_JSON_LIMIT` (byte) |
| Multipart / upload | 10 MB | `BODY_MULTIPART_LIMIT` (byte) |

Body JSON yang melebihi batas → `413 { error: { message: 'Ukuran badan permintaan melebihi batas' } }`.

## Kode status

- `400` validasi / aturan bisnis (mis. demote diri sendiri)
- `401` kredensial/sesi tidak valid
- `403` bukan owner / peran tidak memiliki capability yang diminta
- `404` sumber daya tidak ditemukan
- `409` email duplikat secara global
- `422` nilai role/status tidak valid
- `429` rate limit (forgot/reset-password) tercapai
- `500` kesalahan server

Semua pesan error dalam Bahasa Indonesia, format `{ error: { message } }`.

## Peran & matriks capability (ticket #49)

Tiga peran: `owner`, `manager`, `employee`. Matriks dideklarasikan satu kali di `src/lib/capabilities.ts` dan dipakai semua guard rute via `requireCapability(...)` — bukan perbandingan `role` per handler. Kolom `users.role` di SQLite adalah TEXT biasa (drizzle enum = type-level), sehingga migrasi `drizzle/0009_add-manager-role.sql` hanya pre-flight validasi dan **tidak mengubah role baris yang ada** (employee tetap employee).

| Capability | owner | manager | employee |
|---|---|---|---|
| `attendance.manage` (entri/koreksi absensi manual) | ✅ | ✅ | — |
| `leave.approve` (setujui/tolak cuti) | ✅ | ✅ | — |
| `roster.publish` (kelola shift + publish roster) | ✅ | ✅ | — |
| `payroll.run` (buat run payroll) | ✅ | — | — |
| `payroll.approve` (setujui/lock payroll) | ✅ | — | — |
| `employees.write` | ✅ | ✅ | — |
| `salary.write` (komponen & penugasan gaji) | ✅ | — | — |
| `settings.write` (profil bisnis, default komponen, jenis cuti) | ✅ | — | — |
| `users.manage` (kelola user; role manager/owner hanya owner) | ✅ | ✅ | — |

Aturan tambahan:
- Manager hanya bisa mengelola akun ber-role `employee`; menetapkan/menurunkan/menonaktifkan `manager`/`owner` → 403.
- Manager tidak dapat menyetujui/menolak cuti miliknya sendiri.
- Semua aksi manager di-scope ke `business_id`-nya sendiri (divalidasi server-side, bukan dari body).
- Payroll, salary components/assignments, settings bisnis, pencairan THR (`payroll.run`), dan manage role tetap owner-only.

`GET /api/auth/me` mengekspos `capabilities` (capability user saat ini) dan `role_capabilities` (matriks penuh) sehingga frontend bisa menurunkan gating-nya dari sumber yang sama.

## Catatan auth

- **Flow signup Owner**: `POST /api/businesses` adalah endpoint yang disarankan untuk Owner baru (membuat workspace bisnis + owner dalam satu transaksi, email unik secara global, password minimal 8 karakter). `POST /api/auth/sign-up` tetap ada untuk kompatibilitas & pembuatan user tambahan, dan kini menegakkan aturan yang sama.
- Password di-hash dengan bcryptjs (tidak pernah dikirim balik; semua respons user membuang `password_hash`).
- **Sesi & token revocable**: tiap sign-in membuat baris di tabel `sessions` (id, user_id, `jti`, `issued_at`, `expires_at`, `revoked_at`, `user_agent`, `ip`). JWT HS256 membawa klaim `jti` (id token/sesi) + `sid` (id baris sesi). **Access token** kedaluwarsa 1 jam (override via env `ACCESS_TOKEN_TTL_SECONDS`); **refresh token** 7 hari (sama dengan umur sesi). Keduanya dikirim via header `Authorization: Bearer <access_token>`. `GET /api/auth/me` dan semua guard menerima access token saja.
- **Pencabutan**: `POST /auth/sign-out` mencabut sesi saat ini; `POST /auth/sign-out-all` mencabut semua sesi user. `verifyToken` menolak token yang sesinya sudah `revoked_at` ≠ null, sudah kedaluwarsa, atau milik subjek lain → 401.
- **Refresh & rotasi**: `POST /auth/refresh` menerima `{ refresh_token }`, memvalidasi sesi, lalu **mencabut sesi lama** dan menerbitkan access + refresh baru (rotasi). Refresh token yang sudah dipakai/dirotasi/dicabut → 401. Klien yang refresh berkala tetap login tanpa memasukkan ulang kredensial.
- **Deaktivasi mencabut sesi**: `PATCH /users/:id` `{ status: 'nonaktif' }` dan `DELETE /users/:id` (soft-delete) mencabut seluruh sesi user tsb; token lama langsung 401.
- **Lupa password**: `POST /auth/forgot-password` membuat token reset sekali pakai (disimpan ter-hash sha256 di tabel `password_resets`, kedaluwarsa 1 jam). Pengiriman email **di luar scope** — tautan dicatat ke log server (`console.log`, prefix `[password-reset]`); integrasi email nyata menyusul. Respons identik untuk email terdaftar vs tidak (anti-enumerasi). `POST /auth/reset-password` memvalidasi token (bekas/kedaluwarsa → 400), menegakkan policy password (min 6 karakter), menetapkan hash baru, menandai token terpakai, dan mencabut semua sesi user. Rate limit in-memory: forgot-password 3×/jam/email, reset-password 10×/jam/IP (persisten di luar scope).
- **Invariant keunikan email (global)**: `users.email` unik di seluruh tenant, dijamin oleh indeks unik DB (`users_email_unique`), bukan hanya cek aplikasi. Kedua jalur pendaftaran (`/auth/sign-up` dan `/businesses`) berbagi satu helper transaksional (`src/lib/registration.ts` → `registerBusinessAndOwner`) yang menolak 409 bila email sudah dipakai tenant lain dan tidak meninggalkan bisnis yatim. Migrasi `drizzle/0007_user-email-global-unique.sql` mengganti indeks `(business_id, email)` dengan indeks global `email`, lengkap dengan pre-flight yang membatalkan migrasi bila data lama mengandung email duplikat.
- Sign-in menyelesaikan user dari `users.email` (maks 1 baris oleh constraint), sehingga JWT `businessId` selalu milik bisnis user tersebut. Password salah → 401 pesan generik (tidak membocorkan keberadaan email); user `status='nonaktif'` tidak bisa masuk.
- Guard: tidak bisa menurunkan role diri sendiri, tidak bisa membuat bisnis tanpa owner (min. satu owner).
