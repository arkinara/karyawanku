import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/device_repository.dart';
import '../auth/auth_provider.dart';
import 'fcm_service.dart';

// Private fields via named parameters (private named params are illegal).
// ignore_for_file: prefer_initializing_formals

final fcmServiceProvider = Provider<FCMService>((ref) => FCMService.instance);

final deviceRepositoryProvider = Provider<DeviceRepository>(
  (ref) => DeviceRepository(ref.watch(apiClientProvider)),
);

/// Coordinates FCM registration with the auth lifecycle (ticket #71):
/// - `register()`  after sign-in: permission → token → POST /api/devices, then
///   re-registers on FCM token rotation.
/// - `unregister()` on sign-out: DELETE /api/devices/:id so a signed-out device
///   receives nothing.
/// Registration is best-effort and never blocks or fails sign-in.
class PushRegistration {
  PushRegistration({required FCMService fcm, required DeviceRepository devices})
      : _fcm = fcm,
        _devices = devices;

  final FCMService _fcm;
  final DeviceRepository _devices;

  String? _token;
  String? _deviceId;
  StreamSubscription<String>? _refreshSub;

  Future<void> register() async {
    try {
      final granted = await _fcm.requestPermission();
      if (!granted) return; // Denied → degrade to no push, app unaffected.
      final token = await _fcm.getDeviceToken();
      if (token == null || token.isEmpty) return;
      _token = token;
      _deviceId = await _devices.register(token: token, platform: _platform);
      _refreshSub ??= _fcm.onTokenRefresh.listen((t) {
        if (t.isEmpty || t == _token) return;
        _token = t;
        // Upsert dedupes on (user_id, token); the stale token's row is pruned
        // server-side when FCM rejects it.
        _devices.register(token: t, platform: _platform);
      });
    } catch (_) {
      // A failed registration must never surface in the sign-in flow.
    }
  }

  Future<void> unregister() async {
    final sub = _refreshSub;
    _refreshSub = null;
    await sub?.cancel();
    final id = _deviceId;
    _token = null;
    _deviceId = null;
    if (id != null && id.isNotEmpty) {
      await _devices.unregister(id);
    }
  }

  String get _platform =>
      defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
}

final pushRegistrationProvider = Provider<PushRegistration>(
  (ref) => PushRegistration(
    fcm: ref.watch(fcmServiceProvider),
    devices: ref.watch(deviceRepositoryProvider),
  ),
);