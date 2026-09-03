-- Ticket #70: idempotensi submission absensi (offline queue).
-- Satu `idempotency_key` (UUID v4 / hex 256-bit) per tindakan clock-in/out yang
-- dihasilkan klien, disimpan SEBELUM respons sukses (di dalam transaksi write).
-- Kirim ulang dengan key yang sama → kembalikan record asli tanpa menulis ulang.
-- `idempotency_key` primary key (unik global) → key satu karyawan tidak bisa
-- dipakai karyawan lain. `expires_at` default 30 hari; key kedaluwarsa
-- dianggap tidak ada (tidak pernah menahan double-write) + dibersihkan job harian.
-- Migrasi no-op terhadap baris lama (tabel baru).
CREATE TABLE `attendance_idempotency` (
	`idempotency_key` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`attendance_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer DEFAULT (unixepoch() + 2592000) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendance_records`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `attendance_idempotency_employee_idx` ON `attendance_idempotency` (`employee_id`);