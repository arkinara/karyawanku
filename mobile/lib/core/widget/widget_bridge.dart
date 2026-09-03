import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';

import '../../core/api/models.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/biometric_providers.dart';
import '../../core/location/location_service.dart';
import '../../core/navigation.dart';
import '../../data/models.dart';
import '../../features/absensi/attendance_provider.dart';
import '../../features/absensi/geofence_provider.dart';
import '../../features/jadwal/shift_provider.dart';
import 'widget_state.dart';

/// Native widget registration names — the `name`/`androidName`/`iOSName`
/// arguments `HomeWidget.updateWidget` resolves the installed widgets with.
/// `androidName` is the AppWidgetProvider class name; `iOSName` is the widget
/// extension's kind.
abstract final class WidgetNames {
  static const widgetName = 'KaryawanKuWidget';
  static const androidProvider = 'KaryawanKuWidgetProvider';
  static const iosKind = 'KaryawanKuWidget';
}

/// Deep-link URIs the widget buttons carry, delivered to the app through
/// `HomeWidget.widgetClicked` / `initiallyLaunchedFromHomeWidget`. The Android
/// provider and the iOS widget build these from the same [Uri] shape.
abstract final class WidgetUris {
  static const _scheme = 'karyawanku';
  static const _host = 'widget';

  static Uri action(Uri Function() build) => build();

  /// `karyawanku://widget?action=clock_in`
  static Uri clockIn() => Uri(
    scheme: _scheme,
    host: _host,
    queryParameters: const {'action': 'clock_in'},
  );

  /// `karyawanku://widget?action=clock_out`
  static Uri clockOut() => Uri(
    scheme: _scheme,
    host: _host,
    queryParameters: const {'action': 'clock_out'},
  );

  /// `karyawanku://widget?action=sign_in&intent=widget` — the signed-out
  /// state's tap target.
  static Uri signIn() => Uri(
    scheme: _scheme,
    host: _host,
    queryParameters: const {'action': 'sign_in', 'intent': 'widget'},
  );

  /// `karyawanku://widget` — plain open-the-app tap.
  static Uri open() => Uri(scheme: _scheme, host: _host);
}

/// Thin seam over the `home_widget` plugin. Widget tests inject a
/// [FakeWidgetBridge] so no Android/iOS widget runtime is exercised in
/// `flutter test` — only the wiring.
///
/// Every method follows the FCM-service pattern: platform errors are swallowed
/// (missing channel, widget not pinned, no group id) and the app keeps
/// working; the widget is a convenience surface, never a hard dependency.
abstract interface class WidgetBridge {
  /// Refresh every pinned widget instance so it re-renders the latest
  /// snapshot. Resolves the provider by [WidgetNames.androidProvider] on
  /// Android and [WidgetNames.iosKind] on iOS.
  Future<void> updateWidget();

  /// URIs of tapped widgets while the app runs.
  Stream<Uri?> get onWidgetClicked;

  /// The widget URI that launched the app from a cold start, if any.
  Future<Uri?> initiallyLaunchedFromHomeWidget();

  /// Open (or route the running app to) [uri] — e.g. the signed-out widget's
  /// `karyawanku://widget?action=sign_in` tap. The auth-gated root already
  /// lands on the right screen; this records the launch intent and, when the
  /// URI is not already the visible screen, navigates to it.
  Future<void> launchApp(Uri uri);
}

/// Production bridge over the `home_widget` plugin.
class HomeWidgetBridge implements WidgetBridge {
  @override
  Future<void> updateWidget() async {
    try {
      await HomeWidget.updateWidget(
        name: WidgetNames.widgetName,
        androidName: WidgetNames.androidProvider,
        iOSName: WidgetNames.iosKind,
      );
    } catch (_) {
      // No widget pinned / no platform channel — nothing to refresh.
    }
  }

  @override
  Stream<Uri?> get onWidgetClicked =>
      HomeWidget.widgetClicked.handleError((Object _) {
        // No platform channel (widget tests) — the stream just stays silent.
      });

  @override
  Future<Uri?> initiallyLaunchedFromHomeWidget() async {
    try {
      return await HomeWidget.initiallyLaunchedFromHomeWidget();
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> launchApp(Uri uri) async {
    // home_widget 0.7.0 has no `launchApp`; the Dart callback runs inside the
    // running app, so "launching" means routing in-app. The auth-gated root
    // already shows MasukScreen when signed out and the shell when signed in,
    // so for our two paths (`/sign-in`, `/`) the visible screen is correct by
    // construction — we only record the intent so post-auth hand-off and
    // telemetry can react.
    if (uri.path.startsWith('/sign-in')) {
      WidgetLaunchIntent.record();
      return;
    }
    // Default `/` — signed-in app is already on the shell at Beranda.
    final navigator = rootNavigatorKey.currentState;
    navigator?.popUntil((route) => route.isFirst);
  }
}

final widgetBridgeProvider = Provider<WidgetBridge>(
  (ref) => HomeWidgetBridge(),
);

/// Records that the app was entered through a widget tap (`intent=widget`),
/// for telemetry and the post-auth deep-link hand-off.
abstract final class WidgetLaunchIntent {
  static bool _fromWidget = false;

  static void record() => _fromWidget = true;

  static bool get recorded => _fromWidget;
}

/// Build the next-upcoming [ShiftAssignment] for the widget: today's
/// assignment if there is one, else the earliest upcoming row at or after
/// today. Null when the roster has nothing usable.
ShiftAssignment? nextUpcomingAssignment(ShiftState shift) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  for (final a in shift.upcoming) {
    final d = DateTime(a.tanggal.year, a.tanggal.month, a.tanggal.day);
    if (d.isBefore(today)) continue;
    if (d == today) return a;
  }
  for (final a in shift.upcoming) {
    final d = DateTime(a.tanggal.year, a.tanggal.month, a.tanggal.day);
    if (d.isBefore(today)) continue;
    return a;
  }
  // Fall back to the monthly/weekly cache when the upcoming list is empty.
  final keys = shift.assignmentsByDate.keys.where((k) => !k.isBefore(today));
  if (keys.isEmpty) return null;
  return shift.assignmentsByDate[keys.reduce((a, b) => a.isBefore(b) ? a : b)];
}

DateTime? _shiftInstant(DateTime tanggal, String? hhmm) {
  if (hhmm == null) return null;
  final parts = hhmm.split(':');
  if (parts.length != 2) return null;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return null;
  return DateTime(tanggal.year, tanggal.month, tanggal.day, hour, minute);
}

/// Build the snapshot the widget renders from the live app state. Pure data
/// in, pure data out — no I/O, so it is unit-testable without mocks.
WidgetSnapshot buildWidgetSnapshot({
  required AttendanceState attendance,
  required ShiftState shift,
  required User? user,
  required String? deviceId,
  required GeofenceState geofence,
}) {
  final record = attendance.today?.record;
  final assignment = nextUpcomingAssignment(shift);
  final shiftObj = assignment?.shift;

  return WidgetSnapshot(
    businessId: user?.businessId,
    shiftLabel: shiftObj?.label,
    shiftRange: shiftObj?.range,
    shiftStartAt: assignment == null
        ? null
        : _shiftInstant(assignment.tanggal, shiftObj?.jamMulai),
    shiftEndAt: assignment == null
        ? null
        : _shiftInstant(assignment.tanggal, shiftObj?.jamSelesai),
    clockedInAt: record?.clockIn,
    clockedOutAt: record?.clockOut,
    signedOut: user == null,
    deviceId: deviceId,
    geofenceDistanceM: _geofenceVerdict(geofence),
    failureMessage: attendance.actionError,
    pendingSync: record?.id.startsWith('local-') ?? false,
    cachedAt: DateTime.now(),
  );
}

/// `null` = no geofence / unknown verdict; `-1` = outside; `>= 0` = inside.
double? _geofenceVerdict(GeofenceState geofence) {
  final config = geofence.geofence;
  if (config == null || !config.isConfigured) return null;
  switch (geofence.status) {
    case GeofenceStatus.inside:
      return (geofence.distanceMeters ?? 0).toDouble();
    case GeofenceStatus.outside:
      return -1;
    case GeofenceStatus.lowAccuracy:
    case GeofenceStatus.unknown:
      return null;
  }
}

/// Persist the current app state into [WidgetStore] and refresh every pinned
/// widget. Called by the attendance / shift / auth providers after their
/// mutations so the widget always mirrors the Beranda hero. Best-effort: any
/// storage or platform failure is swallowed — the caller's flow is the
/// source of truth.
///
/// The caller passes its OWN state ([attendance] / [shift]) explicitly because
/// Riverpod forbids a provider reading itself; the other state is read from
/// the container.
Future<void> syncWidgetSnapshot(
  Ref ref, {
  AttendanceState? attendance,
  ShiftState? shift,
}) async {
  try {
    final auth = ref.read(authProvider);
    final AttendanceState resolvedAttendance =
        attendance ?? ref.read(attendanceProvider);
    final ShiftState resolvedShift = shift ?? ref.read(shiftProvider);
    final geofence = ref.read(geofenceProvider);
    final deviceIdentity = await ref.read(deviceIdentityProvider.future);
    final snapshot = buildWidgetSnapshot(
      attendance: resolvedAttendance,
      shift: resolvedShift,
      user: auth.user,
      deviceId: deviceIdentity.id,
      geofence: geofence,
    );
    await WidgetStore.saveSnapshot(snapshot);
    await ref.read(widgetBridgeProvider).updateWidget();
  } catch (_) {
    // Best-effort — the widget never breaks the flow that feeds it.
  }
}
