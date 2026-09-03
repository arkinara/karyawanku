import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../data/repositories/leave_repository.dart';
import '../api/api_exception.dart';
import 'fcm_service.dart';
import 'local_notifications.dart';

// Private fields via named parameters (private named params are illegal).
// ignore_for_file: prefer_initializing_formals

/// What a push notification / deep link points at.
enum DeepLinkKind { leave, shift }

class DeepLinkTarget {
  const DeepLinkTarget({required this.kind, required this.id});

  final DeepLinkKind kind;
  final String id;

  @override
  String toString() => '${kind.name}://$id';
}

/// Extract a target from an FCM `data` payload. The BE sends
/// `{ kind: 'leave', requestId }` for leave decisions and
/// `{ kind: 'shift_reminder', assignmentId }` for shift reminders.
DeepLinkTarget? targetFromMessage(Map<String, dynamic> data) {
  final kind = data['kind'];
  if (kind == 'leave') {
    final id = data['requestId'];
    if (id is String && id.isNotEmpty) {
      return DeepLinkTarget(kind: DeepLinkKind.leave, id: id);
    }
  }
  if (kind == 'shift_reminder') {
    final id = data['assignmentId'];
    if (id is String && id.isNotEmpty) {
      return DeepLinkTarget(kind: DeepLinkKind.shift, id: id);
    }
  }
  return null;
}

/// Parse a custom-scheme deep link: `karyawanku://leave/<requestId>` and
/// `karyawanku://shift/<assignmentId>` (note: `leave` is the URI *host*, the id
/// the path). A `karyawanku:///leave/<id>` path-form also works. Anything else
/// (wrong scheme, wrong shape) yields null → the caller shows a not-found
/// state.
DeepLinkTarget? parseDeepLink(Uri uri) {
  if (uri.scheme != 'karyawanku') return null;
  final segments = <String>[
    if (uri.host.isNotEmpty) uri.host,
    ...uri.pathSegments.where((s) => s.isNotEmpty),
  ];
  if (segments.length != 2 || segments[1].isEmpty) return null;
  return switch (segments[0]) {
    'leave' => DeepLinkTarget(kind: DeepLinkKind.leave, id: segments[1]),
    'shift' => DeepLinkTarget(kind: DeepLinkKind.shift, id: segments[1]),
    _ => null,
  };
}

/// Cross-employee guard (ticket #71, negative AC): a deep link to a leave
/// request or shift belonging to another employee must resolve to a not-found
/// state, never to that employee's data. The server-side authorization is the
/// primary gate (`GET /leave-requests/:id` returns 403/404 cross-employee);
/// this client pre-check turns the fetch into a 404 page before any data is
/// rendered. Shift targets are employee-scoped server-side (the roster only
/// contains the signed-in employee's published shifts), so ownership always
/// passes and the schedule never leaks a peer's row.
class DeepLinkGuard {
  DeepLinkGuard({required LeaveRepository leaveRepo}) : _leaveRepo = leaveRepo;

  final LeaveRepository _leaveRepo;

  Future<bool> owns(DeepLinkTarget target) async {
    if (target.kind == DeepLinkKind.shift) return true;
    try {
      await _leaveRepo.getById(target.id);
      return true;
    } on ApiException catch (e) {
      // 403 (forbidden), 404 (not found) or a dead session → not owned.
      return e is UnauthorizedException || e.status == 403 || e.status == 404
          ? false
          : true;
    }
  }
}

/// Routes push taps and deep links onto a single [targets] stream.
///
/// Sources:
/// - FCM messages tapped from background/terminated (`onMessageOpenedApp`)
/// - local notification taps (foreground display)
/// - custom-scheme links (`karyawanku://…` via app_links)
/// - cold-start initial message / initial link ([handleColdStart])
///
/// The navigation layer subscribes to [targets] and, on cold start, waits for
/// auth to resolve before navigating.
class DeepLinkRouter {
  DeepLinkRouter({
    required FCMService fcm,
    required LocalNotifications local,
    AppLinks? appLinks,
  })  : _fcm = fcm,
        _local = local,
        _appLinks = appLinks;

  final FCMService _fcm;
  final LocalNotifications _local;
  final AppLinks? _appLinks;

  final _targets = StreamController<DeepLinkTarget>.broadcast();
  Stream<DeepLinkTarget> get targets => _targets.stream;

  StreamSubscription<RemoteMessage>? _fcmSub;
  StreamSubscription<Map<String, dynamic>>? _localSub;
  StreamSubscription<Uri>? _appLinksSub;

  void start() {
    _fcmSub ??= _fcm.onMessageOpenedApp.listen((message) {
      final target = targetFromMessage(message.data);
      if (target != null) _targets.add(target);
    });
    _localSub ??= _local.onNotificationTap.listen((data) {
      final target = targetFromMessage(data);
      if (target != null) _targets.add(target);
    });
    final links = _appLinks;
    if (links != null) {
      try {
        _appLinksSub ??= links.uriLinkStream
            .handleError((Object _) {})
            .listen((uri) {
          final target = parseDeepLink(uri);
          if (target != null) _targets.add(target);
        });
      } catch (_) {
        // No app-links channel — custom-scheme routing unavailable.
      }
    }
  }

  /// Cold start: the FCM message that launched the app from a terminated
  /// state, else an initial custom-scheme link. Guarded — no platform channel
  /// is a no-op.
  Future<void> handleColdStart() async {
    final message = await _fcm.getInitialMessage();
    if (message != null) {
      final target = targetFromMessage(message.data);
      if (target != null) _targets.add(target);
      return;
    }
    final links = _appLinks;
    if (links == null) return;
    try {
      final link = await links.getInitialLink();
      if (link != null) {
        final target = parseDeepLink(link);
        if (target != null) _targets.add(target);
      }
    } catch (_) {
      // No app-links channel — ignore.
    }
  }

  void dispose() {
    _fcmSub?.cancel();
    _localSub?.cancel();
    _appLinksSub?.cancel();
    _targets.close();
  }
}