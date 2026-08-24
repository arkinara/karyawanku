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
    auth.ts       # hash/verify password, JWT, requireAuth/requireOwner
    errors.ts     # ApiError + turunannya
  routes/
    auth.ts       # POST sign-up/sign-in/sign-out, GET me
    users.ts      # CRUD user (owner only)
    employees.ts        # CRUD karyawan (owner / self)
    employees-import.ts # import CSV: preview + commit
    salary-components.ts   # CRUD komponen gaji + preview formula
    salary-assignments.ts  # penugasan komponen gaji ke karyawan
tests/            # vitest: auth, users, employees, employees-import, schema, salary-components, salary-assignments
drizzle/          # file migrasi SQL (generated)
data/             # file DB lokal (git-ignored)
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
