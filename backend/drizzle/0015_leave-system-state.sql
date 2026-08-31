-- Ticket #56: tabel `system_state` (key-value) untuk bookkeeping proses berkala.
-- Satu baris per key. `last_leave_reset_year` dicatat oleh `runYearlyResetIfNeeded`
-- saat reset tahunan saldo cuti dijalankan otomatis di startup; `last_thr_reset_year`
-- dicadangkan untuk proses THR berkala (belum diimplementasikan).
CREATE TABLE `system_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer
);