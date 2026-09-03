import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:karyawanku_mobile/data/local/offline_queue.dart';

void main() {
  setUpAll(sqfliteFfiInit);

  // `:memory:` is cached per isolate in sqflite_common_ffi, so two `open`
  // calls share one database. A unique in-memory URI per queue isolates tests.
  var memCounter = 0;
  String memDb() => 'file:kk-queue-${memCounter++}?mode=memory&cache=shared';

  group('OfflineQueue (ticket #70)', () {
    test('enqueue persists a pending entry, oldest first', () async {
      final queue = await OfflineQueue.open(
        factory: databaseFactoryFfi,
        path: memDb(),
      );

      final first = await queue.enqueue(
        idempotencyKey: 'k-1',
        actionAt: DateTime(2026, 9, 3, 7, 45),
        kind: QueuedAttendanceKind.clockIn,
        lat: -6.2088,
        lng: 106.8456,
        accuracyM: 5,
      );
      await queue.enqueue(
        idempotencyKey: 'k-2',
        actionAt: DateTime(2026, 9, 3, 17, 0),
        kind: QueuedAttendanceKind.clockOut,
      );

      expect(first.id, 'k-1');
      expect(first.status, QueuedAttendanceStatus.pending);
      expect(first.endpoint, 'clock_in');

      final pending = await queue.pending();
      expect(pending.map((e) => e.id), ['k-1', 'k-2']);
      expect(pending.first.actionAt, DateTime(2026, 9, 3, 7, 45));
      expect(pending.first.lat, -6.2088);
      expect(pending.first.accuracyM, 5);
    });

    test('markInFlight / markSent moves an entry out of pending', () async {
      final queue = await OfflineQueue.open(
        factory: databaseFactoryFfi,
        path: memDb(),
      );
      await queue.enqueue(
        idempotencyKey: 'k-1',
        actionAt: DateTime(2026, 9, 3, 7, 45),
        kind: QueuedAttendanceKind.clockIn,
      );

      await queue.markInFlight('k-1');
      expect(await queue.pending(), hasLength(1));
      expect(
        (await queue.pending()).first.status,
        QueuedAttendanceStatus.inFlight,
      );

      await queue.markSent('k-1');
      expect(await queue.pending(), isEmpty);
      final all = await queue.all();
      expect(all.single.status, QueuedAttendanceStatus.sent);
    });

    test(
      'markFailed permanent stops retries; transient keeps pending',
      () async {
        final queue = await OfflineQueue.open(
          factory: databaseFactoryFfi,
          path: memDb(),
        );
        await queue.enqueue(
          idempotencyKey: 'k-1',
          actionAt: DateTime(2026, 9, 3, 7, 45),
          kind: QueuedAttendanceKind.clockIn,
        );
        await queue.enqueue(
          idempotencyKey: 'k-2',
          actionAt: DateTime(2026, 9, 3, 17, 0),
          kind: QueuedAttendanceKind.clockOut,
        );

        await queue.markFailed('k-1', 'Sudah clock-in', permanent: true);
        await queue.markFailed('k-2', 'server 500', permanent: false);

        final all = await queue.all();
        final byId = {for (final e in all) e.id: e};
        expect(byId['k-1']!.status, QueuedAttendanceStatus.permanentlyFailed);
        expect(byId['k-1']!.error, 'Sudah clock-in');
        expect(byId['k-2']!.status, QueuedAttendanceStatus.pending);
        expect(byId['k-2']!.error, 'server 500');
        // Only the transient entry is still pending → retried.
        expect((await queue.pending()).single.id, 'k-2');
      },
    );

    test(
      'markPending requeues a permanently failed entry for manual retry',
      () async {
        final queue = await OfflineQueue.open(
          factory: databaseFactoryFfi,
          path: memDb(),
        );
        await queue.enqueue(
          idempotencyKey: 'k-1',
          actionAt: DateTime(2026, 9, 3, 7, 45),
          kind: QueuedAttendanceKind.clockIn,
        );
        await queue.markFailed('k-1', 'Sudah clock-in', permanent: true);

        await queue.markPending('k-1');

        final pending = await queue.pending();
        expect(pending.single.status, QueuedAttendanceStatus.pending);
        expect(pending.single.error, isNull);
      },
    );

    test(
      'survives a restart: reopening the same DB file keeps entries',
      () async {
        final dir = await Directory.systemTemp.createTemp('kk_queue_');
        addTearDown(() => dir.delete(recursive: true));
        final path = '${dir.path}/offline.db';

        final first = await OfflineQueue.open(
          factory: databaseFactoryFfi,
          path: path,
        );
        await first.enqueue(
          idempotencyKey: 'k-persist',
          actionAt: DateTime(2026, 9, 3, 7, 45),
          kind: QueuedAttendanceKind.clockIn,
        );
        await first.close();

        // "App restart": a brand-new queue instance over the same file.
        final reopened = await OfflineQueue.open(
          factory: databaseFactoryFfi,
          path: path,
        );
        final pending = await reopened.pending();
        expect(pending, hasLength(1));
        expect(pending.single.id, 'k-persist');
        expect(pending.single.kind, QueuedAttendanceKind.clockIn);
        await reopened.close();
      },
    );
  });
}
