import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/push/push_registration.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;
  late FakeMessaging fake;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
    fake = FakeMessaging()..token = 'fcm-device-token';
  });

  ProviderContainer makeContainer(
    ApiClient client, {
    List<Override> extra = const [],
  }) {
    final container = ProviderContainer(
      overrides: [
        secureSessionStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(client),
        fcmServiceProvider.overrideWithValue(testFCMService(fake)),
        ...extra,
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  Map<String, dynamic> signInBody() => {
    'user': testUser.toJson(),
    'token': 'access-token-1',
    'refresh_token': 'refresh-token-1',
  };

  group('push × auth integration', () {
    test('sign-in registers the device via POST /devices', () async {
      final calls = <String>[];
      final client = buildTestClient(store, (o) async {
        calls.add('${o.method} ${o.path}');
        if (o.path == '/auth/sign-in') return jsonResponse(signInBody());
        if (o.path == '/devices') {
          return jsonResponse({
            'device': {'id': 'dev-1', 'token': 'fcm-device-token', 'platform': 'android'},
          }, 201);
        }
        return jsonResponse({'ok': true});
      });
      final container = makeContainer(client);
      final notifier = container.read(authProvider.notifier);

      await notifier.signIn('siti@usaha.com', 'rahasia123');
      await pumpEventQueue();

      expect(container.read(authProvider).isSignedIn, isTrue);
      expect(calls, contains('POST /devices'));
    });

    test('denied notification permission → no device register, sign-in intact', () async {
      fake.permissionGranted = false;
      final calls = <String>[];
      final client = buildTestClient(store, (o) async {
        calls.add(o.path);
        if (o.path == '/auth/sign-in') return jsonResponse(signInBody());
        return jsonResponse({'ok': true});
      });
      final container = makeContainer(client);

      await container.read(authProvider.notifier).signIn('a@b.c', 'x');
      await pumpEventQueue();

      expect(container.read(authProvider).isSignedIn, isTrue);
      expect(calls.where((c) => c == '/devices'), isEmpty);
    });

    test('sign-out deletes the registered device before clearing the session', () async {
      final deletes = <String>[];
      final client = buildTestClient(store, (o) async {
        if (o.path == '/auth/sign-in') return jsonResponse(signInBody());
        if (o.path == '/devices') {
          return jsonResponse({
            'device': {'id': 'dev-1', 'token': 'fcm-device-token', 'platform': 'android'},
          }, 201);
        }
        if (o.path.startsWith('/devices/')) {
          deletes.add(o.path);
          return jsonResponse({'ok': true});
        }
        return jsonResponse({'ok': true});
      });
      final container = makeContainer(client);
      final notifier = container.read(authProvider.notifier);

      await notifier.signIn('siti@usaha.com', 'rahasia123');
      await pumpEventQueue();
      await notifier.signOut();

      expect(deletes, ['/devices/dev-1']);
      expect(container.read(authProvider).isSignedIn, isFalse);
    });

    test('FCM token refresh re-registers the new token', () async {
      final registrations = <Map<String, dynamic>>[];
      final client = buildTestClient(store, (o) async {
        if (o.path == '/auth/sign-in') return jsonResponse(signInBody());
        if (o.path == '/devices' && o.method == 'POST') {
          final body = o.data as Map<String, dynamic>;
          registrations.add(body);
          return jsonResponse({
            'device': {
              'id': 'dev-${body['token']}',
              'token': body['token'],
              'platform': 'android',
            },
          }, 201);
        }
        return jsonResponse({'ok': true});
      });
      final container = makeContainer(client);
      final registration = container.read(pushRegistrationProvider);

      // First registration sets up the token-refresh listener.
      await registration.register();
      registrations.clear();

      fake.rotateToken('fcm-rotated-token');
      await pumpEventQueue();

      expect(registrations, hasLength(1));
      expect(registrations.single['token'], 'fcm-rotated-token');
    });
  });
}