import 'models.dart';

/// Front-end-only fixtures lifted from the design doc. Every string, amount
/// and date here matches `KaryawanKu Mobile.dc.html` so the Flutter build can
/// be compared against the mockups screen by screen.
abstract final class Mock {
  /// The design is dated Selasa, 2 September 2026.
  static final today = DateTime(2026, 9, 2);

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
  static const pendingLeaveCount = 1;

  // Cuti
  static const leaveBalances = [
    LeaveBalance(label: 'Tahunan', remaining: 8, total: 12),
    LeaveBalance(label: 'Sakit', remaining: 10, total: 12),
    LeaveBalance(label: 'Izin', remaining: 3, total: 4),
  ];

  static const annualLeaveExpiry = '31/12/2026';

  static final leaveRequests = [
    LeaveRequest(
      kind: LeaveKind.tahunan,
      status: LeaveStatus.menunggu,
      start: DateTime(2026, 9, 15),
      end: DateTime(2026, 9, 17),
      days: 3,
      reason: 'Acara keluarga di Bandung',
      meta: 'Diajukan 2 hari lalu · menunggu Pak Darmawan',
    ),
    LeaveRequest(
      kind: LeaveKind.sakit,
      status: LeaveStatus.disetujui,
      start: DateTime(2026, 8, 12),
      end: DateTime(2026, 8, 12),
      days: 1,
      reason: 'Demam, ada surat dokter',
    ),
    LeaveRequest(
      kind: LeaveKind.izin,
      status: LeaveStatus.ditolak,
      start: DateTime(2026, 7, 28),
      end: DateTime(2026, 7, 28),
      days: 1,
      reason: 'Keperluan pribadi',
      decisionNote:
          'Catatan: shift sedang kekurangan orang, ajukan minggu depan.',
    ),
  ];

  // Jadwal
  static final shifts = <Shift>[
    Shift(
      date: DateTime(2026, 9, 2),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
      isToday: true,
    ),
    Shift(
      date: DateTime(2026, 9, 3),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 4),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 5),
      kind: ShiftKind.siang,
      start: '15:00',
      end: '23:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 6),
      kind: ShiftKind.siang,
      start: '15:00',
      end: '23:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 8),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 9),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 10),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 12),
      kind: ShiftKind.siang,
      start: '15:00',
      end: '23:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 13),
      kind: ShiftKind.siang,
      start: '15:00',
      end: '23:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 15),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
      leaveRequested: true,
    ),
    Shift(
      date: DateTime(2026, 9, 16),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
      leaveRequested: true,
    ),
    Shift(
      date: DateTime(2026, 9, 17),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
      leaveRequested: true,
    ),
    Shift(
      date: DateTime(2026, 9, 18),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 19),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
    Shift(
      date: DateTime(2026, 9, 20),
      kind: ShiftKind.pagi,
      start: '07:00',
      end: '15:00',
      role: 'Kasir',
    ),
  ];

  static const shiftReminder = 'Pengingat 30 menit sebelum shift — aktif';

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
