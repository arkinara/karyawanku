import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/connectivity/connectivity_provider.dart';
import 'package:karyawanku_mobile/data/local/offline_queue.dart';
import 'package:karyawanku_mobile/features/absensi/offline_queue_manager.dart';

import 'helpers.dart';

/// A connectivity notifier the test can flip to simulate going online/offline.
class _FlippableOnline extends OnlineNotifier {
  _FlippableOnline(this.initial);
  final bool initial;

  @override
  bool build() => initial;

  void setOnline(bool value) => state = value;
}

void main() {
  setUpAll(sqfliteFfiInit);

  late List<int> delays;
  late InMemoryBackend backend;
  late SecureSessionStore store;
  late _FlippableOnline online;

  setUp(() {
    delays = [];
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
    online = _FlippableOnline(true);
  });

  Future<OfflineQueue> freshQueue() {
    // Unique in-memory URI per queue — `:memory:` is cached per isolate.
    final memDb =
        'file:kk-manager-${DateTime.now().microsecondsSinceEpoch}?mode=memory&cache=shared';
    return OfflineQueue.open(factory: databaseFactoryFfi, path: memDb);
  }

  /// A container with a real queue manager (injected zero-gate delay), a real
  /// store, and a canned HTTP handler.
  ProviderContainer makeContainer(
    OfflineQueue queue,
    Future<ResponseBody> Function(RequestOptions) handler, {
    bool onlineInitially = true,
  }) {
    online = _FlippableOnline(onlineInitially);
    final client = buildTestClient(store, handler);
    final container = ProviderContainer(
      overrides: [
        secureSessionStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(client),
        isOnlineProvider.overrideWith(() => online),
        offlineQueueStoreProvider.overrideWith((ref) async => queue),
        offlineQueueManagerProvider.overrideWith(
          () => OfflineQueueManager(delay: (s) async => delays.add(s)),
        ),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  Future<void> waitUntil(
    Future<bool> Function() cond, {
    Duration timeout = const Duration(seconds: 3),
  }) async {
    final deadline = DateTime.now().add(timeout);
    while (!await cond()) {
      if (DateTime.now().isAfter(deadline)) fail('condition timed out');
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  }

  test('does not flush while offline', () async {
    final queue = await freshQueue();
    await queue.enqueue(
      idempotencyKey: 'k-1',
      actionAt: DateTime(2026, 9, 3, 7, 45),
      kind: QueuedAttendanceKind.clockIn,
    );
    var called = 0;
    final container = makeContainer(queue, (o) async {
      called++;
      return jsonResponse({'record': <String, dynamic>{}});
    }, onlineInitially: false);
    final manager = container.read(offlineQueueManagerProvider.notifier);

    await manager.flush();

    expect(called, 0);
    expect(
      (await queue.pending()).single.status,
      QueuedAttendanceStatus.pending,
    );
  });

  test('flushes pending entries on the online event', () async {
    final queue = await freshQueue();
    final actionAt = DateTime(2026, 9, 3, 7, 45);
    await queue.enqueue(
      idempotencyKey: 'k-1',
      actionAt: actionAt,
      kind: QueuedAttendanceKind.clockIn,
    );

    String? seenKey;
    String? seenMethod;
    String? seenTimestamp;
    final container = makeContainer(queue, (o) async {
      expect(o.path, '/attendance/clock-in');
      seenKey = (o.headers['Idempotency-Key'] as String?) ?? '';
      final body = (o.data as Map).cast<String, dynamic>();
      seenMethod = body['submission_method'] as String?;
      seenTimestamp = body['client_timestamp'] as String?;
      return jsonResponse({'record': <String, dynamic>{}});
    }, onlineInitially: false);
    container.read(offlineQueueManagerProvider.notifier); // start the manager
    await Future<void>.delayed(Duration.zero);

    // Going online triggers the manager's listener → flush.
    online.setOnline(true);

    await waitUntil(
      () async =>
          (await queue.all()).single.status == QueuedAttendanceStatus.sent,
    );

    expect(seenKey, 'k-1');
    expect(seenMethod, 'offline_queue');
    expect(seenTimestamp, actionAt.toUtc().toIso8601String());
    expect(await queue.pending(), isEmpty);
  });

  test('flush() on a foreground trigger sends pending entries', () async {
    final queue = await freshQueue();
    await queue.enqueue(
      idempotencyKey: 'k-1',
      actionAt: DateTime(2026, 9, 3, 7, 45),
      kind: QueuedAttendanceKind.clockIn,
    );
    var sent = false;
    final container = makeContainer(queue, (o) async {
      expect(o.path, '/attendance/clock-in');
      sent = true;
      return jsonResponse({'record': <String, dynamic>{}});
    });
    final manager = container.read(offlineQueueManagerProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    // The Absensi screen calls flush() on AppLifecycleState.resumed.
    await manager.flush();

    expect(sent, isTrue);
    await waitUntil(
      () async =>
          (await queue.all()).single.status == QueuedAttendanceStatus.sent,
    );
  });

  test('4xx marks the entry permanently failed (never auto-retried)', () async {
    final queue = await freshQueue();
    await queue.enqueue(
      idempotencyKey: 'k-1',
      actionAt: DateTime(2026, 9, 3, 7, 45),
      kind: QueuedAttendanceKind.clockIn,
    );
    final container = makeContainer(
      queue,
      (o) async => jsonErrorResponse(
        'Anda sudah melakukan clock-in pada tanggal ini',
        status: 409,
      ),
    );
    final manager = container.read(offlineQueueManagerProvider.notifier);

    await manager.flush();

    final entry = (await queue.all()).single;
    expect(entry.status, QueuedAttendanceStatus.permanentlyFailed);
    expect(entry.error, 'Anda sudah melakukan clock-in pada tanggal ini');
    expect(await queue.pending(), isEmpty);
  });

  test('5xx leaves the entry pending for the next trigger', () async {
    final queue = await freshQueue();
    await queue.enqueue(
      idempotencyKey: 'k-1',
      actionAt: DateTime(2026, 9, 3, 7, 45),
      kind: QueuedAttendanceKind.clockIn,
    );
    final container = makeContainer(
      queue,
      (o) async => jsonErrorResponse('Server bermasalah', status: 500),
    );
    final manager = container.read(offlineQueueManagerProvider.notifier);

    await manager.flush();

    final entry = (await queue.all()).single;
    expect(entry.status, QueuedAttendanceStatus.pending);
    expect(await queue.pending(), hasLength(1));
  });

  test(
    'respects exponential backoff: gate after failure, reset on success',
    () async {
      final queue = await freshQueue();
      await queue.enqueue(
        idempotencyKey: 'k-1',
        actionAt: DateTime(2026, 9, 3, 7, 45),
        kind: QueuedAttendanceKind.clockIn,
      );
      var calls = 0;
      final container = makeContainer(queue, (o) async {
        calls++;
        if (calls == 1) return jsonErrorResponse('server 500', status: 500);
        return jsonResponse({'record': <String, dynamic>{}});
      });
      final manager = container.read(offlineQueueManagerProvider.notifier);

      // First flush fails → backoff doubles 2 → 4. No gate on the first attempt.
      await manager.flush();
      expect(delays.where((d) => d == 4), isEmpty);

      // Second flush is gated by the doubled backoff, then succeeds.
      await manager.flush();
      expect(delays.where((d) => d == 4), isNotEmpty);
      expect((await queue.all()).single.status, QueuedAttendanceStatus.sent);

      // Success resets the window: a new entry flushes without a 4s gate.
      await queue.enqueue(
        idempotencyKey: 'k-2',
        actionAt: DateTime(2026, 9, 3, 17, 0),
        kind: QueuedAttendanceKind.clockOut,
      );
      await manager.flush();
      expect(delays.where((d) => d == 4), hasLength(1));
      expect((await queue.all()).last.status, QueuedAttendanceStatus.sent);
    },
  );

  test('retry() requeues a permanently failed entry', () async {
    final queue = await freshQueue();
    await queue.enqueue(
      idempotencyKey: 'k-1',
      actionAt: DateTime(2026, 9, 3, 7, 45),
      kind: QueuedAttendanceKind.clockIn,
    );
    await queue.markFailed('k-1', 'Sudah clock-in', permanent: true);
    var sent = false;
    final container = makeContainer(queue, (o) async {
      sent = true;
      return jsonResponse({'record': <String, dynamic>{}});
    });
    final manager = container.read(offlineQueueManagerProvider.notifier);

    await manager.retry('k-1');

    expect(sent, isTrue);
    await waitUntil(
      () async =>
          (await queue.all()).single.status == QueuedAttendanceStatus.sent,
    );
  });
}
