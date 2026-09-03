import 'package:flutter/material.dart';

import '../navigation.dart';
import 'authenticator.dart';
import 'device_credential_store.dart';
import 'secure_session_store.dart';

/// Biometric orchestration on top of [Authenticator]:
/// - [availableKind] — what biometric is enrolled (for button visibility).
/// - [isEnrolledChanged] — snapshot comparison so a NEW fingerprint/face added
///   since enrolment invalidates the biometric gate (fall back to password).
/// - [promptUnlock] — the OS prompt with Indonesian copy.
/// - [promptEnrolDecision] — exactly-once dialog after the first password
///   sign-in; true when the user agreed to enrol.
/// - [markBiometricEnrolled] — writes the binding marker + biometric snapshot
///   under the `kk_biometric_credential_marker` key.
class BiometricService {
  BiometricService({
    required Authenticator authenticator,
    SecureStorageBackend? backend,
  }) : _auth = authenticator,
       _backend = backend ?? const FlutterSecureStorageBackend();

  static const snapshotKey = 'kk_biometric_snapshot';
  static const enrolAskedKey = 'kk_biometric_enrol_asked';

  final Authenticator _auth;
  final SecureStorageBackend _backend;

  Future<BiometricKind> availableKind() => _auth.availableKind();

  /// True when the currently-enrolled biometric set differs from the snapshot
  /// stored at enrolment time (a fingerprint was added/removed). On the first
  /// call with no stored snapshot it records one and returns false.
  Future<bool> isEnrolledChanged() async {
    try {
      final current = (await _auth.availableKind()).name;
      final stored = await _backend.read(snapshotKey);
      if (stored == null || stored.isEmpty) {
        await _backend.write(snapshotKey, current);
        return false;
      }
      return stored != current;
    } catch (_) {
      return false;
    }
  }

  Future<bool> promptUnlock({required String reasonId}) {
    return _auth.authenticate(reason: _reasonFor(reasonId));
  }

  /// Exactly-once enrolment ask. Returns true only when the user taps
  /// "Aktifkan" AND biometrics are currently enrolled. The "asked" marker is
  /// written before the dialog so it never asks again, even if dismissed.
  Future<bool> promptEnrolDecision() async {
    try {
      if (await availableKind() == BiometricKind.none) return false;
      if (await _backend.read(enrolAskedKey) != null) return false;
      await _backend.write(enrolAskedKey, '1');

      final context = rootNavigatorKey.currentContext;
      if (context == null) return false; // Headless (provider test) — no ask.
      // The root GlobalKey has no State.mounted to check; the dialog is a
      // one-shot that reads a stable navigator context captured after the last
      // await, so the lint is a false positive here.
      final agreed = await showDialog<bool>(
        // ignore: use_build_context_synchronously
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Masuk dengan sidik jari?'),
          content: const Text(
            'Aktifkan masuk cepat tanpa mengetik kata sandi. Sidik jari Anda '
            'hanya dipakai untuk membuka kredensial di perangkat ini.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Nanti saja'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Aktifkan'),
            ),
          ],
        ),
      );
      return agreed ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Writes the enrolment binding marker + the current biometric snapshot so
  /// device-refresh can happen behind biometric.
  Future<void> markBiometricEnrolled() async {
    try {
      final kind = (await _auth.availableKind()).name;
      await _backend.write(DeviceCredentialStore.markerKey, kind);
      await _backend.write(snapshotKey, kind);
    } catch (_) {
      // Best-effort; a missing marker only hides the biometric button.
    }
  }

  String _reasonFor(String reasonId) => switch (reasonId) {
    'unlock' => 'Buka KaryawanKu dengan sidik jari.',
    'refresh' => 'Konfirmasi identitas untuk memuat sesi Anda.',
    'enrol' => 'Aktifkan masuk dengan sidik jari.',
    _ => 'Konfirmasi identitas Anda.',
  };
}
