import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/authenticator.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/biometric_service.dart';
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

  ProviderContainer makeContainer(
    FakeAuthenticator auth,
    Future<ResponseBody> Function(RequestOptions) handler,
  ) {
    final client = buildTestClientWithDeviceId(backend, store, handler);
    final container = ProviderContainer(
      overrides: biometricOverrides(
        backend: backend,
        store: store,
        client: client,
        authenticator: auth,
      ),
    );
    addTearDown(container.dispose);
    return container;
  }

  test('password sign-in mints + saves the device credential (with X-Device-Id)', () async {
    String? sentDeviceHeader;
    final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint]);
    final container = makeContainer(auth, (o) async {
      if (o.path == '/auth/sign-in') {
        sentDeviceHeader = o.headers['X-Device-Id'] as String?;
        return jsonResponse(signInBodyWithDevice());
      }
      return jsonErrorResponse('nope', status: 404);
    });

    await container.read(authProvider.notifier).signIn('siti@usaha.com', 'rahasia123');

    expect(container.read(authProvider).isSignedIn, isTrue);
    expect(sentDeviceHeader, isNotNull);
    expect(sentDeviceHeader, isNotEmpty);

    final raw = await backend.read(DeviceCredentialStore.credentialKey);
    expect(raw, isNotNull);
    final stored = jsonDecode(raw!) as Map<String, dynamic>;
    expect(stored['token'], 'device-refresh-token-1');
    expect(stored['install_id'], 'install-1');
    expect(await store.getAccessToken(), 'access-token-1');

    // Headless (no navigator context): the exactly-once enrol ask ran its
    // "asked" marker but could not show a dialog, so no binding marker yet.
    expect(await backend.read(BiometricService.enrolAskedKey), isNotNull);
  });

  test('device-refresh with the right device_id + a fresh biometric_proof returns a new session', () async {
    await seedDeviceCredential(backend);
    await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
    final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint], willSucceed: true);
    final bodies = <Map<String, dynamic>>[];

    final container = makeContainer(auth, (o) async {
      if (o.path == '/auth/device-refresh') {
        expect(o.headers['X-Device-Id'], 'device-1');
        bodies.add(o.data as Map<String, dynamic>);
        return jsonResponse(deviceRefreshBody());
      }
      return jsonErrorResponse('nope', status: 404);
    });

    final ok = await container.read(authProvider.notifier).unlockWithBiometric();

    expect(ok, isTrue);
    final state = container.read(authProvider);
    expect(state.isSignedIn, isTrue);
    expect(state.session?.accessToken, 'access-token-2');
    expect(await store.getAccessToken(), 'access-token-2');
    expect(await store.getRefreshToken(), 'refresh-token-2');

    final body = bodies.single;
    expect(body['device_id'], 'device-1');
    expect(body['device_install_id'], testDeviceCredential.deviceInstallId);
    expect(body['device_refresh_token'], testDeviceCredential.deviceRefreshToken);
    expect(
      body['biometric_proof'],
      deviceBiometricProof(
        biometricKey: testDeviceCredential.biometricKey,
        deviceId: 'device-1',
        deviceInstallId: testDeviceCredential.deviceInstallId,
      ),
    );

    // The rotated credential replaces the old one locally.
    final raw = await backend.read(DeviceCredentialStore.credentialKey);
    expect(raw, contains('device-refresh-token-2'));
    expect(raw, isNot(contains('device-refresh-token-1')));
    expect(auth.authenticateCalls, 1);
  });

  test('wrong device_id → 401 clears the credential and falls back to password', () async {
    await seedDeviceCredential(backend);
    await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
    final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint], willSucceed: true);

    final container = makeContainer(auth, (o) async {
      if (o.path == '/auth/device-refresh') {
        return jsonErrorResponse('Kredensial perangkat tidak valid', status: 401);
      }
      return jsonErrorResponse('nope', status: 404);
    });

    final ok = await container.read(authProvider.notifier).unlockWithBiometric();

    expect(ok, isFalse);
    expect(container.read(authProvider).isSignedIn, isFalse);
    // A rejected credential can never unlock again — dropped locally.
    expect(await backend.read(DeviceCredentialStore.credentialKey), isNull);
  });

  test('cross-user credential → 401 (BE gate) stays signed out', () async {
    await seedDeviceCredential(backend);
    await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
    final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint], willSucceed: true);

    final container = makeContainer(auth, (o) async {
      if (o.path == '/auth/device-refresh') {
        return jsonErrorResponse('Kredensial perangkat tidak valid', status: 401);
      }
      return jsonErrorResponse('nope', status: 404);
    });

    final ok = await container.read(authProvider.notifier).unlockWithBiometric();
    expect(ok, isFalse);
    expect(container.read(authProvider).isSignedIn, isFalse);
    expect(await store.getSession(), isNull);
  });

  test('expired credential → prompt still runs but no network request happens', () async {
    await seedExpiredDeviceCredential(backend);
    await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
    var deviceCalls = 0;
    final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint], willSucceed: true);

    final container = makeContainer(auth, (o) async {
      deviceCalls++;
      return jsonErrorResponse('nope', status: 404);
    });

    final ok = await container.read(authProvider.notifier).unlockWithBiometric();

    expect(ok, isFalse);
    expect(deviceCalls, 0);
    expect(auth.authenticateCalls, 1);
    expect(container.read(authProvider).isSignedIn, isFalse);
  });

  test('cancelled biometric prompt → no network, stays signed out, credential kept', () async {
    await seedDeviceCredential(backend);
    await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
    var deviceCalls = 0;
    final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint], willSucceed: false);

    final container = makeContainer(auth, (o) async {
      deviceCalls++;
      return jsonErrorResponse('nope', status: 404);
    });

    final ok = await container.read(authProvider.notifier).unlockWithBiometric();

    expect(ok, isFalse);
    expect(deviceCalls, 0);
    expect(container.read(authProvider).isSignedIn, isFalse);
    // A cancelled prompt is not a rejection — the credential survives.
    expect(await backend.read(DeviceCredentialStore.credentialKey), isNotNull);
  });

  test('offline device-refresh → NetworkException keeps the credential', () async {
    await seedDeviceCredential(backend);
    await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
    final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint], willSucceed: true);

    final container = makeContainer(auth, (o) async {
      throw Exception('connection refused');
    });

    final ok = await container.read(authProvider.notifier).unlockWithBiometric();

    expect(ok, isFalse);
    expect(await backend.read(DeviceCredentialStore.credentialKey), isNotNull);
  });
}