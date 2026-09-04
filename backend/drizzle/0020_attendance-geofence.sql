-- Ticket #67: geofence absensi — lokasi kerja + radius + capture koordinat.
-- Semua kolom baru nullable / ber-default sehingga bisnis tanpa lokasi yang
-- dikonfigurasi berperilaku persis seperti sebelumnya (tanpa flag, tanpa blok).
-- `geofence_mode` default `flag_only` (hanya menandai); `block_in_radius`
-- menolak clock-in/out di luar radius. Evaluasi jarak murni server-side.
ALTER TABLE `businesses` ADD `work_latitude` real;--> statement-breakpoint
ALTER TABLE `businesses` ADD `work_longitude` real;--> statement-breakpoint
ALTER TABLE `businesses` ADD `work_radius_m` integer;--> statement-breakpoint
ALTER TABLE `businesses` ADD `geofence_mode` text DEFAULT 'flag_only' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `geofence_min_radius_m` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `geofence_max_radius_m` integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `geofence_default_radius_m` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_in_latitude` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_in_longitude` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_in_accuracy_m` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_in_distance_m` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_out_latitude` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_out_longitude` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_out_accuracy_m` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `clock_out_distance_m` real;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `geofence_status` text DEFAULT 'unknown' NOT NULL;