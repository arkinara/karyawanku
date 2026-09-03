import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/secure_session_store.dart';

/// Persists the privacy consent shown before the first selfie capture
/// (ticket #69). Consent lives in secure storage — the same Keychain /
/// EncryptedSharedPreferences that holds the session tokens.
///
/// Copy agreed to by the user (shown once, in the consent dialog):
/// - "Selfie disimpan 90 hari" — retention period;
/// - "Hanya Anda + owner yang bisa melihat" — access scope;
/// - "Bisa dihapus" — deletability.
class SelfieConsentStore {
  SelfieConsentStore({SecureStorageBackend? backend})
    : _backend = backend ?? const FlutterSecureStorageBackend();

  static const consentKey = 'kk_selfie_consent';

  final SecureStorageBackend _backend;

  /// True once the user has tapped "Saya Mengerti" on the consent dialog.
  Future<bool> hasConsent() async {
    try {
      return await _backend.read(consentKey) == '1';
    } catch (_) {
      // Unreachable storage ⇒ treat as not-consented (show the dialog again),
      // never a crash.
      return false;
    }
  }

  Future<void> grant() async {
    await _backend.write(consentKey, '1');
  }
}

/// Single [SelfieConsentStore] shared by the screen and by tests.
final selfieConsentStoreProvider = Provider<SelfieConsentStore>(
  (ref) => SelfieConsentStore(),
);
