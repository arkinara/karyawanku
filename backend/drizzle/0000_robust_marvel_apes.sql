CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`nama_bisnis` text NOT NULL,
	`jenis_usaha` text DEFAULT 'fnb' NOT NULL,
	`alamat` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`nama` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`employee_id` text,
	`status` text DEFAULT 'aktif' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_business_email_unique` ON `users` (`business_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_business_id_idx` ON `users` (`business_id`);