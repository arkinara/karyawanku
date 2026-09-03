import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Local (on-device) notification presenter (ticket #71). Foreground FCM
/// messages are surfaced here — the OS would otherwise swallow them — and taps
/// emit the deep-link payload so the navigation layer can open the target.
///
/// `payload` carries the FCM `data` map (JSON) with the deep-link keys
/// (`kind`, `requestId` / `assignmentId`). Initialization and `show` are
/// guarded: a missing platform channel (widget tests, unsupported target)
/// degrades to no-op instead of throwing.
class LocalNotifications {
  LocalNotifications({FlutterLocalNotificationsPlugin? plugin})
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  static final LocalNotifications instance = LocalNotifications();

  final FlutterLocalNotificationsPlugin _plugin;

  final _taps = StreamController<Map<String, dynamic>>.broadcast();

  /// Fired when the user taps a displayed notification. The map is the FCM
  /// `data` payload (deep-link keys).
  Stream<Map<String, dynamic>> get onNotificationTap => _taps.stream;

  Future<void> initialize() async {
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    try {
      await _plugin.initialize(
        settings,
        onDidReceiveNotificationResponse: (response) {
          final data = _decode(response.payload);
          if (data != null) _taps.add(data);
        },
      );
      // Android 13+: ensure the OS notification permission is requested
      // through the plugin channel too (FCM permission alone is not enough).
      try {
        await _plugin
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >()
            ?.requestNotificationsPermission();
      } catch (_) {
        // Best-effort.
      }
    } catch (_) {
      // No platform channel — no-op.
    }
  }

  /// Display a foreground message as a local notification. Returns false when
  /// there is nothing to show or the platform channel is unavailable.
  Future<bool> show(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null || notification.title == null) return false;
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'karyawanku',
        'KaryawanKu',
        channelDescription: 'Notifikasi KaryawanKu',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );
    try {
      final id =
          message.messageId?.hashCode ?? DateTime.now().millisecondsSinceEpoch;
      await _plugin.show(
        id,
        notification.title,
        notification.body,
        details,
        payload: jsonEncode(message.data),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Map<String, dynamic>? _decode(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }
}
