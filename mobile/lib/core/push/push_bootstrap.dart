import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'deep_link_router.dart';
import 'local_notifications.dart';
import 'push_registration.dart';

final localNotificationsProvider = Provider<LocalNotifications>(
  (ref) => LocalNotifications.instance,
);

final deepLinkRouterProvider = Provider<DeepLinkRouter>((ref) {
  final router = DeepLinkRouter(
    fcm: ref.watch(fcmServiceProvider),
    local: ref.watch(localNotificationsProvider),
    appLinks: AppLinks(),
  );
  ref.onDispose(router.dispose);
  return router;
});
