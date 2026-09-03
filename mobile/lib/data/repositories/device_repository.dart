import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../models.dart';

/// Typed access to the BE device endpoints (`backend/src/routes/devices.ts`,
/// ticket #71). Token registration is upserted server-side on `(user_id,
/// token)`, so re-login / token rotation never double-registers. A 401 on
/// register is a no-op (not signed in yet) — it must never throw.
class DeviceRepository {
  const DeviceRepository(this._api);

  final ApiClient _api;

  /// `POST /api/devices` with `{ token, platform, app_version }`. Returns the
  /// registered device id (used by sign-out to delete the session's device).
  Future<String> register({
    required String token,
    required String platform,
    String? appVersion,
  }) async {
    try {
      final data = await _api.post<Map<String, dynamic>>(
        '/devices',
        body: {
          'token': token,
          'platform': platform,
          'app_version': appVersion,
        },
      );
      final device = data['device'];
      if (device is Map<String, dynamic>) {
        return device['id'] as String? ?? '';
      }
      return '';
    } on UnauthorizedException {
      // Not signed in — nothing to register against.
      return '';
    }
  }

  /// `DELETE /api/devices/:id` — sign-out removes this session's device so a
  /// signed-out device receives nothing (negative AC). Best-effort.
  Future<void> unregister(String id) async {
    try {
      await _api.delete<Map<String, dynamic>>('/devices/$id');
    } catch (_) {
      // Best-effort on sign-out; local state is cleared regardless.
    }
  }

  /// `POST /api/devices/:id/invalidate` — FCM-UNREGISTERED callback: prune a
  /// token the provider rejected. Best-effort.
  Future<void> invalidate(String token) async {
    try {
      final data = await _api.get<Map<String, dynamic>>('/devices');
      final raw = data['devices'];
      if (raw is! List) return;
      for (final item in raw.whereType<Map<String, dynamic>>()) {
        if (item['token'] == token) {
          final id = item['id'];
          if (id is String && id.isNotEmpty) {
            await _api.post<Map<String, dynamic>>(
              '/devices/$id/invalidate',
              body: {'reason': 'FCM-UNREGISTERED'},
            );
          }
          return;
        }
      }
    } catch (_) {
      // Best-effort; the server prunes on its own retry path too.
    }
  }

  /// `GET /api/devices` — the signed-in user's own devices.
  Future<List<DeviceRegistration>> list() async {
    final data = await _api.get<Map<String, dynamic>>('/devices');
    final raw = data['devices'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(DeviceRegistration.fromJson)
        .toList();
  }
}