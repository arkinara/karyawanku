import 'package:local_auth/local_auth.dart';

/// Device biometric classes the app cares about, normalized so the rest of the
/// code never touches `local_auth`'s platform types directly.
enum BiometricKind { none, fingerprint, face, weak, strong }

/// Thin seam over `local_auth` — the ONLY place that imports the plugin.
/// Tests inject a [FakeAuthenticator] here, so no headless test ever reaches
/// the OS biometric prompt.
abstract interface class Authenticator {
  /// What biometric (if any) is currently enrolled and usable on the device.
  /// Returns [BiometricKind.none] when there is no hardware, no enrolment, or
  /// the platform query fails.
  Future<BiometricKind> availableKind();

  /// Shows the OS biometric prompt. Returns true only on a successful match.
  Future<bool> authenticate({required String reason});
}

/// Real implementation backed by `local_auth`.
class LocalAuthenticator implements Authenticator {
  LocalAuthenticator();

  final LocalAuthentication _auth = LocalAuthentication();

  @override
  Future<BiometricKind> availableKind() async {
    try {
      if (!await _auth.canCheckBiometrics) return BiometricKind.none;
      final enrolled = await _auth.getAvailableBiometrics();
      if (enrolled.isEmpty) return BiometricKind.none;
      if (enrolled.contains(BiometricType.fingerprint)) {
        return BiometricKind.fingerprint;
      }
      if (enrolled.contains(BiometricType.strong)) return BiometricKind.strong;
      if (enrolled.contains(BiometricType.face) ||
          enrolled.contains(BiometricType.iris)) {
        return BiometricKind.face;
      }
      if (enrolled.contains(BiometricType.weak)) return BiometricKind.weak;
      return BiometricKind.none;
    } catch (_) {
      // Unsupported platform / query failure ⇒ no biometric.
      return BiometricKind.none;
    }
  }

  @override
  Future<bool> authenticate({required String reason}) async {
    try {
      // `biometricOnly: true` — never silently fall back to the device
      // passcode/PIN. The credential stays behind a real biometric check.
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(biometricOnly: true),
      );
    } catch (_) {
      return false;
    }
  }
}