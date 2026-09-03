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

  // Slip gaji
  static final latestPayslip = Payslip(
    period: 'Agustus 2026',
    paidOn: DateTime(2026, 8, 31),
    takeHome: 4235000,
    account: 'BCA ••••4821',
    earnings: const [
      PayslipLine('Gaji Pokok', 4200000),
      PayslipLine('Tunjangan Makan', 500000),
      PayslipLine('Tunjangan Transport', 300000),
      PayslipLine('Lembur (6 jam)', 150000),
    ],
    deductions: const [
      PayslipLine('BPJS Kesehatan (1%)', 42000),
      PayslipLine('BPJS JHT (2%)', 84000),
      PayslipLine('BPJS JP (1%)', 42000),
      PayslipLine('PPh 21', 747000),
    ],
  );

  static final payslipHistory = [
    latestPayslip,
    Payslip(
      period: 'Juli 2026',
      paidOn: DateTime(2026, 7, 31),
      takeHome: 4180000,
      account: 'BCA ••••4821',
      earnings: const [PayslipLine('Gaji Pokok', 4200000)],
      deductions: const [PayslipLine('Potongan', 20000)],
    ),
    Payslip(
      period: 'Juni 2026',
      paidOn: DateTime(2026, 6, 30),
      takeHome: 4180000,
      account: 'BCA ••••4821',
      earnings: const [PayslipLine('Gaji Pokok', 4200000)],
      deductions: const [PayslipLine('Potongan', 20000)],
    ),
    Payslip(
      period: 'THR 2026',
      paidOn: DateTime(2026, 3, 20),
      takeHome: 4200000,
      account: 'BCA ••••4821',
      isThr: true,
      earnings: const [PayslipLine('Tunjangan Hari Raya', 4200000)],
      deductions: const [],
    ),
    Payslip(
      period: 'Mei 2026',
      paidOn: DateTime(2026, 5, 31),
      takeHome: 4055000,
      account: 'BCA ••••4821',
      earnings: const [PayslipLine('Gaji Pokok', 4200000)],
      deductions: const [PayslipLine('Potongan', 145000)],
    ),
  ];

  static const payslipDisclaimer =
      'Slip gaji ini dihasilkan otomatis oleh sistem. Hubungi Owner untuk koreksi.';

  static const offlineNotice =
      'Absensi tetap tercatat tanpa sinyal — data terkirim otomatis saat kembali online.';
}
