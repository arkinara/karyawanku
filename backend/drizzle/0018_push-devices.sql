-- Ticket #71: push notifications (FCM). Empat tabel baru:
-- 1. `push_devices` — token FCM per perangkat, unik per (user_id, token) agar
--    registrasi ulang token yang sama tidak membuat baris ganda.
-- 2. `notification_log` — audit pengiriman + jendela retry (next_retry_at).
--    `payload_json` menyimpan data notifikasi (kind/deep-link) + teks
--    title/body di kunci `_n` untuk rekonstruksi saat retry.
-- 3. `reminder_settings` — toggle pengingat shift + lead time per user.
-- 4. `shift_reminder_log` — idempotensi pengingat: PK assignment_id menjamin
--    satu pengingat per shift, aman terhadap restart server.
-- Migrasi no-op terhadap baris lama (tabel baru).
CREATE TABLE `push_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`platform` text NOT NULL,
	`token` text NOT NULL,
	`app_version` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `push_devices_user_token_unique` ON `push_devices` (`user_id`,`token`);--> statement-breakpoint
CREATE INDEX `push_devices_user_idx` ON `push_devices` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text,
	`device_token` text,
	`attempts` integer DEFAULT 1 NOT NULL,
	`last_error` text,
	`delivered_at` integer,
	`next_retry_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `notification_log_user_idx` ON `notification_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_log_retry_idx` ON `notification_log` (`next_retry_at`);--> statement-breakpoint
CREATE TABLE `reminder_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`shift_reminders_enabled` integer DEFAULT 1 NOT NULL,
	`reminder_lead_minutes` integer DEFAULT 30 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `shift_reminder_log` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`fired_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE cascade
);