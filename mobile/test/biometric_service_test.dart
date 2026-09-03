import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/authenticator.dart';
import 'package:karyawanku_mobile/core/auth/biometric_service.dart';
import 'package:karyawanku_mobile/core/auth/device_credential_store.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;

  setUp(() {
    backend = InMemoryBackend();
  });

  test('availableKind returns none when no biometric is enrolled', () async {
    final service = BiometricService(
      authenticator: FakeAuthenticator(),
      backend: backend,
    );
    expect(await service.availableKind(), BiometricKind.none);
  });

  test(
    'availableKind returns fingerprint when a fingerprint is enrolled',
    () async {
      final service = BiometricService(
        authenticator: FakeAuthenticator(kinds: [BiometricKind.fingerprint]),
        backend: backend,
      );
      expect(await service.availableKind(), BiometricKind.fingerprint);
    },
  );

  test(
    'isEnrolledChanged records the snapshot on the first call and is false',
    () async {
      final service = BiometricService(
        authenticator: FakeAuthenticator(kinds: [BiometricKind.fingerprint]),
        backend: backend,
      );
      expect(await service.isEnrolledChanged(), isFalse);
      expect(await backend.read(BiometricService.snapshotKey), 'fingerprint');
    },
  );

  test(
    'isEnrolledChanged is true when the stored snapshot differs from the current one',
    () async {
      await backend.write(BiometricService.snapshotKey, 'fingerprint');
      final service = BiometricService(
        // Nothing enrolled now — a fingerprint was removed (or the set changed).
        authenticator: FakeAuthenticator(),
        backend: backend,
      );
      expect(await service.isEnrolledChanged(), isTrue);
    },
  );

  test(
    'promptUnlock delegates to the authenticator and returns its verdict',
    () async {
      final auth = FakeAuthenticator(willSucceed: true);
      final service = BiometricService(authenticator: auth, backend: backend);

      expect(await service.promptUnlock(reasonId: 'unlock'), isTrue);
      expect(await service.promptUnlock(reasonId: 'refresh'), isTrue);
      expect(auth.authenticateCalls, 2);
    },
  );

  test(
    'promptEnrolDecision is exactly-once even when dismissed (headless → false)',
    () async {
      final service = BiometricService(
        authenticator: FakeAuthenticator(kinds: [BiometricKind.fingerprint]),
        backend: backend,
      );
      // No navigator context (plain test) → returns false but marks "asked".
      expect(await service.promptEnrolDecision(), isFalse);
      expect(await service.promptEnrolDecision(), isFalse);
      expect(await backend.read(BiometricService.enrolAskedKey), isNotNull);
    },
  );

  test(
    'promptEnrolDecision never asks when no biometric is enrolled',
    () async {
      final service = BiometricService(
        authenticator: FakeAuthenticator(),
        backend: backend,
      );
      expect(await service.promptEnrolDecision(), isFalse);
      expect(await backend.read(BiometricService.enrolAskedKey), isNull);
    },
  );

  test('markBiometricEnrolled writes the binding marker + snapshot', () async {
    final service = BiometricService(
      authenticator: FakeAuthenticator(kinds: [BiometricKind.fingerprint]),
      backend: backend,
    );
    await service.markBiometricEnrolled();
    expect(await backend.read(BiometricService.enrolAskedKey), isNull);
    expect(await backend.read(DeviceCredentialStore.markerKey), 'fingerprint');
    expect(await backend.read(BiometricService.snapshotKey), 'fingerprint');
  });
}
