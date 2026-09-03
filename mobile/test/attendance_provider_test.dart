import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';

import 'helpers.dart';

ProviderContainer makeContainer(SecureSessionStore store, ApiClient client) {
  final container = ProviderContainer(
    overrides: [
      secureSessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
      signedInEmployeeOverride,
    ],
  );
  addTearDown(container.dispose);
  return container;
}

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

Map<String, dynamic> aggregateJson() => {
  'hadir': 21,
  'telat': 2,
  'absen': 0,
  'izin': 1,
  'total_late_minutes': 45,
  'total_overtime_minutes': 180,
};

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  group('loadToday', () {
    test('stores the today record and clears loading', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/today') {
          return jsonResponse({
            'record': recordJson(clockIn: '2026-09-03T00:58:00.000Z'),
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.loadToday();

      final state = container.read(attendanceProvider);
      expect(state.loading, isFalse);
      expect(state.error, isNull);
      expect(state.today, isNotNull);
      expect(state.today!.isOnShift, isTrue);
    });

    test('surfaces the BE message and clears loading on failure', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('Server bermasalah', status: 500);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.loadToday();

      final state = container.read(attendanceProvider);
      expect(state.loading, isFalse);
      expect(state.today, isNull);
      expect(state.error, 'Server bermasalah');
    });
  });

  group('loadAggregate', () {
    test('loads the current month for the signed-in employee', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/aggregate/emp-1') {
          return jsonResponse(aggregateJson());
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.loadAggregate();

      final aggregate = container.read(attendanceProvider).aggregate;
      expect(aggregate, isNotNull);
      expect(aggregate!.hadir, 21);
      expect(aggregate.telat, 2);
      expect(aggregate.totalLateMinutes, 45);
    });
  });

  group('clockIn', () {
    test('posts live, refetches today, and ends idle', () async {
      var clockedIn = false;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          expect((o.data as Map)['submission_method'], 'live');
          expect((o.data as Map)['client_timestamp'], isNotNull);
          clockedIn = true;
          return jsonResponse({'record': recordJson()});
        }
        if (o.path == '/attendance/today') {
          return jsonResponse({
            'record': clockedIn
                ? recordJson(clockIn: '2026-09-03T00:58:00.000Z')
                : null,
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.clockIn();

      final state = container.read(attendanceProvider);
      expect(state.submitting, isFalse);
      expect(state.actionError, isNull);
      expect(state.today!.hasClockIn, isTrue);
    });

    test('double-tap produces exactly one clock-in request', () async {
      final gate = Completer<void>();
      var requests = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          requests++;
          await gate.future;
          return jsonResponse({'record': recordJson()});
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      final first = notifier.clockIn();
      // A second tap while the first write is in flight must no-op.
      await notifier.clockIn();
      expect(container.read(attendanceProvider).submitting, isTrue);

      gate.complete();
      await first;

      expect(requests, 1);
      expect(container.read(attendanceProvider).submitting, isFalse);
    });

    test('server rejection surfaces the BE message verbatim', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          return jsonErrorResponse(
            'Anda sudah melakukan clock-in pada tanggal ini',
            status: 409,
          );
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.clockIn();

      final state = container.read(attendanceProvider);
      expect(state.submitting, isFalse);
      expect(state.actionError, 'Anda sudah melakukan clock-in pada tanggal ini');

      // The message is one-shot: clearing it resets the state for the next
      // snackbar.
      notifier.clearActionError();
      expect(container.read(attendanceProvider).actionError, isNull);
    });

    test('no-shift rejection (422) surfaces as actionError', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          return jsonErrorResponse('Belum ada shift untuk hari ini', status: 422);
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.clockIn();

      expect(
        container.read(attendanceProvider).actionError,
        'Belum ada shift untuk hari ini',
      );
    });
  });

  group('clockOut', () {
    test('posts live and reconciles today with clock_out set', () async {
      var clockedOut = false;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-out') {
          expect((o.data as Map)['submission_method'], 'live');
          clockedOut = true;
          return jsonResponse({'record': recordJson()});
        }
        if (o.path == '/attendance/today') {
          return jsonResponse({
            'record': recordJson(
              clockIn: '2026-09-03T00:58:00.000Z',
              clockOut: clockedOut ? '2026-09-03T07:00:00.000Z' : null,
            ),
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.clockOut();

      final state = container.read(attendanceProvider);
      expect(state.submitting, isFalse);
      expect(state.actionError, isNull);
      expect(state.today!.hasClockOut, isTrue);
      expect(state.today!.isOnShift, isFalse);
    });

    test('clock-out without a clock-in surfaces the BE message', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-out') {
          return jsonErrorResponse('Belum ada clock-in untuk tanggal ini', status: 409);
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(attendanceProvider.notifier);

      await notifier.clockOut();

      expect(
        container.read(attendanceProvider).actionError,
        'Belum ada clock-in untuk tanggal ini',
      );
    });
  });
}