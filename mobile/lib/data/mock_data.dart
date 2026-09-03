import 'models.dart';

/// Front-end-only fixtures lifted from the design doc. Every string, amount
/// and date here matches `KaryawanKu Mobile.dc.html` so the Flutter build can
/// be compared against the mockups screen by screen.
abstract final class Mock {
  static const employee = Employee(
    name: 'Siti Nurhaliza',
    initials: 'SN',
    role: 'Kasir',
    company: 'Warung Kopi Nusantara',
    branch: 'Cabang Kemang',
  );

  // Beranda
  static const greeting = 'Selamat pagi, Siti';
  static const notificationCount = 2;

  static const offlineNotice =
      'Absensi tetap tercatat tanpa sinyal — data terkirim otomatis saat kembali online.';
}
