import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/device_credential_store.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;

  setUp(() {
    backend = InMemoryBackend();
  });

  test('saves a credential and reads it back intact', () async {
    final store = DeviceCredentialStore(backend: backend);
    await store.save(
      'token-1',
      biometricKey: 'key-1',
      deviceInstallId: 'install-1',
      issuedAt: DateTime.utc(2026, 8, 1),
      expiresAt: DateTime.utc(2026, 9, 30),
    );

    final read = await store.read(enforceBiometric: false);
    expect(read, isNotNull);
    expect(read!.deviceRefreshToken, 'token-1');
    expect(read.biometricKey, 'key-1');
    expect(read.deviceInstallId, 'install-1');
    expect(read.isExpired, isFalse);
  });

  test('read returns null when nothing is stored', () async {
    final store = DeviceCredentialStore(backend: backend);
    expect(await store.read(enforceBiometric: false), isNull);
  });

  test('read returns null after expiry', () async {
    await seedExpiredDeviceCredential(backend);
    final store = DeviceCredentialStore(backend: backend);
    expect(await store.read(enforceBiometric: false), isNull);
  });

  test(
    'read(enforceBiometric: true) prompts first; a failed prompt returns null',
    () async {
      final auth = FakeAuthenticator(willSucceed: false);
      final store = DeviceCredentialStore(
        backend: backend,
        authenticator: auth,
      );
      await seedDeviceCredential(backend);

      expect(await store.read(enforceBiometric: true), isNull);
      expect(auth.authenticateCalls, 1);
    },
  );

  test('read(enforceBiometric: true) succeeds after a good prompt', () async {
    final auth = FakeAuthenticator(willSucceed: true);
    final store = DeviceCredentialStore(backend: backend, authenticator: auth);
    await seedDeviceCredential(backend);

    final read = await store.read(enforceBiometric: true);
    expect(read, isNotNull);
    expect(read!.deviceRefreshToken, testDeviceCredential.deviceRefreshToken);
    expect(auth.authenticateCalls, 1);
  });

  test('clear removes the credential and the enrolment marker', () async {
    await seedDeviceCredential(backend);
    final store = DeviceCredentialStore(backend: backend);
    expect(await store.hasBiometricMarker(), isTrue);

    await store.clear();

    expect(await store.read(enforceBiometric: false), isNull);
    expect(await store.hasBiometricMarker(), isFalse);
  });

  test(
    'deviceBiometricProof is deterministic and bound to the device tuple',
    () {
      final a = deviceBiometricProof(
        biometricKey: 'key',
        deviceId: 'dev-1',
        deviceInstallId: 'install-1',
      );
      final b = deviceBiometricProof(
        biometricKey: 'key',
        deviceId: 'dev-1',
        deviceInstallId: 'install-1',
      );
      final wrongDevice = deviceBiometricProof(
        biometricKey: 'key',
        deviceId: 'dev-2',
        deviceInstallId: 'install-1',
      );
      final wrongKey = deviceBiometricProof(
        biometricKey: 'other',
        deviceId: 'dev-1',
        deviceInstallId: 'install-1',
      );
      expect(a, b);
      expect(a, isNot(wrongDevice));
      expect(a, isNot(wrongKey));
    },
  );
}
