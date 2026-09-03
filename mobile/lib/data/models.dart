enum ShiftKind { pagi, siang, malam, libur }

/// Map a BE shift name (`Pagi` / `Siang` / `Malam`, or a custom label) onto
/// the fixed [ShiftKind] used for calendar colouring. Unknown/custom names
/// fall back to [ShiftKind.libur].
ShiftKind shiftKindOf(String namaShift) => switch (namaShift) {
  'Pagi' => ShiftKind.pagi,
  'Siang' => ShiftKind.siang,
  'Malam' => ShiftKind.malam,
  _ => ShiftKind.libur,
};

/// `YYYY-MM-DD` -> `DateTime(y, m, d)` (date-only, no time component).
DateTime parseDateOnly(String raw) {
  final parts = raw.split('-');
  return DateTime(int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
}

enum LeaveStatus { menunggu, disetujui, ditolak }

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

/// A shift from the BE (`backend/src/db/schema.ts#shifts`). Rendered verbatim:
/// the name and times come from the server, never inferred on the client.
class Shift {
  const Shift({
    required this.id,
    required this.namaShift,
    required this.jamMulai,
    required this.jamSelesai,
    required this.aktif,
  });

  final String id;
  final String namaShift;
  final String jamMulai;
  final String jamSelesai;
  final bool aktif;

  /// `Shift Pagi`, `Shift Siang`, … — `Libur` has no prefix.
  String get label =>
      namaShift == 'Libur' ? 'Libur' : 'Shift $namaShift';

  /// `07:00 – 15:00`
  String get range => '$jamMulai – $jamSelesai';

  factory Shift.fromJson(Map<String, dynamic> json) {
    return Shift(
      id: json['id'] as String,
      namaShift: json['nama_shift'] as String,
      jamMulai: json['jam_mulai'] as String,
      jamSelesai: json['jam_selesai'] as String,
      aktif: json['aktif'] as bool? ?? true,
    );
  }
}

/// One published roster row from the BE
/// (`backend/src/routes/shift-assignments.ts`). Carries the shift it points
/// at, so the schedule needs no separate shifts catalogue fetch.
class ShiftAssignment {
  const ShiftAssignment({
    required this.id,
    required this.employeeId,
    this.employeeName,
    required this.shiftId,
    this.shift,
    required this.tanggal,
    required this.published,
  });

  final String id;
  final String employeeId;

  /// The employee's full name — the assignment rows are employee-scoped, so
  /// this is the roster owner's name, not a peer's.
  final String? employeeName;
  final String shiftId;
  final Shift? shift;

  /// `tanggal` from the BE, parsed as a date-only [DateTime].
  final DateTime tanggal;
  final bool published;

  factory ShiftAssignment.fromJson(Map<String, dynamic> json) {
    final rawShift = json['shift'];
    return ShiftAssignment(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      employeeName: json['employee_name'] as String?,
      shiftId: json['shift_id'] as String,
      shift: rawShift is Map<String, dynamic>
          ? Shift.fromJson(rawShift)
          : null,
      tanggal: parseDateOnly(json['tanggal'] as String),
      published: json['published'] as bool? ?? false,
    );
  }
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

/// A leave request from the BE (`backend/src/routes/leave-requests.ts`),
/// rendered on CutiScreen and used by the schedule to mark blocked days. The
/// type name comes from the server verbatim — never inferred client-side.
class LeaveRequest {
  const LeaveRequest({
    required this.id,
    required this.leaveTypeName,
    required this.status,
    required this.start,
    required this.end,
    required this.days,
    this.reason,
    this.decisionNote,
    this.submittedAt,
  });

  final String id;
  final String leaveTypeName;
  final LeaveStatus status;
  final DateTime start;
  final DateTime end;
  final int days;
  final String? reason;

  /// `catatan_approver` from the BE — the approver's decision note.
  final String? decisionNote;

  /// `created_at` from the BE, for the "Diajukan {tanggal}" trailing line.
  final DateTime? submittedAt;

  String get kindLabel {
    final name = leaveTypeName.trim();
    return name.toLowerCase().startsWith('cuti ') ? name : 'Cuti $name';
  }

  String get statusLabel => switch (status) {
    LeaveStatus.menunggu => 'Menunggu',
    LeaveStatus.disetujui => 'Disetujui',
    LeaveStatus.ditolak => 'Ditolak',
  };

  String? get meta {
    final submitted = submittedAt;
    if (submitted == null) return null;
    final d =
        '${submitted.day.toString().padLeft(2, '0')}/'
        '${submitted.month.toString().padLeft(2, '0')}/${submitted.year}';
    return 'Diajukan $d';
  }

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    final start = parseDateOnly(json['tanggal_mulai'] as String);
    final end = parseDateOnly(json['tanggal_selesai'] as String);
    return LeaveRequest(
      id: json['id'] as String,
      leaveTypeName: json['leave_type_name'] as String? ?? 'Cuti',
      status: switch (json['status'] as String?) {
        'disetujui' => LeaveStatus.disetujui,
        'ditolak' => LeaveStatus.ditolak,
        _ => LeaveStatus.menunggu,
      },
      start: start,
      end: end,
      days: end.difference(start).inDays + 1,
      reason: json['alasan'] as String?,
      decisionNote: json['catatan_approver'] as String?,
      submittedAt: _parseInstant(json['created_at']),
    );
  }
}

/// One active leave type from the BE (`backend/src/routes/leave-types.ts`).
/// The form's chips are built from these — there is no fixed five-type list.
class LeaveType {
  const LeaveType({
    required this.id,
    required this.nama,
    required this.defaultKuotaHari,
    required this.kebijakanSisa,
    this.carryOverMaxDays,
    required this.aktif,
  });

  final String id;
  final String nama;
  final int defaultKuotaHari;

  /// `hangus` or `carry-over`.
  final String kebijakanSisa;
  final int? carryOverMaxDays;
  final bool aktif;

  /// `Tahunan` -> `Cuti Tahunan`; already-prefixed names pass through.
  String get label {
    final name = nama.trim();
    return name.toLowerCase().startsWith('cuti ') ? name : 'Cuti $name';
  }

  factory LeaveType.fromJson(Map<String, dynamic> json) {
    return LeaveType(
      id: json['id'] as String,
      nama: json['nama_jenis_cuti'] as String,
      defaultKuotaHari: (json['default_kuota_hari'] as num?)?.toInt() ?? 0,
      kebijakanSisa: json['kebijakan_sisa'] as String? ?? 'hangus',
      carryOverMaxDays: (json['carry_over_max_days'] as num?)?.toInt(),
      aktif: json['aktif'] as bool? ?? true,
    );
  }
}

/// One leave balance row from the BE (`backend/src/routes/leave-balances.ts`),
/// labelled by `nama_jenis_cuti` and carrying the year its quota applies to.
class LeaveBalance {
  const LeaveBalance({
    required this.label,
    required this.remaining,
    required this.total,
    required this.tahun,
  });

  final String label;
  final int remaining;
  final int total;

  /// The balance's quota year; the quota hangs over (or carries over) at the
  /// end of it.
  final int tahun;

  /// `31/12/{tahun}` — the day the remaining balance stops being usable.
  DateTime get expiry => DateTime(tahun, 12, 31);

  factory LeaveBalance.fromJson(Map<String, dynamic> json) {
    final kuota = (json['kuota_hari'] as num?)?.toInt() ?? 0;
    final terpakai = (json['terpakai_hari'] as num?)?.toInt() ?? 0;
    return LeaveBalance(
      label: json['nama_jenis_cuti'] as String? ?? 'Cuti',
      remaining: (json['sisa_hari'] as num?)?.toInt() ?? kuota - terpakai,
      total: kuota,
      tahun: (json['tahun'] as num?)?.toInt() ?? DateTime.now().year,
    );
  }
}

/// The BE serializes `created_at` (a timestamp column) as an ISO-8601 string
/// via JSON.stringify; be tolerant of an epoch number too.
DateTime? _parseInstant(Object? raw) {
  if (raw is String) {
    final parsed = DateTime.tryParse(raw);
    if (parsed != null) return parsed;
    final epoch = int.tryParse(raw);
    if (epoch != null) {
      return DateTime.fromMillisecondsSinceEpoch(epoch * 1000);
    }
  }
  if (raw is num) {
    return DateTime.fromMillisecondsSinceEpoch((raw * 1000).round());
  }
  return null;
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
