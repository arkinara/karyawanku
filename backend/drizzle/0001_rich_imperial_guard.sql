CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`tanggal` text NOT NULL,
	`clock_in` text,
	`clock_out` text,
	`catatan` text,
	`status` text DEFAULT 'hadir' NOT NULL,
	`late_minutes` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attendance_records_employee_idx` ON `attendance_records` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employee_salary_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`salary_component_id` text NOT NULL,
	`override_nominal` real,
	`aktif` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`salary_component_id`) REFERENCES `salary_components`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employee_salary_assignments_employee_idx` ON `employee_salary_assignments` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`nama_lengkap` text NOT NULL,
	`no_ktp` text NOT NULL,
	`npwp` text,
	`tanggal_lahir` text NOT NULL,
	`jenis_kelamin` text NOT NULL,
	`alamat` text,
	`kontak_darurat` text,
	`tanggal_masuk` text NOT NULL,
	`jenis_kontrak` text NOT NULL,
	`status` text DEFAULT 'aktif' NOT NULL,
	`custom_fields` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_business_no_ktp_unique` ON `employees` (`business_id`,`no_ktp`);--> statement-breakpoint
CREATE INDEX `employees_business_id_idx` ON `employees` (`business_id`);--> statement-breakpoint
CREATE TABLE `leave_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type_id` text NOT NULL,
	`tahun` integer NOT NULL,
	`kuota_hari` real DEFAULT 0 NOT NULL,
	`terpakai_hari` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `leave_balances_employee_idx` ON `leave_balances` (`employee_id`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type_id` text NOT NULL,
	`tanggal_mulai` text NOT NULL,
	`tanggal_selesi` text NOT NULL,
	`alasan` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`approver_user_id` text,
	`catatan_approver` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approver_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leave_requests_employee_idx` ON `leave_requests` (`employee_id`);--> statement-breakpoint
CREATE TABLE `leave_types` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`nama_jenis_cuti` text NOT NULL,
	`default_kuota_hari` integer DEFAULT 12 NOT NULL,
	`kebijakan_sisa` text DEFAULT 'hangus' NOT NULL,
	`carry_over_max_days` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `leave_types_business_id_idx` ON `leave_types` (`business_id`);--> statement-breakpoint
CREATE TABLE `payroll_items` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`gaji_pokok` real DEFAULT 0 NOT NULL,
	`total_tunjangan` real DEFAULT 0 NOT NULL,
	`total_bpjs_kesehatan` real DEFAULT 0 NOT NULL,
	`total_bpjs_tk` real DEFAULT 0 NOT NULL,
	`pph21` real DEFAULT 0 NOT NULL,
	`take_home` real DEFAULT 0 NOT NULL,
	`koreksi` real DEFAULT 0 NOT NULL,
	`catatan_koreksi` text,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payroll_items_payroll_run_idx` ON `payroll_items` (`payroll_run_id`);--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`periode` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_gaji` real DEFAULT 0 NOT NULL,
	`total_potongan` real DEFAULT 0 NOT NULL,
	`take_home` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`approved_at` integer,
	`approved_by_user_id` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_runs_business_id_idx` ON `payroll_runs` (`business_id`);--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_item_id` text NOT NULL,
	`pdf_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payslips_payroll_item_id_unique` ON `payslips` (`payroll_item_id`);--> statement-breakpoint
CREATE INDEX `payslips_payroll_item_id_idx` ON `payslips` (`payroll_item_id`);--> statement-breakpoint
CREATE TABLE `salary_components` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`nama_komponen` text NOT NULL,
	`tipe` text DEFAULT 'earning' NOT NULL,
	`nominal` real,
	`formula` text,
	`aktif` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `salary_components_business_id_idx` ON `salary_components` (`business_id`);--> statement-breakpoint
CREATE TABLE `shift_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`tanggal` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shift_assignments_employee_idx` ON `shift_assignments` (`employee_id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`nama_shift` text NOT NULL,
	`jam_mulai` text NOT NULL,
	`jam_selesai` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shifts_business_id_idx` ON `shifts` (`business_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`nama` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`employee_id` text,
	`status` text DEFAULT 'aktif' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "business_id", "email", "password_hash", "nama", "role", "employee_id", "status", "created_at") SELECT "id", "business_id", "email", "password_hash", "nama", "role", "employee_id", "status", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_business_email_unique` ON `users` (`business_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_business_id_idx` ON `users` (`business_id`);