import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/models.dart';

/// Minimal key-value surface of [FlutterSecureStorage]. Extracted so unit
/// tests can substitute an in-memory backend without platform channels.
abstract interface class SecureStorageBackend {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Default backend — iOS Keychain, Android EncryptedSharedPreferences (the
/// Keystore-backed AES key). Tokens never touch SharedPreferences or files.
class FlutterSecureStorageBackend implements SecureStorageBackend {
  const FlutterSecureStorageBackend();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Persists the auth [Session] (access token, refresh token, user) in
/// platform-backed secure storage. A storage read failure — e.g. a restored
/// backup on a new device — is treated as signed-out, never as a crash.
class SecureSessionStore {
  SecureSessionStore({SecureStorageBackend? backend})
      : _backend = backend ?? const FlutterSecureStorageBackend();

  /// Process-wide singleton backed by the platform Keychain /
  /// EncryptedSharedPreferences.
  static final SecureSessionStore instance = SecureSessionStore();

  static const accessTokenKey = 'kk_access_token';
  static const refreshTokenKey = 'kk_refresh_token';
  static const userKey = 'kk_user';

  final SecureStorageBackend _backend;

  Future<void> saveSession(Session session) async {
    await _backend.write(accessTokenKey, session.accessToken);
    await _backend.write(refreshTokenKey, session.refreshToken);
    await _backend.write(userKey, jsonEncode(session.user.toJson()));
  }

  /// Persists just the token pair (used after `POST /auth/refresh`).
  Future<void> setTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _backend.write(accessTokenKey, accessToken);
    await _backend.write(refreshTokenKey, refreshToken);
  }

  /// Restores the full session, or `null` when signed out or unreadable.
  Future<Session?> getSession() async {
    try {
      final accessToken = await _backend.read(accessTokenKey);
      final refreshToken = await _backend.read(refreshTokenKey);
      final userRaw = await _backend.read(userKey);
      if (accessToken == null || refreshToken == null || userRaw == null) {
        return null;
      }
      final user = User.fromJson(jsonDecode(userRaw) as Map<String, dynamic>);
      return Session(accessToken: accessToken, refreshToken: refreshToken, user: user);
    } catch (_) {
      // Corrupt or unreachable storage ⇒ signed-out, never a crash.
      return null;
    }
  }

  Future<String?> getAccessToken() async {
    try {
      return await _backend.read(accessTokenKey);
    } catch (_) {
      return null;
    }
  }

  Future<String?> getRefreshToken() async {
    try {
      return await _backend.read(refreshTokenKey);
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    await _backend.delete(accessTokenKey);
    await _backend.delete(refreshTokenKey);
    await _backend.delete(userKey);
  }
}