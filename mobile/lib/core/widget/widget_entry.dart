import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/absensi/attendance_provider.dart';
import '../auth/auth_provider.dart';
import 'widget_bridge.dart';

/// What a widget tap wants the app to do.
enum WidgetAction { clockIn, clockOut, signIn, open }

/// Parse the `action` query parameter off a widget deep-link URI:
/// `clock_in` / `clock_out` / `sign_in`, anything else = plain [open].
WidgetAction? widgetActionFromUri(Uri? uri) {
  if (uri == null) return null;
  return switch (uri.queryParameters['action']) {
    'clock_in' => WidgetAction.clockIn,
    'clock_out' => WidgetAction.clockOut,
    'sign_in' => WidgetAction.signIn,
    _ => WidgetAction.open,
  };
}

/// A widget clock-action URI received while the app was signed out, deferred
/// until the next successful sign-in. The root router consumes it on the
/// signed-in transition; the sign-in screen and the shell also check it so
/// the action always runs exactly once.
final pendingWidgetActionProvider =
    NotifierProvider<PendingWidgetActionNotifier, Uri?>(
      PendingWidgetActionNotifier.new,
    );

class PendingWidgetActionNotifier extends Notifier<Uri?> {
  @override
  Uri? build() => null;

  void set(Uri? uri) => state = uri;

  void clear() => state = null;
}

/// Handle a widget tap URI delivered through [WidgetBridge.onWidgetClicked] or
/// [WidgetBridge.initiallyLaunchedFromHomeWidget].
///
/// - signed out + `sign_in` → record the launch intent (telemetry) and let the
///   auth-gated root land on MasukScreen;
/// - signed out + clock action → defer it to [pendingWidgetActionProvider] and
///   route to sign-in, so the action runs right after auth resolves;
/// - signed in → run the action now (the attendance provider's own sync hook
///   persists the resulting snapshot and refreshes the widget).
Future<void> onWidgetClicked(
  Uri? data, {
  required ProviderContainer container,
  required WidgetBridge bridge,
}) async {
  final action = widgetActionFromUri(data);
  if (action == null) return;

  if (action == WidgetAction.signIn) {
    await bridge.launchApp(WidgetUris.signIn());
    return;
  }

  if (!container.read(authProvider).isSignedIn) {
    container.read(pendingWidgetActionProvider.notifier).set(data);
    await bridge.launchApp(WidgetUris.signIn());
    return;
  }

  await runWidgetAction(action, container: container, bridge: bridge);
}

/// Run a clock action through the attendance provider. Reuses the same
/// idempotent, queue-aware path as the in-app button — a widget-driven
/// clock-in while offline is QUEUED (never lost, never duplicated), and the
/// provider's in-flight guard debounces rapid repeat taps.
Future<void> runWidgetAction(
  WidgetAction action, {
  required ProviderContainer container,
  required WidgetBridge bridge,
}) async {
  final notifier = container.read(attendanceProvider.notifier);
  switch (action) {
    case WidgetAction.clockIn:
      await notifier.clockInWithQueue();
    case WidgetAction.clockOut:
      await notifier.clockOutWithQueue();
    case WidgetAction.signIn:
    case WidgetAction.open:
      break;
  }
}

/// Post-auth hand-off (ticket #74): run any widget action that arrived while
/// signed out. Consumed by the root router on the signed-in transition and
/// checked again by the sign-in screen + shell so a widget tap always lands.
/// Clearing first means the second caller is a no-op — exactly one run.
Future<void> handlePendingWidgetAction(
  ProviderContainer container, {
  required WidgetBridge bridge,
}) async {
  final pending = container.read(pendingWidgetActionProvider);
  if (pending == null) return;
  container.read(pendingWidgetActionProvider.notifier).clear();
  final action = widgetActionFromUri(pending);
  if (action != null &&
      (action == WidgetAction.clockIn || action == WidgetAction.clockOut)) {
    await runWidgetAction(action, container: container, bridge: bridge);
  }
}
