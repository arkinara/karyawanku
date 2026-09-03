import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';

import 'push_messaging.dart';

/// Wraps [PushMessaging] for the app. Every Firebase call is guarded so a
/// missing configuration (no `google-services.json` / `GoogleService-Info.plist`,
/// or Firebase initialization that failed) degrades to "no push" instead of
/// crashing — the rest of the app is unaffected (negative AC).
///
/// The streams swallow listen-time errors so widget tests that do not override
/// `fcmServiceProvider` still render without an unhandled platform-channel
/// exception.
class FCMService {
  FCMService({PushMessaging? messaging})
      : _messaging = messaging ?? FirebasePushMessaging();

  /// Process-wide singleton. Tests inject a `FakeMessaging` via the provider
  /// override, never the real plugin.
  static final FCMService instance = FCMService();

  final PushMessaging _messaging;

  /// The device's FCM token, or null when messaging is unavailable / init
  /// failed / permission denied.
  Future<String?> getDeviceToken() async {
    try {
      return await _messaging.getToken();
    } catch (_) {
      return null;
    }
  }

  /// OS notification permission. False on denial or when messaging is
  /// unavailable.
  Future<bool> requestPermission() async {
    try {
      return await _messaging.requestPermission();
    } catch (_) {
      return false;
    }
  }

  Stream<RemoteMessage> get onMessage {
    try {
      return _messaging.onMessage.handleError((Object _) {});
    } catch (_) {
      return const Stream.empty();
    }
  }

  Stream<RemoteMessage> get onMessageOpenedApp {
    try {
      return _messaging.onMessageOpenedApp.handleError((Object _) {});
    } catch (_) {
      return const Stream.empty();
    }
  }

  Stream<String> get onTokenRefresh {
    try {
      return _messaging.onTokenRefresh.handleError((Object _) {});
    } catch (_) {
      return const Stream.empty();
    }
  }

  Future<RemoteMessage?> getInitialMessage() async {
    try {
      return await _messaging.getInitialMessage();
    } catch (_) {
      return null;
    }
  }
}