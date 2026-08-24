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
| `npm run db:migrate` | Terapkan skema ke DB (`drizzle-kit push`) |
| `npm run db:seed` | Isi data demo (1 bisnis + 3 user) |
| `npm test` | Jalankan test (vitest) |

## Struktur

```
src/
  index.ts        # entry: migrate + start server
  app.ts          # build Fastify app + global error handler + log
  db/
    schema.ts     # tabel businesses, users, employees + scaffold (cuti, shift, absensi, payroll)
    index.ts      # koneksi DB
    migrate.ts    # drizzle-kit push
    seed.ts       # data demo
  lib/
    auth.ts            # hash/verify password, JWT, requireAuth/requireOwner
    errors.ts          # ApiError + turunannya
    attendance-status.ts # hitung status hadir/telat + late_minutes dari jam shift
  routes/
    auth.ts            # POST sign-up/sign-in/sign-out, GET me
    users.ts           # CRUD user (owner only)
    employees.ts       # CRUD karyawan (owner / self)
    employees-import.ts # import CSV: preview + commit
    salary-components.ts   # CRUD komponen gaji + preview formula
    salary-assignments.ts  # penugasan komponen gaji ke karyawan
    attendance.ts      # clock-in/out, list, aggregate bulanan, manual (owner)
    leave-types.ts     # CRUD jenis cuti (owner) + seed default
    leave-balances.ts  # saldo cuti per karyawan/tahun + reset tahunan
    leave-requests.ts  # pengajuan cuti (karyawan) + approve/reject (owner)
    shifts.ts          # CRUD shift template (owner, business-scoped, soft-delete)
    shift-assignments.ts # penugasan shift per karyawan/tanggal + upcoming 3 hari
    roster-publish.ts  # publish/unpublish roster shift secara batch (owner)
    payroll-runs.ts    # buat run payroll draft + hitung gaji/BPJS/PPh21 per karyawan + koreksi/approve/lock
    payslips.ts        # daftar & unduh slip gaji PDF (owner semua, karyawan miliknya)
    payroll-export.ts  # ekspor rekap payroll ke CSV / XLSX (owner)
  lib/
    auth.ts            # hash/verify password, JWT, requireAuth/requireOwner
    errors.ts          # ApiError + turunannya
    attendance-status.ts # hitung status hadir/telat + late_minutes dari jam shift
    leave-reset.ts     # hitung kuota cuti tahunan (masa kerja) + reset tahunan
    bpjs.ts            # kalkulasi BPJS Kesehatan + Ketenagakerjaan dari gaji pokok
    pph21.ts           # kalkulasi PPh21 progresif (PTKP + lapisan tarif)
    payroll.ts         # engine komputasi payroll per karyawan (gaji/BPJS/PPh21/take-home)
    payslip-pdf.ts     # generator PDF slip gaji (pdfkit) → Buffer
    payslip-store.ts   # simpan/baca file PDF slip gaji di filesystem
    payslip-generator.ts # buat record payslips + generate PDF untuk seluruh item satu run
tests/            # vitest: auth, users, employees, employees-import, schema, salary-components, salary-assignments, attendance-*, leave-*, shifts, shift-assignments, roster-publish, payroll-runs, payroll-approval, payslips, payroll-export, bpjs, pph21
drizzle/          # file migrasi SQL (generated)
data/             # file DB lokal (git-ignored) + data/payslips/ (PDF slip gaji, git-ignored)
```

## Endpoint

Prefix: `/api`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/auth/sign-up` | — | Buat bisnis + owner, balas `{ user, token }` |
| POST | `/auth/sign-in` | — | Masuk, balas `{ user, token }` |
| POST | `/auth/sign-out` | — | Keluar (JWT stateless), balas `{ ok: true }` |
| GET | `/auth/me` | Bearer | User saat ini |
| GET | `/users?limit=&offset=` | Owner | Daftar user (scoped bisnis) |
| POST | `/users` | Owner | Buat user |
| PATCH | `/users/:id` | Owner | Update user (role/employee_id/status) |
| DELETE | `/users/:id` | Owner | Soft-delete user |
| GET | `/employees?limit=&offset=&jenis_kontrak=&status=` | Owner | Daftar karyawan (scoped bisnis, filter & paginasi) |
| POST | `/employees` | Owner | Buat karyawan (validasi KTP/NPWP/umur, custom_fields JSON) |
| GET | `/employees/:id` | Owner / karyawan terkait | Detail karyawan (custom_fields ter-parse) |
| PATCH | `/employees/:id` | Owner | Update subset field + toggle status + merge custom_fields |
| DELETE | `/employees/:id` | Owner | Soft-delete (status → nonaktif) |
| POST | `/employees/import/preview` | Owner | Upload CSV (max 5 MB), kembalikan rows + detected headers + suggested mapping |
| POST | `/employees/import/commit` | Owner | Buat banyak karyawan valid sekaligus (transaksi), `{ created, skipped, errors }` |
| GET | `/salary-components?active=true` | Owner | Daftar komponen gaji (scoped bisnis; default termasuk nonaktif, filter `active=true`) |
| POST | `/salary-components` | Owner | Buat komponen gaji (`nama_komponen`, `tipe`, `nominal`/`formula`, `aktif`) |
| POST | `/salary-components/preview-formula` | Owner | Evaluasi formula terhadap `{ formula, variables }` → `{ result }` |
| PATCH | `/salary-components/:id` | Owner | Update subset field + toggle `aktif` (soft, tanpa hapus histori) |
| DELETE | `/salary-components/:id` | Owner | Soft-delete (set `aktif=false`) → `{ ok: true }` |
| GET | `/employees/:employeeId/salary-assignments?includeInactive=true` | Owner / karyawan terkait | Daftar penugasan komponen gaji + detail komponen (`nilai_efektif`) |
| POST | `/employees/:employeeId/salary-assignments` | Owner | Tugaskan komponen gaji ke karyawan (opsional `override_nominal`, cek duplikat aktif → 409) |
| PATCH | `/salary-assignments/:id` | Owner | Update `override_nominal` / toggle `aktif` |
| DELETE | `/salary-assignments/:id` | Owner | Soft-delete penugasan (set `aktif=false`) → `{ ok: true }` |
| POST | `/attendance/clock-in` | Karyawan / Owner | Clock-in: `{ employee_id?, catatan?, client_timestamp? }`, hitung status + late_minutes otomatis dari shift |
| POST | `/attendance/clock-out` | Karyawan / Owner | Clock-out: `{ employee_id?, client_timestamp? }`, catat waktu keluar |
| GET | `/attendance/today` | Karyawan / Owner | Absensi hari ini milik user |
| GET | `/attendance/employee/:employeeId?start=&end=` | Owner / karyawan terkait | Daftar absensi (filter rentang tanggal) |
| GET | `/attendance/aggregate/:employeeId?period=YYYY-MM` | Owner / karyawan terkait | Rekap bulanan `{ hadir, telat, absen, izin, total_late_minutes }` |
| POST | `/attendance/manual` | Owner | Entri/koreksi manual (upsert by `employee_id`+`tanggal`) |
| PATCH | `/attendance/:id` | Owner | Koreksi subset field catatan absensi |
| GET | `/leave-types` | Owner | Daftar jenis cuti (seed default otomatis: Tahunan 12/carry-over 5, Sakit 5, Izin 3, Melahirkan 90) |
| POST | `/leave-types` | Owner | Buat jenis cuti (`nama_jenis_cuti`, `default_kuota_hari`, `kebijakan_sisa`, `carry_over_max_days`) |
| PATCH | `/leave-types/:id` | Owner | Update subset field jenis cuti |
| DELETE | `/leave-types/:id` | Owner | Soft-delete jenis cuti (set `aktif=false`) → `{ ok: true }` |
| GET | `/leave-balances?employee_id=&tahun=` | Owner / karyawan terkait | Saldo cuti per tahun (auto-create bila belum ada); employee hanya saldo sendiri |
| PATCH | `/leave-balances/:id` | Owner | Penyesuaian saldo (`kuota_hari` / `terpakai_hari`) |
| POST | `/admin/leave-reset` | Owner | Reset tahunan saldo cuti (`{ tahun? }`), idempoten, carry-over/hangus per kebijakan |
| POST | `/leave-requests` | Karyawan / Owner | Ajukan cuti (`leave_type_id`, `tanggal_mulai`, `tanggal_selesai`, `alasan`), status default `pending`, divalidasi vs sisa kuota |
| GET | `/leave-requests?status=&employee_id=` | Owner / Karyawan | Riwayat pengajuan cuti (owner semua di bisnis; karyawan milik sendiri) |
| GET | `/leave-requests/:id` | Owner / karyawan terkait | Detail pengajuan cuti |
| PATCH | `/leave-requests/:id/approve` | Owner | Setujui cuti (status → `disetujui`, tambah `terpakai_hari`, catat approver) |
| PATCH | `/leave-requests/:id/reject` | Owner | Tolak cuti (status → `ditolak`, tanpa ubah saldo) |
| GET | `/shifts?includeInactive=true` | Owner | Daftar shift template (scoped bisnis; default aktif saja) |
| POST | `/shifts` | Owner | Buat shift (`nama_shift` Pagi/Siang/Malam/Libur, `jam_mulai`, `jam_selesai`, `aktif?`); `jam_selesai` tidak boleh lebih awal dari `jam_mulai` |
| PATCH | `/shifts/:id` | Owner | Update subset field shift |
| DELETE | `/shifts/:id` | Owner | Soft-delete shift (set `aktif=false`); assignment lama tetap mereferensikan shift ini |
| GET | `/shift-assignments?start=&end=&employee_id=` | Owner / Karyawan | Daftar penugasan shift dalam rentang (owner semua di bisnis + optional filter; karyawan hanya milik sendiri DAN hanya `published=true`) |
| POST | `/shift-assignments` | Owner | Tugaskan shift ke karyawan pada tanggal (`published` default `false`); validasi shift + karyawan di bisnis yang sama |
| PATCH | `/shift-assignments/:id` | Owner | Update subset field penugasan (validasi silang bisnis bila ganti shift/karyawan) |
| DELETE | `/shift-assignments/:id` | Owner | Hapus penugasan shift (hard delete) → `{ ok: true }` |
| GET | `/shift-assignments/upcoming` | Owner / Karyawan | Jadwal 3 hari ke depan, hanya `published=true` (owner bisnis-wide, karyawan milik sendiri) |
| POST | `/roster/publish` | Owner | Publish batch roster: body `{ assignment_ids: [] }` ATAU `{ start, end, employee_ids? }`; set `published=true` + catat `published_at` & `published_by_user_id`; balas `{ updated, published_at, published_by_user_id }`. Publish ulang = no-op |
| POST | `/roster/unpublish` | Owner | Kembalikan `published=false` untuk koreksi owner (field audit dipertahankan) |
| POST | `/payroll-runs` | Owner | Buat run payroll draft: body `{ periode: 'YYYY-MM' }`, auto-buat `payroll_items` utk tiap karyawan `status=aktif`, hitung gaji pokok/tunjangan/BPJS/PPh21/take-home + `detail_breakdown` JSON. Duplikat periode → 409. Balas `{ run, items }` |
| GET | `/payroll-runs?periode=` | Owner | Daftar run payroll di bisnis (opsional filter `periode`) |
| GET | `/payroll-runs/:id` | Owner / karyawan terkait | Detail run + item; owner lihat semua, karyawan hanya item miliknya |
| PATCH | `/payroll-items/:id` | Owner | Koreksi item payroll saat `status=draft`: body `{ koreksi, catatan_koreksi? }`; `koreksi` ditambahkan ke `take_home`. Setelah approve/lock → 409 |
| POST | `/payroll-runs/:id/approve` | Owner | Setujui run: `draft → disetujui`, set `approved_at` + `approved_by_user_id`, generate slip PDF per item. Re-approve → 409 (tanpa duplikasi payslip) |
| POST | `/payroll-runs/:id/lock` | Owner | Kunci run setelah disetujui (`disetujui → locked`), menolak semua edit lanjutan |
| GET | `/payslips` | Owner / Karyawan | Daftar slip gaji (owner semua di bisnis; karyawan hanya miliknya) |
| GET | `/payslips/employee/:employeeId` | Owner / Karyawan terkait | Daftar slip gaji karyawan tertentu (owner bebas; karyawan hanya diri sendiri) |
| GET | `/payslips/:id/download` | Owner / Karyawan terkait | Unduh PDF slip gaji (`Content-Type: application/pdf`, nama `slip-gaji-{nama}-{periode}.pdf`) |
| GET | `/payroll-runs/:id/export.csv` | Owner | Ekspor rekap payroll CSV (BOM UTF-8) atau XLSX (`?format=xlsx`), termasuk baris total |

Catatan absensi: status `hadir`/`telat` dihitung otomatis dari `jam_mulai` shift (shift_assignments) saat clock-in, fallback `08:00` bila tak ada shift. `client_timestamp` (untuk kasus offline) divalidasi tidak boleh di masa depan. Owner boleh clock-in/out atas nama karyawan lain via `employee_id`; employee hanya untuk dirinya sendiri.

Catatan cuti: saldo cuti dibuat otomatis saat pertama kali di-query per tahun. Kuota cuti tahunan mengikuti UU Cipta Kerja — masa kerja ≥ 1 tahun mendapat `default_kuota_hari` penuh (12), masa kerja < 1 tahun diprorata (`default_kuota_hari × bulan kerja / 12`). Sisa tahun lalu dipindah ke tahun baru bila `kebijakan_sisa='carry-over'` (maks `carry_over_max_days`), hangus bila `hangus`. `POST /admin/leave-reset` memicu reset tahunan secara manual (cron menyusul) dan idempoten — tidak menggandakan baris saldo.

Catatan payroll: `POST /api/payroll-runs` membuat satu run `status=draft` per `(business_id, periode)` (duplikat → 409). Hanya karyawan `status=aktif` yang diikutkan. Per karyawan: `gaji_pokok` = jumlah komponen earning bernama "Gaji Pokok"; `total_tunjangan` = jumlah komponen earning lain (pakai `override_nominal` bila ada, formula dievaluasi — formula tak terselesaikan membuat run gagal dgn pesan jelas); `total_bpjs_kesehatan` = 1% gaji pokok; `total_bpjs_tk` = JHT 2% + JP 1%; `pph21` = PPh21 progresif bulanan dari gross tahunan (12×gross bulanan); `take_home` = gross − (BPJS + PPh21). Seluruh sub-kalkulasi tersimpan di kolom `payroll_items.detail_breakdown` (JSON). `employees.ptkp_status` (TK/0, K/0, K/1, K/2, K/3; nullable) menentukan PTKP PPh21; bila kosong default TK/0 dgn penanda di breakdown.

Catatan persetujuan & slip gaji: `PATCH /api/payroll-items/:id` memungkinkan Owner mengoreksi item saat run `status=draft` (nilai `koreksi` ditambahkan ke `take_home`); setelah approve/lock semua edit ditolak 409. `POST /api/payroll-runs/:id/approve` memindahkan run ke `disetujui`, mencatat `approved_at` + `approved_by_user_id`, lalu otomatis membuat satu record `payslips` per item dan men-generate PDF slip gaji (pdfkit) yang disimpan di `backend/data/payslips/{payslip_id}.pdf` (lokasi bisa di-override via env `PAYSLIP_DIR`); `pdf_url` disimpan di DB. Re-approve idempoten — tidak menduplikasi payslip. `POST /api/payroll-runs/:id/lock` mengunci run setelah disetujui. `GET /api/payslips*` scoped: Owner melihat semua di bisnis, karyawan hanya miliknya. `GET /api/payroll-runs/:id/export.csv` (owner) menghasilkan CSV UTF-8 (BOM) berisi Nama, NIP/ID, Gaji Pokok, Total Tunjangan, BPJS Kesehatan (employee), BPJS Ketenagakerjaan (employee), PPh 21, Koreksi, Take-Home plus baris total; `?format=xlsx` menghasilkan file XLSX (exceljs).

Catatan: saat `POST/PATCH /users` mengirim `employee_id`, sistem memvalidasi karyawan tsb ada di bisnis yang sama.

## Kode status

- `400` validasi / aturan bisnis (mis. demote diri sendiri)
- `401` kredensial/sesi tidak valid
- `403` bukan owner
- `404` sumber daya tidak ditemukan
- `409` email duplikat dalam bisnis
- `422` nilai role/status tidak valid
- `500` kesalahan server

Semua pesan error dalam Bahasa Indonesia, format `{ error: { message } }`.

## Catatan auth

- Password di-hash dengan bcryptjs (tidak pernah dikirim balik; semua respons user membuang `password_hash`).
- JWT HS256, kedaluwarsa 7 hari, dikirim via header `Authorization: Bearer <token>`.
- Unik constraint `(business_id, email)` — email hanya unik per bisnis, jadi antar-bisnis boleh sama.
- Guard: tidak bisa menurunkan role diri sendiri, tidak bisa membuat bisnis tanpa owner (min. satu owner).
