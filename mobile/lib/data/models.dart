import '../core/format.dart';

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
  return DateTime(
    int.parse(parts[0]),
    int.parse(parts[1]),
    int.parse(parts[2]),
  );
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
  String get label => namaShift == 'Libur' ? 'Libur' : 'Shift $namaShift';

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
      shift: rawShift is Map<String, dynamic> ? Shift.fromJson(rawShift) : null,
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

/// One line of the server's payslip breakdown — `nama_komponen` + `nominal`
/// (`backend/src/lib/payslip-breakdown.ts#BreakdownLine`). Rendered verbatim;
/// the client never recomputes or re-labels a compliance line.
class PayslipLine {
  const PayslipLine({required this.namaKomponen, required this.nominal});

  final String namaKomponen;
  final int nominal;

  factory PayslipLine.fromJson(Map<String, dynamic> json) {
    return PayslipLine(
      namaKomponen: json['nama_komponen'] as String? ?? 'Komponen',
      nominal: (json['nominal'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Server-computed payslip totals. The BE is the source of truth — take-home,
/// earnings and deductions totals are read from here, never summed client-side.
class PayslipTotals {
  const PayslipTotals({
    required this.totalEarnings,
    required this.totalDeductions,
    required this.takeHome,
  });

  final int totalEarnings;
  final int totalDeductions;
  final int takeHome;

  factory PayslipTotals.fromJson(Map<String, dynamic> json) {
    return PayslipTotals(
      totalEarnings: (json['total_earnings'] as num?)?.toInt() ?? 0,
      totalDeductions: (json['total_deductions'] as num?)?.toInt() ?? 0,
      takeHome: (json['take_home'] as num?)?.toInt() ?? 0,
    );
  }
}

/// The per-line earnings + deductions breakdown from `GET /payslips/:id`
/// (ticket #42). `totals` is the server's own arithmetic; the client renders
/// the lines and totals exactly as received.
class PayslipBreakdown {
  const PayslipBreakdown({
    required this.earnings,
    required this.deductions,
    required this.totals,
  });

  final List<PayslipLine> earnings;
  final List<PayslipLine> deductions;
  final PayslipTotals totals;

  factory PayslipBreakdown.fromJson(Map<String, dynamic> json) {
    return PayslipBreakdown(
      earnings: _lines(json['earnings']),
      deductions: _lines(json['deductions']),
      totals: PayslipTotals.fromJson(
        json['totals'] is Map<String, dynamic>
            ? json['totals'] as Map<String, dynamic>
            : const <String, dynamic>{},
      ),
    );
  }

  static List<PayslipLine> _lines(Object? raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(PayslipLine.fromJson)
        .toList();
  }
}

/// One payslip row from `GET /payslips` — the summary the list and the Beranda
/// latest row render. The full breakdown lives on [PayslipDetail] and is
/// fetched on demand so the list never carries line arithmetic.
class Payslip {
  const Payslip({
    required this.id,
    required this.periode,
    required this.status,
    required this.employeeName,
    required this.takeHome,
    this.createdAt,
    this.pdfUrl,
    this.isThr = false,
  });

  final String id;

  /// `YYYY-MM` from the BE (e.g. `2026-08`).
  final String periode;

  /// `draft` | `disetujui` | `locked` — mirrors the payroll run status.
  final String status;

  final String employeeName;
  final int takeHome;
  final DateTime? createdAt;
  final String? pdfUrl;

  /// THR is a server decision (`is_thr` flag or `category: "thr"`), never a
  /// client fixture. Absent fields default to a regular monthly payslip.
  final bool isThr;

  /// The calendar year a `YYYY-MM` periode belongs to; used by the year
  /// filter chips. Falls back to the current year for non-periodic keys.
  int get year {
    final parts = periode.split('-');
    final y = parts.isNotEmpty ? int.tryParse(parts.first) : null;
    return y ?? DateTime.now().year;
  }

  /// `2026-08` -> `Agustus 2026`; non-periodic keys (e.g. `THR-2026`) pass
  /// through with a server-tolerant fallback.
  String get periodLabel => _periodLabel(periode);

  /// A payslip an employee can rely on — approved or locked runs. Draft rows
  /// are not yet payable.
  bool get paid => status == 'disetujui' || status == 'locked';

  factory Payslip.fromJson(Map<String, dynamic> json) {
    return Payslip(
      id: json['id'] as String,
      periode: json['periode'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      employeeName:
          (json['employee'] is Map<String, dynamic>
                  ? json['employee'] as Map<String, dynamic>
                  : const <String, dynamic>{})['nama_lengkap']
              as String? ??
          'Karyawan',
      takeHome: (json['take_home'] as num?)?.toInt() ?? 0,
      createdAt: switch (json['created_at']) {
        final String raw => DateTime.tryParse(raw),
        _ => null,
      },
      pdfUrl: json['pdf_url'] as String?,
      isThr:
          json['is_thr'] == true ||
          (json['category'] as String?)?.toLowerCase() == 'thr',
    );
  }
}

/// Full payslip payload from `GET /payslips/:id` (ticket #42). Holds the
/// server's per-line breakdown plus its computed totals; nothing on this
/// model is derived client-side.
class PayslipDetail {
  const PayslipDetail({
    required this.id,
    required this.periode,
    required this.employeeName,
    required this.jabatan,
    required this.breakdown,
    this.pdfUrl,
  });

  final String id;
  final String periode;
  final String employeeName;
  final String jabatan;
  final PayslipBreakdown breakdown;
  final String? pdfUrl;

  String get periodLabel => _periodLabel(periode);

  int get takeHome => breakdown.totals.takeHome;
  int get totalEarnings => breakdown.totals.totalEarnings;
  int get totalDeductions => breakdown.totals.totalDeductions;

  factory PayslipDetail.fromJson(Map<String, dynamic> json) {
    final employee = json['employee'] is Map<String, dynamic>
        ? json['employee'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return PayslipDetail(
      id: json['id'] as String,
      periode: json['periode'] as String? ?? '',
      employeeName: employee['nama'] as String? ?? 'Karyawan',
      jabatan: employee['jabatan'] as String? ?? '',
      breakdown: PayslipBreakdown.fromJson(
        json['breakdown'] is Map<String, dynamic>
            ? json['breakdown'] as Map<String, dynamic>
            : const <String, dynamic>{},
      ),
      pdfUrl: json['pdf_url'] as String?,
    );
  }
}

String _periodLabel(String periode) {
  final parts = periode.split('-');
  if (parts.length != 2) return periode;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (y == null || m == null || m < 1 || m > 12) return periode;
  return '${Fmt.monthNames[m - 1]} $y';
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
      overtimeOverrideMinutes: (json['overtime_override_minutes'] as num?)
          ?.toInt(),
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

/// The business's work-area point, from `GET /businesses/:id/geofence`
/// (ticket #67 contract: `{ workLat, workLng, radiusMeters }`). The mobile
/// computes distance with `Geolocator.distanceBetween` against this point and
/// evaluates on-site/off-site client-side until #67 also returns the server's
/// evaluation on the today record.
class Geofence {
  const Geofence({
    required this.workLat,
    required this.workLng,
    required this.radiusMeters,
    this.isMock = false,
  });

  final double workLat;
  final double workLng;
  final double radiusMeters;

  /// True when the repository fell back to the dev mock point because the
  /// geofence endpoint (or the configured work location) does not exist yet.
  /// The chip renders identically — this only distinguishes dev data.
  final bool isMock;

  bool get isConfigured => radiusMeters > 0;

  factory Geofence.fromJson(Map<String, dynamic> json) {
    double coord(String camel, String snake) =>
        (json[camel] as num?)?.toDouble() ??
        (json[snake] as num?)?.toDouble() ??
        0;
    return Geofence(
      workLat: coord('workLat', 'work_lat'),
      workLng: coord('workLng', 'work_lng'),
      radiusMeters: coord('radiusMeters', 'radius_meters'),
    );
  }
}

/// Upload result of a selfie verification photo (`POST /attendance/:id/selfie`,
/// ticket #69). The server owns retention: `retentionUntil` is when the photo
/// stops being retrievable and is shown verbatim in the success hint
/// ("tersedia selama 90 hari").
class SelfieUpload {
  const SelfieUpload({
    required this.url,
    required this.sizeBytes,
    required this.retentionUntil,
  });

  final String url;
  final int sizeBytes;
  final DateTime retentionUntil;

  factory SelfieUpload.fromJson(Map<String, dynamic> json) {
    return SelfieUpload(
      url: json['url'] as String? ?? '',
      sizeBytes: (json['size_bytes'] as num?)?.toInt() ?? 0,
      retentionUntil: switch (json['retention_until']) {
        final String raw => DateTime.tryParse(raw) ?? DateTime.now(),
        _ => DateTime.now(),
      },
    );
  }
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

/// Notification preferences from `GET/PATCH /api/notification-prefs/me`
/// (ticket #71). The server is the source of truth; a missing row reads as the
/// defaults (reminders on, 30 minutes before shift start).
class NotificationPrefs {
  const NotificationPrefs({
    required this.shiftRemindersEnabled,
    required this.reminderLeadMinutes,
  });

  final bool shiftRemindersEnabled;
  final int reminderLeadMinutes;

  factory NotificationPrefs.fromJson(Map<String, dynamic> json) {
    return NotificationPrefs(
      shiftRemindersEnabled: json['shift_reminders_enabled'] as bool? ?? true,
      reminderLeadMinutes:
          (json['reminder_lead_minutes'] as num?)?.toInt() ?? 30,
    );
  }
}

/// One registered push device from `GET /api/devices`
/// (`backend/src/routes/devices.ts`, ticket #71). Rows are keyed by
/// `(user_id, token)` server-side, so the list is deduplicated.
class DeviceRegistration {
  const DeviceRegistration({
    required this.id,
    required this.platform,
    required this.token,
    this.appVersion,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String platform;
  final String token;
  final String? appVersion;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory DeviceRegistration.fromJson(Map<String, dynamic> json) {
    return DeviceRegistration(
      id: json['id'] as String? ?? '',
      platform: json['platform'] as String? ?? '',
      token: json['token'] as String? ?? '',
      appVersion: json['app_version'] as String?,
      createdAt: _parseInstant(json['created_at']),
      updatedAt: _parseInstant(json['updated_at']),
    );
  }
}
