import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';

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

String date(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

Map<String, dynamic> assignmentJson(DateTime tanggal) => {
  'id': 'sa-1',
  'employee_id': 'emp-1',
  'employee_name': 'Siti Nurhaliza',
  'shift_id': 's-1',
  'shift': {
    'id': 's-1',
    'nama_shift': 'Pagi',
    'jam_mulai': '07:00',
    'jam_selesai': '15:00',
    'aktif': true,
  },
  'tanggal': date(tanggal),
  'published': true,
  'published_at': null,
  'published_by_user_id': null,
};

Map<String, dynamic> leaveJson(
  DateTime mulai,
  DateTime selesai,
  String status,
) => {
  'id': 'lr-1',
  'employee_id': 'emp-1',
  'leave_type_id': 'lt-1',
  'leave_type_name': 'Cuti Tahunan',
  'tanggal_mulai': date(mulai),
  'tanggal_selesai': date(selesai),
  'alasan': 'Acara keluarga',
  'status': status,
  'approver_user_id': null,
  'catatan_approver': null,
  'created_at': '2026-08-01T00:00:00.000Z',
  'decided_at': null,
};

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  group('loadMonth', () {
    test('stores assignments keyed by date-only', () async {
      final today = DateTime.now();
      final client = buildTestClient(store, (o) async {
        if (o.path == '/shift-assignments') {
          return jsonResponse({
            'items': [assignmentJson(today)],
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(shiftProvider.notifier);

      await notifier.loadMonth(DateTime(today.year, today.month));

      final state = container.read(shiftProvider);
      expect(state.loading, isFalse);
      expect(state.error, isNull);
      final key = DateTime(today.year, today.month, today.day);
      expect(state.assignmentsByDate.containsKey(key), isTrue);
      expect(state.assignmentsByDate[key]!.shift!.namaShift, 'Pagi');
    });

    test('memoizes the range — a second loadMonth does not refetch', () async {
      var requests = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/shift-assignments') {
          requests++;
          return jsonResponse({'items': <Map<String, dynamic>>[]});
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(shiftProvider.notifier);
      final month = DateTime(DateTime.now().year, DateTime.now().month);

      await notifier.loadMonth(month);
      await notifier.loadMonth(month);

      expect(requests, 1);
    });

    test(
      'paging away and back to the cached month stays at two requests',
      () async {
        var requests = 0;
        final client = buildTestClient(store, (o) async {
          if (o.path == '/shift-assignments') {
            requests++;
            return jsonResponse({'items': <Map<String, dynamic>>[]});
          }
          return jsonErrorResponse('nope', status: 404);
        });
        final container = makeContainer(store, client);
        final notifier = container.read(shiftProvider.notifier);
        final now = DateTime.now();
        final month = DateTime(now.year, now.month);
        final next = DateTime(now.year, now.month + 1);

        await notifier.loadMonth(month);
        await notifier.loadMonth(next);
        await notifier.loadMonth(month);

        expect(requests, 2);
      },
    );

    test('a failed range is NOT cached, so retry refetches', () async {
      var fail = true;
      var requests = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/shift-assignments') {
          requests++;
          if (fail) return jsonErrorResponse('Server bermasalah', status: 500);
          return jsonResponse({'items': <Map<String, dynamic>>[]});
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(shiftProvider.notifier);
      final month = DateTime(DateTime.now().year, DateTime.now().month);

      await notifier.loadMonth(month);
      expect(container.read(shiftProvider).error, 'Server bermasalah');
      expect(container.read(shiftProvider).loading, isFalse);

      fail = false;
      await notifier.loadMonth(month);
      expect(container.read(shiftProvider).error, isNull);
      expect(requests, 2);
    });
  });

  group('loadWeek', () {
    test('fetches a 7-day range and merges into the map', () async {
      final now = DateTime.now();
      var requestedStart = '';
      var requestedEnd = '';
      final client = buildTestClient(store, (o) async {
        if (o.path == '/shift-assignments') {
          requestedStart = o.queryParameters['start'] as String;
          requestedEnd = o.queryParameters['end'] as String;
          return jsonResponse({
            'items': [assignmentJson(now)],
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(shiftProvider.notifier);

      final monday = now.subtract(Duration(days: now.weekday - 1));
      await notifier.loadWeek(monday);

      expect(
        requestedStart,
        date(DateTime(monday.year, monday.month, monday.day)),
      );
      expect(requestedEnd, date(monday.add(const Duration(days: 6))));
      expect(
        container
            .read(shiftProvider)
            .assignmentsByDate
            .containsKey(DateTime(now.year, now.month, now.day)),
        isTrue,
      );
    });
  });

  group('loadUpcoming', () {
    test('fills the upcoming list from /shift-assignments/upcoming', () async {
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      final client = buildTestClient(store, (o) async {
        if (o.path == '/shift-assignments/upcoming') {
          expect(o.queryParameters['days'], 3);
          return jsonResponse({
            'assignments': [assignmentJson(tomorrow)],
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(shiftProvider.notifier);

      await notifier.loadUpcoming(days: 3);

      final state = container.read(shiftProvider);
      expect(state.upcoming, hasLength(1));
      expect(
        state.upcoming.first.tanggal,
        DateTime(tomorrow.year, tomorrow.month, tomorrow.day),
      );
    });
  });

  group('loadLeaveBlocks', () {
    test('marks pending + approved ranges, skips rejected', () async {
      final today = DateTime.now();
      final rejected = today.add(const Duration(days: 10));
      final client = buildTestClient(store, (o) async {
        if (o.path == '/leave-requests') {
          return jsonResponse({
            'items': [
              leaveJson(today, today.add(const Duration(days: 2)), 'pending'),
              leaveJson(rejected, rejected, 'ditolak'),
            ],
            'total': 2,
            'page': 1,
            'limit': 100,
            'has_more': false,
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(shiftProvider.notifier);

      await notifier.loadLeaveBlocks();

      final blocked = container.read(shiftProvider).leaveBlockedDates;
      for (var i = 0; i < 3; i++) {
        final d = today.add(Duration(days: i));
        expect(blocked.contains(DateTime(d.year, d.month, d.day)), isTrue);
      }
      final r = DateTime(rejected.year, rejected.month, rejected.day);
      expect(blocked.contains(r), isFalse);
    });

    test('only fetches leave requests once', () async {
      var requests = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/leave-requests') {
          requests++;
          return jsonResponse({'items': <Map<String, dynamic>>[]});
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(shiftProvider.notifier);

      await notifier.loadLeaveBlocks();
      await notifier.loadLeaveBlocks();

      expect(requests, 1);
    });
  });

  test('clearError clears the one-shot error', () async {
    final client = buildTestClient(store, (o) async {
      return jsonErrorResponse('Server bermasalah', status: 500);
    });
    final container = makeContainer(store, client);
    final notifier = container.read(shiftProvider.notifier);

    await notifier.loadMonth(
      DateTime(DateTime.now().year, DateTime.now().month),
    );
    expect(container.read(shiftProvider).error, isNotNull);

    notifier.clearError();
    expect(container.read(shiftProvider).error, isNull);
  });
}
