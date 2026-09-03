enum ShiftKind { pagi, siang, malam, libur }

enum LeaveStatus { menunggu, disetujui, ditolak }

enum LeaveKind { tahunan, sakit, izin, melahirkan, penting }

enum AttendanceState { done, pendingSync, empty }

class Employee {
  const Employee({
    required this.name,
    required this.initials,
    required this.role,
    required this.company,
    required this.branch,
  });

  final String name;
  final String initials;
  final String role;
  final String company;
  final String branch;
}

class Shift {
  const Shift({
    required this.date,
    required this.kind,
    required this.start,
    required this.end,
    required this.role,
    this.isToday = false,
    this.leaveRequested = false,
  });

  final DateTime date;
  final ShiftKind kind;
  final String start;
  final String end;
  final String role;
  final bool isToday;

  /// A pending leave request covering this day — shown amber in the calendar.
  final bool leaveRequested;

  String get label => switch (kind) {
    ShiftKind.pagi => 'Shift Pagi',
    ShiftKind.siang => 'Shift Siang',
    ShiftKind.malam => 'Shift Malam',
    ShiftKind.libur => 'Libur',
  };

  String get range => '$start – $end';
}

class AttendanceEntry {
  const AttendanceEntry({
    required this.label,
    required this.time,
    required this.state,
    this.note,
  });

  final String label;
  final String time;
  final AttendanceState state;
  final String? note;
}

class LeaveRequest {
  const LeaveRequest({
    required this.kind,
    required this.status,
    required this.start,
    required this.end,
    required this.days,
    required this.reason,
    this.meta,
    this.decisionNote,
  });

  final LeaveKind kind;
  final LeaveStatus status;
  final DateTime start;
  final DateTime end;
  final int days;
  final String reason;

  /// e.g. `Diajukan 2 hari lalu · menunggu Pak Darmawan`
  final String? meta;

  /// Rejection or approval note from the approver.
  final String? decisionNote;

  String get kindLabel => switch (kind) {
    LeaveKind.tahunan => 'Cuti Tahunan',
    LeaveKind.sakit => 'Cuti Sakit',
    LeaveKind.izin => 'Cuti Izin',
    LeaveKind.melahirkan => 'Cuti Melahirkan',
    LeaveKind.penting => 'Cuti Penting',
  };

  String get statusLabel => switch (status) {
    LeaveStatus.menunggu => 'Menunggu',
    LeaveStatus.disetujui => 'Disetujui',
    LeaveStatus.ditolak => 'Ditolak',
  };
}

class LeaveBalance {
  const LeaveBalance({
    required this.label,
    required this.remaining,
    required this.total,
  });

  final String label;
  final int remaining;
  final int total;
}

class PayslipLine {
  const PayslipLine(this.label, this.amount);
  final String label;
  final int amount;
}

class Payslip {
  const Payslip({
    required this.period,
    required this.paidOn,
    required this.takeHome,
    required this.earnings,
    required this.deductions,
    required this.account,
    this.isThr = false,
  });

  final String period;
  final DateTime paidOn;
  final int takeHome;
  final List<PayslipLine> earnings;
  final List<PayslipLine> deductions;
  final String account;
  final bool isThr;

  int get totalEarnings => earnings.fold(0, (sum, line) => sum + line.amount);

  int get totalDeductions =>
      deductions.fold(0, (sum, line) => sum + line.amount);
}
