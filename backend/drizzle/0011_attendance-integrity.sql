-- Ticket #59: integritas absensi — waktu otoritatif server.
-- `clock_in` / `clock_out` kini jam server; klaim waktu klien disimpan terpisah
-- (`client_claim_at`), divergence > toleransi ditandai (`time_drift_detected`),
-- dan asal submission (`live` vs flush antrian offline) dicatat.
-- Semua kolom baru nullable / ber-default sehingga data lama tetap valid.
ALTER TABLE `attendance_records` ADD `client_claim_at` text;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_out_client_claim_at` text;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `time_drift_detected` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `submission_method` text DEFAULT 'live' NOT NULL;