import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The platform connectivity client. Overridable in tests with a canned
/// instance so no method channel is touched.
final connectivityProvider = Provider<Connectivity>((ref) => Connectivity());

/// Current online state as a [bool], kept in sync with the platform
/// `ConnectivityResult` stream:
/// `wifi` / `mobile` / `ethernet` (and any other non-`none` result) map to
/// online; `none` maps to offline.
///
/// Starts optimistically `true` so a cold start never flashes the offline
/// banner before the platform stream reports. The offline-queue manager
/// listens here to flush on reconnect; the attendance provider reads the
/// current value synchronously to decide between a direct write and the queue.
final isOnlineProvider = NotifierProvider<OnlineNotifier, bool>(
  OnlineNotifier.new,
);

class OnlineNotifier extends Notifier<bool> {
  StreamSubscription<bool>? _sub;

  @override
  bool build() {
    final connectivity = ref.watch(connectivityProvider);
    _sub = connectivity.onConnectivityChanged
        .map((results) => results.any((r) => r != ConnectivityResult.none))
        .listen((online) => state = online);
    ref.onDispose(() => _sub?.cancel());
    return true;
  }
}
