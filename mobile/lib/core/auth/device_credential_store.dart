import 'dart:convert';

import 'package:crypto/crypto.dart';

import 'authenticator.dart';
import 'secure_session_store.dart';

// Private fields via named parameters (private named params are illegal).
// ignore_for_file: prefer_initializing_formals

/// HMAC-SHA256 biometric proof the client sends with `POST /auth/device-refresh`.
/// Key = the per-credential `biometricKey` (stored behind the biometric gate);
/// message = the bound device tuple. The BE verifies with the same inputs
/// (see `backend/src/lib/device-credential.ts`).
String deviceBiometricProof({
  required String biometricKey,
  required String deviceId,
  required String deviceInstallId,
}) {
  final hmac = Hmac(sha256, utf8.encode(biometricKey));
  return hmac.convert(utf8.encode('$deviceId:$deviceInstallId')).toString();
}

/// A stored device credential: the long-lived `device_refresh_token` plus the
/// per-credential biometric key (HMAC proof material) and the binding tuple.
class DeviceCredential {
  const DeviceCredential({
    required this.deviceRefreshToken,
    required this.biometricKey,
    required this.deviceInstallId,
    required this.issuedAt,
    required this.expiresAt,
  });

  final String deviceRefreshToken;
  final String biometricKey;
  final String deviceInstallId;
  final DateTime issuedAt;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

/// Stores the BE-minted device credential behind the platform keystore. The
/// raw `device_refresh_token` only ever lives here (and in the BE response) —
/// never in logs or the DB, which keeps only its hash.
///
/// Biometric-gated storage tier: the credential is written via
/// `flutter_secure_storage` (iOS Keychain / Android EncryptedSharedPreferences)
/// and every `read(enforceBiometric: true)` additionally demands an OS
/// biometric prompt. Platform-level `biometryCurrentSet`/`RequireBiometric`
/// invalidation (the credential auto-invalidates when a new fingerprint is
/// added) needs a native plugin tier that flutter_secure_storage does not
/// expose — until then the app closes that gap with
/// `BiometricService.isEnrolledChanged` on the biometric snapshot plus the
/// BE-side binding/expiry checks (see mobile/README.md, ticket #72).
class DeviceCredentialStore {
  DeviceCredentialStore({SecureStorageBackend? backend, Authenticator? authenticator})
      : _backend = backend ?? const FlutterSecureStorageBackend(),
        _authenticator = authenticator;

  static const credentialKey = 'kk_device_credential';
  static const markerKey = 'kk_biometric_credential_marker';

  final SecureStorageBackend _backend;
  final Authenticator? _authenticator;

  Future<void> save(
    String deviceRefreshToken, {
    required String biometricKey,
    required String deviceInstallId,
    required DateTime issuedAt,
    required DateTime expiresAt,
  }) async {
    final payload = jsonEncode({
      'token': deviceRefreshToken,
      'biometric_key': biometricKey,
      'install_id': deviceInstallId,
      'issued_at': issuedAt.toIso8601String(),
      'expires_at': expiresAt.toIso8601String(),
    });
    await _backend.write(credentialKey, payload);
  }

  /// Returns `null` when: (a) nothing stored, (b) the biometric prompt fails
  /// (only when [enforceBiometric] is true), or (c) the credential expired.
  Future<DeviceCredential?> read({required bool enforceBiometric}) async {
    try {
      if (enforceBiometric) {
        final authenticator = _authenticator;
        if (authenticator == null) return null;
        final ok = await authenticator.authenticate(
          reason: 'Buka KaryawanKu dengan sidik jari.',
        );
        if (!ok) return null;
      }
      final raw = await _backend.read(credentialKey);
      if (raw == null) return null;
      final credential = DeviceCredential(
        deviceRefreshToken: jsonDecode(raw)['token'] as String,
        biometricKey: jsonDecode(raw)['biometric_key'] as String,
        deviceInstallId: jsonDecode(raw)['install_id'] as String,
        issuedAt: DateTime.parse(jsonDecode(raw)['issued_at'] as String),
        expiresAt: DateTime.parse(jsonDecode(raw)['expires_at'] as String),
      );
      if (credential.isExpired) return null;
      return credential;
    } catch (_) {
      return null;
    }
  }

  /// Whether the biometric enrolment marker exists (user accepted enrolment).
  Future<bool> hasBiometricMarker() async {
    try {
      return await _backend.read(markerKey) != null;
    } catch (_) {
      return false;
    }
  }

  /// Clears the credential and the enrolment marker.
  Future<void> clear() async {
    try {
      await _backend.delete(credentialKey);
      await _backend.delete(markerKey);
    } catch (_) {
      // Best-effort on sign-out; local state is cleared regardless.
    }
  }
}