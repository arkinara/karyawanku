import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/device_credential_store.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/device/device_identity.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  Future<void> seedSignedInState() async {
    await store.saveSession(testSession);
    await seedDeviceCredential(backend);
    await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
  }

  ProviderContainer makeContainer(
    Future<ResponseBody> Function(RequestOptions options) handler,
  ) {
    final client = buildTestClientWithDeviceId(backend, store, handler);
    final container = ProviderContainer(
      overrides: biometricOverrides(
        backend: backend,
        store: store,
        client: client,
        authenticator: FakeAuthenticator(),
      ),
    );
    addTearDown(container.dispose);
    return container;
  }

  test(
    'signOut revokes the device credential server-side and clears it locally',
    () async {
      await seedSignedInState();
      String? sentDeviceToken;
      final container = makeContainer((o) async {
        final body = o.data as Map<String, dynamic>?;
        sentDeviceToken = body?['device_refresh_token'] as String?;
        return jsonResponse({'ok': true});
      });

      await container.read(authProvider.notifier).signOut();

      expect(sentDeviceToken, testDeviceCredential.deviceRefreshToken);
      expect(await backend.read(DeviceCredentialStore.credentialKey), isNull);
      expect(await backend.read(DeviceCredentialStore.markerKey), isNull);
      expect(await store.getSession(), isNull);
      expect(container.read(authProvider).isSignedIn, isFalse);
    },
  );

  test('signOutAll clears the credential and the marker too', () async {
    await seedSignedInState();
    final container = makeContainer((o) async {
      if (o.path == '/auth/sign-out-all') return jsonResponse({'ok': true});
      return jsonErrorResponse('nope', status: 404);
    });

    await container.read(authProvider.notifier).signOutAll();

    expect(await backend.read(DeviceCredentialStore.credentialKey), isNull);
    expect(await backend.read(DeviceCredentialStore.markerKey), isNull);
    expect(await store.getSession(), isNull);
    expect(container.read(authProvider).isSignedIn, isFalse);
  });

  test(
    'signOut clears local credential + marker even when the revoke call fails',
    () async {
      await seedSignedInState();
      final container = makeContainer((o) async {
        return jsonErrorResponse('server exploded', status: 500);
      });

      await container.read(authProvider.notifier).signOut();

      expect(await backend.read(DeviceCredentialStore.credentialKey), isNull);
      expect(await backend.read(DeviceCredentialStore.markerKey), isNull);
      expect(await store.getSession(), isNull);
      expect(container.read(authProvider).isSignedIn, isFalse);
    },
  );
}
