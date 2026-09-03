enum ShiftKind { pagi, siang, malam, libur }

enum LeaveStatus { menunggu, disetujui, ditolak }

enum LeaveKind { tahunan, sakit, izin, melahirkan, penting }

enum AttendanceEntryState { done, pendingSync, empty }

/// The BE attendance statuses (`backend/src/db/schema.ts`). Maps 1:1 onto the
/// monthly aggregate tiles and the today-record timeline.
enum AttendanceStatus { hadir, telat, absen, izin }

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
  final AttendanceEntryState state;
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

/// One attendance row from the BE. Times are server-authoritative ISO-8601
/// instants (`clock_in` / `clock_out`) — never the device clock. Late and
/// overtime values are computed by the BE and rendered verbatim.
class AttendanceRecord {
  const AttendanceRecord({
    required this.id,
    required this.employeeId,
    required this.tanggal,
    required this.clockIn,
    required this.clockOut,
    required this.catatan,
    required this.status,
    required this.lateMinutes,
    required this.overtimeMinutes,
    this.overtimeOverrideMinutes,
    required this.submissionMethod,
    required this.timeDriftDetected,
  });

  final String id;
  final String employeeId;

  /// `YYYY-MM-DD` (server-local date of the effective clock-in).
  final String tanggal;

  /// Server-authoritative clock-in instant, UTC. Null until the employee
  /// clocks in.
  final DateTime? clockIn;

  /// Server-authoritative clock-out instant, UTC. Null until the employee
  /// clocks out.
  final DateTime? clockOut;

  final String? catatan;
  final AttendanceStatus status;

  /// Minutes late, computed by the BE from the scheduled shift start.
  final int lateMinutes;

  /// Minutes of overtime, computed by the BE at clock-out. Never recomputed
  /// on the client.
  final int overtimeMinutes;

  /// Manual override that wins over the derived value; null = use derived.
  final int? overtimeOverrideMinutes;

  /// `live` or `offline_queue`.
  final String submissionMethod;
  final bool timeDriftDetected;

  int get effectiveOvertimeMinutes =>
      overtimeOverrideMinutes ?? overtimeMinutes;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      tanggal: json['tanggal'] as String,
      clockIn: switch (json['clock_in']) {
        final String raw => DateTime.tryParse(raw),
        _ => null,
      },
      clockOut: switch (json['clock_out']) {
        final String raw => DateTime.tryParse(raw),
        _ => null,
      },
      catatan: json['catatan'] as String?,
      status: AttendanceStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => AttendanceStatus.hadir,
      ),
      lateMinutes: (json['late_minutes'] as num?)?.toInt() ?? 0,
      overtimeMinutes: (json['overtime_minutes'] as num?)?.toInt() ?? 0,
      overtimeOverrideMinutes:
          (json['overtime_override_minutes'] as num?)?.toInt(),
      submissionMethod: json['submission_method'] as String? ?? 'live',
      timeDriftDetected: json['time_drift_detected'] as bool? ?? false,
    );
  }
}

/// Wrapper for `GET /attendance/today` → `{ record: AttendanceRecord | null }`.
class TodayAttendance {
  const TodayAttendance({this.record});

  final AttendanceRecord? record;

  factory TodayAttendance.fromJson(Map<String, dynamic> json) {
    final raw = json['record'];
    return TodayAttendance(
      record: raw is Map<String, dynamic>
          ? AttendanceRecord.fromJson(raw)
          : null,
    );
  }

  bool get hasClockIn => record?.clockIn != null;

  bool get hasClockOut => record?.clockOut != null;

  bool get isOnShift => hasClockIn && !hasClockOut;
}

/// Monthly summary from `GET /attendance/aggregate/:employeeId`.
class AttendanceAggregate {
  const AttendanceAggregate({
    required this.hadir,
    required this.telat,
    required this.absen,
    required this.izin,
    required this.totalLateMinutes,
    required this.totalOvertimeMinutes,
  });

  final int hadir;
  final int telat;
  final int absen;
  final int izin;
  final int totalLateMinutes;
  final int totalOvertimeMinutes;

  factory AttendanceAggregate.fromJson(Map<String, dynamic> json) {
    int n(String key) => (json[key] as num?)?.toInt() ?? 0;
    return AttendanceAggregate(
      hadir: n('hadir'),
      telat: n('telat'),
      absen: n('absen'),
      izin: n('izin'),
      totalLateMinutes: n('total_late_minutes'),
      totalOvertimeMinutes: n('total_overtime_minutes'),
    );
  }
}
