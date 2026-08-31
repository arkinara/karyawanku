-- Ticket #56: perbaiki typo kolom `leave_requests.tanggal_selesi` → `tanggal_selesai`.
-- Kolom lama salah eja ("selesi" vs "selesai") dan sudah terlanjur dipakai di route
-- code + respons API. `ALTER TABLE ... RENAME COLUMN` (SQLite ≥ 3.25) mempertahankan
-- seluruh data tanpa kehilangan baris dan otomatis memperbarui referensi di indeks,
-- trigger, dan view yang memakai kolom tersebut. Migrasi ini juga menandai kolom
-- `tanggal_selesi` pada migrasi lama (0001) sebagai OBSOLETE — diganti di sini.
ALTER TABLE `leave_requests` RENAME COLUMN `tanggal_selesi` TO `tanggal_selesai`;