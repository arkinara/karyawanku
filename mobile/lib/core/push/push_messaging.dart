import 'package:firebase_messaging/firebase_messaging.dart';

/// Thin abstraction over the FirebaseMessaging surface the app uses, so tests
/// can inject a `FakeMessaging` and never touch a real Firebase/APNs channel
/// (ticket #71, "NO real Firebase in tests"). The production implementation
/// [FirebasePushMessaging] delegates to the plugin.
abstract interface class PushMessaging {
  Future<String?> getToken();

  /// True when the OS notification permission is granted (authorized or
  /// provisional).
  Future<bool> requestPermission();

  /// Foreground FCM messages — surfaced in-app via local notifications.
  Stream<RemoteMessage> get onMessage;

  /// Messages tapped from a background/terminated state.
  Stream<RemoteMessage> get onMessageOpenedApp;

  /// FCM token rotation.
  Stream<String> get onTokenRefresh;

  /// The message that launched the app from a terminated state (cold start).
  Future<RemoteMessage?> getInitialMessage();
}

/// Real plugin-backed implementation. The `FirebaseMessaging.instance` handle
/// is resolved lazily per call so a missing Firebase initialization (tests,
/// placeholder config) fails inside the guarded FCMService calls instead of at
/// construction time.
class FirebasePushMessaging implements PushMessaging {
  FirebaseMessaging? _messaging;

  FirebaseMessaging get _instance => _messaging ??= FirebaseMessaging.instance;

  @override
  Future<String?> getToken() => _instance.getToken();

  @override
  Future<bool> requestPermission() async {
    final settings = await _instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    final status = settings.authorizationStatus;
    return status == AuthorizationStatus.authorized ||
        status == AuthorizationStatus.provisional;
  }

  @override
  Stream<RemoteMessage> get onMessage => FirebaseMessaging.onMessage;

  @override
  Stream<RemoteMessage> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp;

  @override
  Stream<String> get onTokenRefresh => _instance.onTokenRefresh;

  @override
  Future<RemoteMessage?> getInitialMessage() => _instance.getInitialMessage();
}
