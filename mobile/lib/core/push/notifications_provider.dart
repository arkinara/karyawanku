import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'push_registration.dart';

/// One in-app notification event (foreground FCM message). The badge and the
/// bell bottom sheet are fed from here until a server-backed notification list
/// exists — the count is local and increments on each foreground `onMessage`.
@immutable
class InAppNotification {
  const InAppNotification({
    required this.title,
    required this.body,
    required this.receivedAt,
    required this.data,
  });

  final String title;
  final String body;
  final DateTime receivedAt;

  /// The FCM `data` payload — deep-link keys (`kind`, `requestId`,
  /// `assignmentId`) for tap-through.
  final Map<String, dynamic> data;
}

@immutable
class NotificationsState {
  const NotificationsState({this.unread = 0, this.recent = const []});

  final int unread;

  /// Most recent events, newest first (capped at 5).
  final List<InAppNotification> recent;

  NotificationsState copyWith({int? unread, List<InAppNotification>? recent}) {
    return NotificationsState(
      unread: unread ?? this.unread,
      recent: recent ?? this.recent,
    );
  }
}

final notificationsProvider =
    NotifierProvider<NotificationsNotifier, NotificationsState>(
      NotificationsNotifier.new,
    );

/// Local unread counter + recent events. Subscribes to foreground FCM messages
/// once; the subscription is disposed with the container so widget tests (that
/// do not override `fcmServiceProvider`) never leak a platform-channel
/// subscription.
class NotificationsNotifier extends Notifier<NotificationsState> {
  StreamSubscription<RemoteMessage>? _sub;

  @override
  NotificationsState build() {
    _sub ??= _subscribe();
    ref.onDispose(() => _sub?.cancel());
    return const NotificationsState();
  }

  StreamSubscription<RemoteMessage>? _subscribe() {
    try {
      return ref.read(fcmServiceProvider).onMessage.listen((message) {
        final notification = message.notification;
        if (notification == null) return;
        final item = InAppNotification(
          title: notification.title ?? 'KaryawanKu',
          body: notification.body ?? '',
          receivedAt: DateTime.now(),
          data: message.data,
        );
        state = NotificationsState(
          unread: state.unread + 1,
          recent: [item, ...state.recent].take(5).toList(),
        );
      });
    } catch (_) {
      // No messaging channel — badge stays zero.
      return null;
    }
  }

  /// Called when the user opens the bell sheet — clears the badge. The recent
  /// events stay so the sheet still has content.
  void markAllRead() {
    if (state.unread > 0) state = state.copyWith(unread: 0);
  }
}
