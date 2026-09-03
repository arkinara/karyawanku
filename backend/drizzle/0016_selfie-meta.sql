-- Ticket #69: selfie verifikasi absensi (MOB).
-- Metadata foto verifikasi kehadiran; file-nya disimpan di filesystem
-- (backend/data/selfies/{employee_id}/{attendance_id}.jpg), bukan di DB.
-- `attendance_id` unik (satu selfie per record absensi; upload kedua menimpa
-- dengan retention_until baru). `retention_until` default 90 hari dan diindeks
-- agar job purge harian berjalan cepat.
CREATE TABLE `selfie_meta` (
	`attendance_id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`retention_until` integer NOT NULL,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendance_records`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `selfie_meta_retention_until_idx` ON `selfie_meta` (`retention_until`);