-- Ticket #57: catatan audit append-only untuk payroll, gaji, absensi, cuti,
-- serta mutasi role/status user dan pengaturan bisnis.
-- Tabel ini tidak punya rute UPDATE/DELETE di API; satu-satunya jalur tulis
-- adalah helper `recordAudit` (src/lib/audit.ts) di dalam transaksi yang sama
-- dengan perubahan yang dideskripsikannya.
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `audit_logs_business_created_at_idx` ON `audit_logs` (`business_id`,`created_at`);