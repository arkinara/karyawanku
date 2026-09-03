import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/biometric_providers.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/connectivity/connectivity_provider.dart';
import 'package:karyawanku_mobile/core/widget/widget_bridge.dart';
import 'package:karyawanku_mobile/core/widget/widget_entry.dart';
import 'package:karyawanku_mobile/core/widget/widget_state.dart';
import 'package:karyawanku_mobile/data/local/offline_queue.dart';
import 'package:karyawanku_mobile/features/absensi/offline_queue_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class _FlippableOnline extends OnlineNotifier {
  _FlippableOnline(this.initial);
  final bool initial;

  @override
  bool build() => initial;

  void setOnline(bool value) => state = value;
}

/// Fixed signed-out auth so the dispatcher's deferral path is deterministic.
class _SignedOutAuth extends AuthNotifier {
  @override
  AuthState build() => const AuthState.signedOut();
}

Map<String, dynamic> recordJson({String? clockIn, String? clockOut}) => {
  'id': 'att-1',
  'employee_id': 'emp-1',
  'tanggal': '2026-09-03',
  'clock_in': clockIn,
  'clock_out': clockOut,
  'catatan': null,
  'status': 'hadir',
  'late_minutes': 0,
  'overtime_minutes': 0,
  'overtime_override_minutes': null,
  'submission_method': 'live',
  'time_drift_detected': false,
};

void main() {
  setUpAll(sqfliteFfiInit);

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  late InMemoryBackend backend;
  late SecureSessionStore store;
  late FakeWidgetBridge bridge;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
    bridge = FakeWidgetBridge();
  });

  Future<OfflineQueue> freshQueue() {
    final memDb =
        'file:kk-widget-${DateTime.now().microsecondsSinceEpoch}'
        '?mode=memory&cache=shared';
    return OfflineQueue.open(factory: databaseFactoryFfi, path: memDb);
  }

  ProviderContainer makeSignedInContainer(
    ApiClient client, {
    _FlippableOnline? online,
    OfflineQueue? queue,
  }) {
    final flippable = online ?? _FlippableOnline(true);
    return ProviderContainer(
      overrides: [
        secureSessionStoreProvider.overrideWithValue(store),
        secureStorageBackendProvider.overrideWithValue(backend),
        apiClientProvider.overrideWithValue(client),
        signedInEmployeeOverride,
        isOnlineProvider.overrideWith(() => flippable),
        if (queue != null)
          offlineQueueStoreProvider.overrideWith((ref) async => queue),
        if (queue != null)
          offlineQueueManagerProvider.overrideWith(
            () => OfflineQueueManager(delay: (s) async {}),
          ),
        widgetBridgeProvider.overrideWithValue(bridge),
      ],
    );
  }

  ProviderContainer makeSignedOutContainer(ApiClient client) {
    return ProviderContainer(
      overrides: [
        secureSessionStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(client),
        authProvider.overrideWith(() => _SignedOutAuth()),
        widgetBridgeProvider.overrideWithValue(bridge),
      ],
    );
  }

  group('action=clock_in', () {
    test('online + signed in → clockInWithQueue posts exactly once', () async {
      var clockInPosts = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          clockInPosts++;
          return jsonResponse({'record': recordJson()});
        }
        if (o.path == '/attendance/today') {
          return jsonResponse({
            'record': recordJson(clockIn: '2026-09-03T00:58:00.000Z'),
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeSignedInContainer(client);

      await onWidgetClicked(
        WidgetUris.clockIn(),
        container: container,
        bridge: bridge,
      );

      expect(clockInPosts, 1);
      final snapshot = await WidgetStore.readSnapshot();
      expect(snapshot.hasClockIn, isTrue);
      expect(bridge.updateCount, greaterThanOrEqualTo(1));
    });

    test(
      'offline + signed in → enqueues a row, marks pending, updates',
      () async {
        final queue = await freshQueue();
        final online = _FlippableOnline(false);
        final client = buildTestClient(store, (o) async {
          // Never reached — the action must be queued, not posted.
          return jsonErrorResponse('offline test', status: 503);
        });
        final container = makeSignedInContainer(
          client,
          online: online,
          queue: queue,
        );

        await onWidgetClicked(
          WidgetUris.clockIn(),
          container: container,
          bridge: bridge,
        );

        final pending = await queue.pending();
        expect(pending, hasLength(1));
        expect(pending.single.kind, QueuedAttendanceKind.clockIn);

        final snapshot = await WidgetStore.readSnapshot();
        expect(snapshot.pendingSync, isTrue);
        expect(snapshot.hasClockIn, isTrue);
        expect(bridge.updateCount, greaterThanOrEqualTo(1));
      },
    );

    test(
      'signed out → deep-links to sign-in, no API call, defers action',
      () async {
        var apiCalls = 0;
        final client = buildTestClient(store, (o) async {
          apiCalls++;
          return jsonErrorResponse('nope', status: 404);
        });
        final container = makeSignedOutContainer(client);

        await onWidgetClicked(
          WidgetUris.clockIn(),
          container: container,
          bridge: bridge,
        );

        expect(apiCalls, 0);
        expect(bridge.launches, hasLength(1));
        expect(bridge.launches.single.queryParameters['action'], 'sign_in');
        expect(container.read(pendingWidgetActionProvider), isNotNull);
      },
    );

    test(
      'geofence rejection (422) → failureMessage surfaced, re-rendered',
      () async {
        final client = buildTestClient(store, (o) async {
          if (o.path == '/attendance/clock-in') {
            return jsonErrorResponse(
              'Lokasi di luar area kerja. Clock-in hanya di kantor.',
              status: 422,
            );
          }
          return jsonErrorResponse('nope', status: 404);
        });
        final container = makeSignedInContainer(client);

        await onWidgetClicked(
          WidgetUris.clockIn(),
          container: container,
          bridge: bridge,
        );

        final snapshot = await WidgetStore.readSnapshot();
        expect(
          snapshot.failureMessage,
          'Lokasi di luar area kerja. Clock-in hanya di kantor.',
        );
        expect(bridge.updateCount, greaterThanOrEqualTo(1));
      },
    );

    test('repeat tap within 200ms → still exactly one record', () async {
      final gate = Completer<void>();
      var posts = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          posts++;
          await gate.future;
          return jsonResponse({'record': recordJson()});
        }
        if (o.path == '/attendance/today') {
          return jsonResponse({
            'record': recordJson(clockIn: '2026-09-03T00:58:00.000Z'),
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeSignedInContainer(client);

      final first = onWidgetClicked(
        WidgetUris.clockIn(),
        container: container,
        bridge: bridge,
      );
      // A second tap lands while the first write is still in flight — the
      // attendance provider's in-flight guard debounces it.
      await onWidgetClicked(
        WidgetUris.clockIn(),
        container: container,
        bridge: bridge,
      );
      gate.complete();
      await first;

      expect(posts, 1);
    });
  });

  group('action=sign_in', () {
    test('deep-links to sign-in and records the intent', () async {
      var apiCalls = 0;
      final client = buildTestClient(store, (o) async {
        apiCalls++;
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeSignedOutContainer(client);

      await onWidgetClicked(
        WidgetUris.signIn(),
        container: container,
        bridge: bridge,
      );

      expect(apiCalls, 0);
      expect(bridge.launches, hasLength(1));
      expect(bridge.launches.single.queryParameters['action'], 'sign_in');
      // No clock action to defer — just the telemetry deep link.
      expect(container.read(pendingWidgetActionProvider), isNull);
    });
  });

  test(
    'handlePendingWidgetAction runs a deferred action exactly once',
    () async {
      var clockInPosts = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          clockInPosts++;
          return jsonResponse({'record': recordJson()});
        }
        if (o.path == '/attendance/today') {
          return jsonResponse({
            'record': recordJson(clockIn: '2026-09-03T00:58:00.000Z'),
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeSignedInContainer(client);
      container
          .read(pendingWidgetActionProvider.notifier)
          .set(WidgetUris.clockIn());

      await handlePendingWidgetAction(container, bridge: bridge);
      await handlePendingWidgetAction(container, bridge: bridge);

      expect(clockInPosts, 1);
      expect(container.read(pendingWidgetActionProvider), isNull);
    },
  );
}
