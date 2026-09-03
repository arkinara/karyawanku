import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../device/device_identity.dart';
import 'authenticator.dart';
import 'biometric_service.dart';
import 'device_credential_store.dart';
import 'secure_session_store.dart';

/// The single secure-storage backend everything (session store, device
/// identity, credential store, biometric service) shares. Tests override this
/// with an [InMemoryBackend] so no platform channel is touched.
final secureStorageBackendProvider = Provider<SecureStorageBackend>(
  (ref) => const FlutterSecureStorageBackend(),
);

final authenticatorProvider = Provider<Authenticator>(
  (ref) => LocalAuthenticator(),
);

final deviceCredentialStoreProvider = Provider<DeviceCredentialStore>(
  (ref) => DeviceCredentialStore(
    backend: ref.watch(secureStorageBackendProvider),
    authenticator: ref.watch(authenticatorProvider),
  ),
);

final biometricServiceProvider = Provider<BiometricService>(
  (ref) => BiometricService(
    authenticator: ref.watch(authenticatorProvider),
    backend: ref.watch(secureStorageBackendProvider),
  ),
);

final deviceIdentityProvider = FutureProvider<DeviceIdentity>(
  (ref) async => DeviceIdentity.ensureInitialized(
    backend: ref.watch(secureStorageBackendProvider),
  ),
);

/// True when the "Masuk dengan sidik jari" button may be shown: a stored
/// (non-expired) credential exists, biometrics are enrolled + unchanged, and
/// the enrolment marker was accepted. Any failure → false (button hidden).
final biometricUnlockProvider = FutureProvider<bool>((ref) async {
  try {
    final store = ref.watch(deviceCredentialStoreProvider);
    final biometric = ref.watch(biometricServiceProvider);
    if (await store.read(enforceBiometric: false) == null) return false;
    if (await biometric.availableKind() == BiometricKind.none) return false;
    if (await biometric.isEnrolledChanged()) return false;
    return await store.hasBiometricMarker();
  } catch (_) {
    return false;
  }
});
