-- Ticket #55: THR (Tunjangan Hari Raya Keagamaan, Permenaker 6/2016).
-- 1) Kolom `is_fixed` pada salary_components menandai tunjangan tetap yang
--    menjadi bagian basis upah THR (gaji pokok + tunjangan tetap); tunjangan
--    variabel (is_fixed=false) tidak dihitung. Default false sehingga komponen
--    lama tetap valid dan tidak berubah makna.
-- 2) Tabel `thr_payments` mencatat setiap pencairan THR per karyawan per tahun,
--    dengan unik constraint (employee_id, periode) mencegah pembayaran ganda.
ALTER TABLE `salary_components` ADD `is_fixed` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `thr_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`business_id` text NOT NULL,
	`periode` text NOT NULL,
	`tanggal_bayar` text NOT NULL,
	`amount` real NOT NULL,
	`basis` real NOT NULL,
	`months_of_service` integer NOT NULL,
	`proportion` real NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`notes` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `thr_payments_employee_periode_unique` ON `thr_payments` (`employee_id`,`periode`);--> statement-breakpoint
CREATE INDEX `thr_payments_business_id_idx` ON `thr_payments` (`business_id`);