DROP TRIGGER IF EXISTS `__karyawanku_abort_on_dup_email`;--> statement-breakpoint
DROP TABLE IF EXISTS `__karyawanku_dup_email_preflight`;--> statement-breakpoint
CREATE TEMP TABLE `__karyawanku_dup_email_preflight` (`email` text NOT NULL);--> statement-breakpoint
CREATE TRIGGER `__karyawanku_abort_on_dup_email`
BEFORE INSERT ON `__karyawanku_dup_email_preflight`
WHEN (SELECT COUNT(*) FROM (SELECT `email` FROM `users` GROUP BY `email` HAVING COUNT(*) > 1)) > 0
BEGIN
  SELECT RAISE(ABORT, 'Migrasi email unik dibatalkan - email berikut sudah dipakai lebih dari satu user: ' || (SELECT GROUP_CONCAT(`email`, ', ') FROM (SELECT `email` FROM `users` GROUP BY `email` HAVING COUNT(*) > 1)));
END;--> statement-breakpoint
INSERT INTO `__karyawanku_dup_email_preflight` (`email`) VALUES ('preflight');--> statement-breakpoint
DROP TRIGGER `__karyawanku_abort_on_dup_email`;--> statement-breakpoint
DROP TABLE `__karyawanku_dup_email_preflight`;--> statement-breakpoint
DROP INDEX `users_business_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);