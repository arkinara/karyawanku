ALTER TABLE `shift_assignments` ADD `published` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shift_assignments` ADD `published_at` integer;--> statement-breakpoint
ALTER TABLE `shift_assignments` ADD `published_by_user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `shift_assignments_tanggal_idx` ON `shift_assignments` (`tanggal`);--> statement-breakpoint
ALTER TABLE `shifts` ADD `aktif` integer DEFAULT true NOT NULL;