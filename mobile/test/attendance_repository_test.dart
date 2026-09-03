import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/repositories/attendance_repository.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  AttendanceRepository repoFor(
    Future<ResponseBody> Function(RequestOptions) handler,
  ) =>
      AttendanceRepository(buildTestClient(store, handler));

  Map<String, dynamic> recordJson({
    String? clockIn,
    String? clockOut,
    int lateMinutes = 0,
    int overtimeMinutes = 0,
  }) =>
      {
        'id': 'att-1',
        'employee_id': 'emp-1',
        'tanggal': '2026-09-03',
        'clock_in': clockIn,
        'clock_out': clockOut,
        'catatan': null,
        'status': 'hadir',
        'late_minutes': lateMinutes,
        'overtime_minutes': overtimeMinutes,
        'overtime_override_minutes': null,
        'submission_method': 'live',
        'time_drift_detected': false,
      };

  group('getToday', () {
    test('GETs /attendance/today and wraps the record', () async {
      final repo = repoFor((o) async {
        expect(o.path, '/attendance/today');
        return jsonResponse({
          'record': recordJson(clockIn: '2026-09-03T00:58:00.000Z'),
        });
      });

      final today = await repo.getToday();

      expect(today.record, isNotNull);
      expect(today.hasClockIn, isTrue);
      expect(today.isOnShift, isTrue);
      expect(today.hasClockOut, isFalse);
      expect(
        today.record!.clockIn,
        DateTime.parse('2026-09-03T00:58:00.000Z'),
      );
    });

    test('returns an empty TodayAttendance when the record is null', () async {
      final repo = repoFor((o) async => jsonResponse({'record': null}));

      final today = await repo.getToday();

      expect(today.record, isNull);
      expect(today.hasClockIn, isFalse);
      expect(today.isOnShift, isFalse);
    });

    test('parses late and overtime minutes verbatim', () async {
      final repo = repoFor((o) async {
        return jsonResponse({
          'record': recordJson(
            clockIn: '2026-09-03T00:58:00.000Z',
            lateMinutes: 12,
            overtimeMinutes: 45,
          ),
        });
      });

      final today = await repo.getToday();

      expect(today.record!.lateMinutes, 12);
      expect(today.record!.overtimeMinutes, 45);
      expect(today.record!.effectiveOvertimeMinutes, 45);
    });
  });

  group('clockIn / clockOut', () {
    test('clockIn POSTs to /attendance/clock-in with a live payload', () async {
      String? path;
      Map<String, dynamic>? body;
      final repo = repoFor((o) async {
        path = o.path;
        body = (o.data as Map).cast<String, dynamic>();
        return jsonResponse({'record': recordJson()});
      });

      final ts = DateTime.utc(2026, 9, 3, 0, 58);
      await repo.clockIn(clientTimestamp: ts);

      expect(path, '/attendance/clock-in');
      expect(body!['client_timestamp'], '2026-09-03T00:58:00.000Z');
      expect(body!['submission_method'], 'live');
    });

    test('clockOut POSTs to /attendance/clock-out with a live payload', () async {
      String? path;
      Map<String, dynamic>? body;
      final repo = repoFor((o) async {
        path = o.path;
        body = (o.data as Map).cast<String, dynamic>();
        return jsonResponse({'record': recordJson()});
      });

      final ts = DateTime.utc(2026, 9, 3, 7, 0);
      await repo.clockOut(clientTimestamp: ts);

      expect(path, '/attendance/clock-out');
      expect(body!['client_timestamp'], '2026-09-03T07:00:00.000Z');
      expect(body!['submission_method'], 'live');
    });

    test('honors a non-live submission method (offline flush)', () async {
      Map<String, dynamic>? body;
      final repo = repoFor((o) async {
        body = (o.data as Map).cast<String, dynamic>();
        return jsonResponse({'record': recordJson()});
      });

      await repo.clockIn(
        clientTimestamp: DateTime.utc(2026, 9, 3, 0, 58),
        submissionMethod: 'offline_queue',
      );

      expect(body!['submission_method'], 'offline_queue');
    });
  });

  group('getAggregate', () {
    test('GETs the period-scoped aggregate for the employee', () async {
      String? path;
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        path = o.path;
        query = o.queryParameters;
        return jsonResponse({
          'hadir': 21,
          'telat': 2,
          'absen': 0,
          'izin': 1,
          'total_late_minutes': 45,
          'total_overtime_minutes': 180,
        });
      });

      final agg = await repo.getAggregate(
        employeeId: 'emp-1',
        year: 2026,
        month: 9,
      );

      expect(path, '/attendance/aggregate/emp-1');
      // The BE contract takes period=YYYY-MM, derived from year + month.
      expect(query!['period'], '2026-09');
      expect(agg.hadir, 21);
      expect(agg.telat, 2);
      expect(agg.absen, 0);
      expect(agg.izin, 1);
      expect(agg.totalLateMinutes, 45);
      expect(agg.totalOvertimeMinutes, 180);
    });

    test('zero-pads the period (Jan single digit)', () async {
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        query = o.queryParameters;
        return jsonResponse({
          'hadir': 0,
          'telat': 0,
          'absen': 0,
          'izin': 0,
          'total_late_minutes': 0,
          'total_overtime_minutes': 0,
        });
      });

      await repo.getAggregate(employeeId: 'emp-1', year: 2026, month: 1);

      expect(query!['period'], '2026-01');
    });
  });
}