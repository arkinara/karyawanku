-- Ticket #49: peran 'manager' untuk KaryawanKu.
-- Kolom `users.role` adalah TEXT biasa di SQLite (drizzle enum hanya type-level,
-- tanpa CHECK constraint), jadi tidak ada perubahan DDL. Migrasi ini murni
-- pre-flight: membatalkan bila ada nilai role yang tidak dikenal di data lama,
-- dan TIDAK pernah mengubah role baris yang ada (employee tetap employee).
DROP TRIGGER IF EXISTS `__karyawanku_abort_on_unknown_role`;--> statement-breakpoint
DROP TABLE IF EXISTS `__karyawanku_role_preflight`;--> statement-breakpoint
CREATE TEMP TABLE `__karyawanku_role_preflight` (`role` text NOT NULL);--> statement-breakpoint
CREATE TRIGGER `__karyawanku_abort_on_unknown_role`
BEFORE INSERT ON `__karyawanku_role_preflight`
WHEN (SELECT COUNT(*) FROM (SELECT `role` FROM `users` WHERE `role` NOT IN ('owner', 'manager', 'employee'))) > 0
BEGIN
  SELECT RAISE(ABORT, 'Migrasi peran manager dibatalkan - ditemukan nilai role yang tidak dikenal');
END;--> statement-breakpoint
INSERT INTO `__karyawanku_role_preflight` (`role`) VALUES ('preflight');--> statement-breakpoint
DROP TRIGGER `__karyawanku_abort_on_unknown_role`;--> statement-breakpoint
DROP TABLE `__karyawanku_role_preflight`;