import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';
import '../models.dart';

/// Typed access to the BE attendance endpoints (`backend/src/routes/attendance.ts`).
///
/// Every method talks to the shared [ApiClient] — never a raw Dio or a
/// hardcoded host. Times are sent as the device's UTC ISO-8601 claim; the BE
/// treats its own clock as authoritative and only records the claim separately
/// for drift review.
class AttendanceRepository {
  const AttendanceRepository(this._api);

  final ApiClient _api;

  /// `GET /attendance/today` — the current employee's record for today, or
  /// `null` when they have not clocked in yet. The employee is resolved
  /// server-side from the JWT.
  Future<TodayAttendance> getToday() async {
    final data = await _api.get<Map<String, dynamic>>('/attendance/today');
    return TodayAttendance.fromJson(data);
  }

  /// `POST /attendance/clock-in`. The server stamps `clock_in` with its own
  /// clock; [clientTimestamp] is only the drift-review claim.
  ///
  /// Coordinates are attached when the device has a fix; null means "no
  /// coordinates available" (permission denied / service off / no GPS) and the
  /// BE accepts null per the #59 contract.
  Future<void> clockIn({
    required DateTime clientTimestamp,
    String submissionMethod = 'live',
    double? lat,
    double? lng,
    double? accuracyM,
  }) async {
    await _api.post<Map<String, dynamic>>(
      '/attendance/clock-in',
      body: {
        'client_timestamp': clientTimestamp.toUtc().toIso8601String(),
        'submission_method': submissionMethod,
        'lat': lat,
        'lng': lng,
        'accuracy_m': accuracyM,
      },
    );
  }

  /// `POST /attendance/clock-out`. Closes today's record; the server computes
  /// `overtime_minutes` from the shift schedule. Coordinates attach exactly as
  /// in [clockIn].
  Future<void> clockOut({
    required DateTime clientTimestamp,
    String submissionMethod = 'live',
    double? lat,
    double? lng,
    double? accuracyM,
  }) async {
    await _api.post<Map<String, dynamic>>(
      '/attendance/clock-out',
      body: {
        'client_timestamp': clientTimestamp.toUtc().toIso8601String(),
        'submission_method': submissionMethod,
        'lat': lat,
        'lng': lng,
        'accuracy_m': accuracyM,
      },
    );
  }

  /// `GET /attendance/aggregate/:employeeId?period=YYYY-MM` — the month's
  /// hadir/telat/absen/izin counts plus late and overtime totals. The BE
  /// contract takes a `period` string; the mobile interface keeps a
  /// `year` + `month` pair and formats it.
  Future<AttendanceAggregate> getAggregate({
    required String employeeId,
    required int year,
    required int month,
  }) async {
    final period =
        '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}';
    final data = await _api.get<Map<String, dynamic>>(
      '/attendance/aggregate/$employeeId',
      query: {'period': period},
    );
    return AttendanceAggregate.fromJson(data);
  }

  /// `POST /attendance/:id/selfie` (multipart, field `file`) — attaches the
  /// compressed verification selfie to a clock-in record. The BE re-encodes
  /// server-side and enforces size/content-type; the upload is idempotent per
  /// record (a second call overwrites with a fresh retention period).
  Future<SelfieUpload> uploadSelfie({
    required String attendanceId,
    required File file,
  }) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: 'selfie.jpg',
        contentType: DioMediaType('image', 'jpeg'),
      ),
    });
    final data = await _api.post<Map<String, dynamic>>(
      '/attendance/$attendanceId/selfie',
      body: form,
    );
    return SelfieUpload.fromJson(data);
  }

  /// `GET /attendance/:id/selfie` — raw image bytes. The caller can only ever
  /// fetch its own attendance record (the BE 403s cross-employee access);
  /// past retention the BE returns 410.
  Future<Uint8List> downloadSelfie({required String attendanceId}) async {
    return _api.getBytes('/attendance/$attendanceId/selfie');
  }
}