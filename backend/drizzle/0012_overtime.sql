-- Ticket #54: lembur — catat jam lembur per record absensi.
-- `overtime_minutes` diturunkan dari clock-out melebihi jam selesai shift (+grace),
-- `overtime_override_minutes` adalah koreksi manual yang menang atas nilai turunan.
-- Baris lama otomatis mendapat overtime_minutes = 0.
ALTER TABLE `attendance_records` ADD `overtime_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `overtime_override_minutes` integer;