-- Ticket #72: device-bound biometric sign-in (MOB). Satu baris per
-- `device_refresh_token` (token mentah TIDAK pernah disimpan — hanya sha256-nya
-- di `token_hash`). `biometric_key` adalah secret verifikasi per-credential yang
-- dipakai BE untuk memvalidasi `biometric_proof` (HMAC-SHA256 atas tuple
-- device_id:device_install_id) pada POST /auth/device-refresh; token mentah + key
-- hanya dipegang perangkat di balik gerbang biometrik.
-- `device_id` adalah UUID acak per instal (header X-Device-Id); `device_install_id`
-- adalah UUID yang diterbitkan BE saat credential dibuat (berotasi tiap mint).
-- Migrasi no-op terhadap baris lama (tabel baru).
CREATE TABLE `device_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`device_id` text,
	`device_install_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`biometric_key` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `device_credentials_token_hash_unique` ON `device_credentials` (`token_hash`);--> statement-breakpoint
CREATE INDEX `device_credentials_user_device_idx` ON `device_credentials` (`user_id`,`device_id`,`device_install_id`);