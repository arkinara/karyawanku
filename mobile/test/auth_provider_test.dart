import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/api/api_exception.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';

import 'helpers.dart';

ProviderContainer makeContainer(SecureSessionStore store, ApiClient client) {
  final container = ProviderContainer(
    overrides: [
      secureSessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
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

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  group('signIn', () {
    test('stores the session and flips to signed in', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/auth/sign-in') return jsonResponse(signInBody());
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.signIn('siti@usaha.com', 'rahasia123');

      final state = container.read(authProvider);
      expect(state.isSignedIn, isTrue);
      expect(state.user?.nama, 'Siti Nurhaliza');
      expect(state.user?.roleLabel, 'Employee');
      expect(await store.getAccessToken(), 'access-token-1');
      expect(await store.getRefreshToken(), 'refresh-token-1');
    });

    test('wrong credentials surface the BE message and stay signed out', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('Email atau kata sandi salah', status: 401);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await expectLater(
        notifier.signIn('siti@usaha.com', 'salah'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.message, 'message', 'Email atau kata sandi salah'),
        ),
      );

      final state = container.read(authProvider);
      expect(state.isSignedIn, isFalse);
      expect(state.loading, isFalse);
      expect(await store.getSession(), isNull);
    });

    test('offline sign-in throws NetworkException', () async {
      final client = buildTestClient(store, (o) async {
        throw const SocketException('Connection refused');
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await expectLater(
        notifier.signIn('siti@usaha.com', 'rahasia123'),
        throwsA(isA<NetworkException>()),
      );
      expect(container.read(authProvider).isSignedIn, isFalse);
    });
  });

  group('signOut', () {
    test('clears local state even when the revoke call fails', () async {
      await store.saveSession(testSession);
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('server exploded', status: 500);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.signOut();

      expect(container.read(authProvider).isSignedIn, isFalse);
      expect(await store.getSession(), isNull);
      expect(await store.getAccessToken(), isNull);
    });

    test('successful sign-out clears state too', () async {
      await store.saveSession(testSession);
      final client = buildTestClient(store, (o) async {
        return jsonResponse({'ok': true});
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.signOut();

      expect(container.read(authProvider).isSignedIn, isFalse);
      expect(await store.getSession(), isNull);
    });
  });

  test('signOutAll clears local state even when the call fails', () async {
    await store.saveSession(testSession);
    final client = buildTestClient(store, (o) async {
      return jsonErrorResponse('server exploded', status: 500);
    });
    final container = makeContainer(store, client);
    final notifier = container.read(authProvider.notifier);

    await notifier.signOutAll();

    expect(container.read(authProvider).isSignedIn, isFalse);
    expect(await store.getSession(), isNull);
  });

  group('restoreSession', () {
    test('valid /auth/me keeps the stored session signed in', () async {
      await store.saveSession(testSession);
      final client = buildTestClient(store, (o) async {
        return jsonResponse({'user': testUser.toJson()});
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.restoreSession();

      final state = container.read(authProvider);
      expect(state.isSignedIn, isTrue);
      expect(state.user?.nama, 'Siti Nurhaliza');
    });

    test('restore refreshes an expired token and persists the new pair', () async {
      await store.saveSession(testSession);
      var meCalls = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/auth/refresh') {
          return jsonResponse({
            'access_token': 'access-token-2',
            'refresh_token': 'refresh-token-2',
          });
        }
        meCalls++;
        if (meCalls == 1) return jsonErrorResponse('token expired', status: 401);
        return jsonResponse({'user': testUser.toJson()});
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.restoreSession();

      final state = container.read(authProvider);
      expect(state.isSignedIn, isTrue);
      // The live (refreshed) pair is what survives, not the stale one.
      expect(state.session?.accessToken, 'access-token-2');
      expect(await store.getAccessToken(), 'access-token-2');
      expect(await store.getRefreshToken(), 'refresh-token-2');
    });

    test('revoked session (refresh fails) signs out with a notice', () async {
      await store.saveSession(testSession);
      final client = buildTestClient(store, (o) async {
        if (o.path == '/auth/refresh') {
          return jsonErrorResponse('refresh invalid', status: 401);
        }
        return jsonErrorResponse('token expired', status: 401);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.restoreSession();

      final state = container.read(authProvider);
      expect(state.isSignedIn, isFalse);
      expect(state.notice, 'Sesi telah berakhir. Silakan masuk kembali.');
      expect(await store.getSession(), isNull);

      notifier.acknowledgeNotice();
      expect(container.read(authProvider).notice, isNull);
    });

    test('no stored session lands signed out', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.restoreSession();

      expect(container.read(authProvider).isSignedIn, isFalse);
    });

    test('offline device keeps the stored session', () async {
      await store.saveSession(testSession);
      final client = buildTestClient(store, (o) async {
        throw const SocketException('Connection refused');
      });
      final container = makeContainer(store, client);
      final notifier = container.read(authProvider.notifier);

      await notifier.restoreSession();

      final state = container.read(authProvider);
      expect(state.isSignedIn, isTrue);
      expect(state.user?.nama, 'Siti Nurhaliza');
    });
  });
}