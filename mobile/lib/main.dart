import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';

import 'app.dart';
import 'core/push/local_notifications.dart';
import 'core/widget/widget_state.dart';

/// Background/terminated FCM handler (ticket #71). Runs in its own isolate, so
/// no Flutter UI or Riverpod container is available — the OS displays the
/// notification itself. Must be a top-level function for `onBackgroundMessage`.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // No-op by design: FCM renders the system notification in the background.
  // Taps are handled on cold-start via getInitialMessage().
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase is optional here: with the placeholder config (README) it fails
  // to initialize and push degrades to "off" — the rest of the app is
  // unaffected (negative AC).
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // No Firebase config — push unavailable.
  }

  final localNotifications = LocalNotifications.instance;
  await localNotifications.initialize();

  // Ticket #74 — iOS widget App Group. Best-effort: without the entitlement
  // this fails silently and the widget keeps its last cached entry.
  try {
    await HomeWidget.setAppGroupId(kWidgetAppGroupId);
  } catch (_) {
    // No App Group configured — the iOS widget extension can't be updated.
  }

  try {
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    // Foreground messages surface in-app via a local notification (the OS
    // would otherwise swallow them).
    FirebaseMessaging.onMessage.listen((message) {
      localNotifications.show(message);
    });
  } catch (_) {
    // Messaging unavailable — foreground handling off.
  }

  runApp(const ProviderScope(child: KaryawanKuApp()));
}
