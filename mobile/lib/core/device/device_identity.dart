import 'package:uuid/uuid.dart';

import '../auth/secure_session_store.dart';

/// Stable per-install identity used to bind the device credential to a
/// physical device. `id` is a UUID v4 generated once at first launch and
/// persisted in secure storage (`kk_device_id`); it travels with every request
/// as the `X-Device-Id` header so the BE can bind `device_credentials` rows.
///
/// `pushToken` is the opaque device-bound string the BE mints on the first
/// authenticated session — the `device_install_id` of the first device
/// credential. It is recorded after a successful sign-in / device-refresh and
/// dropped on `rotate()`.
class DeviceIdentity {
  DeviceIdentity._(
    this._backend,
    this._id,
    this._pushToken, {
    required this.isFresh,
  });

  static const deviceIdKey = 'kk_device_id';
  static const pushTokenKey = 'kk_push_token';

  final SecureStorageBackend _backend;
  String _id;
  String? _pushToken;

  /// True only when `id` was minted for the first time in this install.
  final bool isFresh;

  /// Returns the stored identity, or mints + persists a fresh one. A storage
  /// failure degrades to a blank identity (empty `id`) — the request simply
  /// omits `X-Device-Id` and the BE never mints a device credential.
  static Future<DeviceIdentity> ensureInitialized({
    SecureStorageBackend? backend,
  }) async {
    final storage = backend ?? const FlutterSecureStorageBackend();
    try {
      final existing = await storage.read(deviceIdKey);
      if (existing != null && existing.isNotEmpty) {
        final pushToken = await storage.read(pushTokenKey);
        return DeviceIdentity._(storage, existing, pushToken, isFresh: false);
      }
      final fresh = const Uuid().v4();
      await storage.write(deviceIdKey, fresh);
      return DeviceIdentity._(storage, fresh, null, isFresh: true);
    } catch (_) {
      return DeviceIdentity._(storage, '', null, isFresh: false);
    }
  }

  String get id => _id;

  String? get pushToken => _pushToken;

  /// Records the BE-minted opaque device-bound string (the `device_install_id`).
  Future<void> rememberPushToken(String token) async {
    _pushToken = token;
    try {
      await _backend.write(pushTokenKey, token);
    } catch (_) {
      // Best-effort; the in-memory value is still set.
    }
  }

  /// Drops the stored identity — used when a credential is rejected as
  /// cross-device. The next [ensureInitialized] mints a fresh identity.
  Future<void> rotate() async {
    _id = '';
    _pushToken = null;
    try {
      await _backend.delete(deviceIdKey);
      await _backend.delete(pushTokenKey);
    } catch (_) {
      // Best-effort.
    }
  }
}
