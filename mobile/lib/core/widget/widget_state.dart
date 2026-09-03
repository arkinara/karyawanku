import 'dart:convert';

import 'package:home_widget/home_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The iOS App Group the app and the widget extension share (ticket #74).
/// The Flutter side writes the snapshot into the group's UserDefaults via
/// `HomeWidget.saveWidgetData` so the SwiftUI widget can read it without the
/// app running. The entitlement must be enabled on both targets — see
/// `mobile/README.md` "Home-screen widget".
const kWidgetAppGroupId = 'group.com.karyawanku.mobile';

/// Cached shift + clock-state snapshot the app writes and the home-screen
/// widget reads (ticket #74).
///
/// A single JSON blob under `kk_widget_snapshot` in the default
/// SharedPreferences, bumped by the `kk_widget_etag` counter on every write.
/// The Android `KaryawanKuWidgetProvider` reads the *same* prefs file
/// (`<package>_preferences`, the default prefs `shared_preferences` writes
/// to), so the widget and the app never drift.
///
/// All writes are best-effort: a failed platform read/write (tests, missing
/// channel, storage error) is swallowed — the widget is a convenience surface
/// and must never break the clock-in path that feeds it.
class WidgetSnapshot {
  const WidgetSnapshot({
    this.businessId,
    this.businessName,
    this.shiftLabel,
    this.shiftRange,
    this.shiftStartAt,
    this.shiftEndAt,
    this.clockedInAt,
    this.clockedOutAt,
    this.signedOut = false,
    this.deviceId,
    this.geofenceDistanceM,
    this.failureMessage,
    this.pendingSync = false,
    required this.cachedAt,
  });

  /// Signed-out / fresh-install snapshot the widget renders as
  /// "Masuk KaryawanKu".
  WidgetSnapshot.signedOut()
    : businessId = null,
      businessName = null,
      shiftLabel = null,
      shiftRange = null,
      shiftStartAt = null,
      shiftEndAt = null,
      clockedInAt = null,
      clockedOutAt = null,
      signedOut = true,
      deviceId = null,
      geofenceDistanceM = null,
      failureMessage = null,
      pendingSync = false,
      cachedAt = DateTime.now();

  /// The signed-in user's business id. [WidgetStore.readSnapshot] treats a
  /// snapshot without one (or with a stale one) as signed out, so a previous
  /// user's cached data can never leak into the widget.
  final String? businessId;

  /// Business name for the medium widget header. Null hides the header.
  final String? businessName;

  /// `Shift Pagi` / `Shift Siang` / `Belum ada shift` — verbatim from the BE.
  final String? shiftLabel;

  /// `07:00 – 15:00` — the server's own shift range, so the widget never
  /// re-derives a time from the device clock.
  final String? shiftRange;

  /// The next-upcoming shift's start/end as local instants (tanggal + jam).
  final DateTime? shiftStartAt;
  final DateTime? shiftEndAt;

  /// Server-authoritative clock times (UTC) of today's record.
  final DateTime? clockedInAt;
  final DateTime? clockedOutAt;

  /// True = the widget renders the signed-out state (Masuk KaryawanKu).
  final bool signedOut;

  /// The `X-Device-Id` (from `DeviceIdentity`) sent with widget-driven
  /// actions so the BE can de-dupe.
  final String? deviceId;

  /// Geofence verdict: `null` = no geofence configured / unknown; `-1` =
  /// outside the work area ("Clock-in dibuka di kantor"); `>= 0` = inside at
  /// that distance in metres.
  final double? geofenceDistanceM;

  /// Last BE rejection surfaced verbatim (e.g. the geofence 422) so the
  /// widget is never silently wrong.
  final String? failureMessage;

  /// True while a queued offline action is still awaiting sync (a
  /// `local-…` soft-commit). The widget marks the chip as pending.
  final bool pendingSync;

  /// When this snapshot was written; [WidgetStore.readSnapshot] expires
  /// snapshots older than 30 minutes.
  final DateTime cachedAt;

  bool get hasClockIn => clockedInAt != null;
  bool get hasClockOut => clockedOutAt != null;

  /// Can the employee clock in right now? Derived purely from the clock
  /// state — a signed-out snapshot never offers a clock action.
  bool get canClockIn => !signedOut && clockedInAt == null;

  /// Can the employee clock out right now?
  bool get canClockOut => !signedOut && hasClockIn && !hasClockOut;

  WidgetSnapshot copyWith({
    String? businessId,
    String? businessName,
    String? shiftLabel,
    String? shiftRange,
    DateTime? shiftStartAt,
    DateTime? shiftEndAt,
    DateTime? clockedInAt,
    DateTime? clockedOutAt,
    bool? signedOut,
    String? deviceId,
    double? geofenceDistanceM,
    String? failureMessage,
    bool? pendingSync,
    DateTime? cachedAt,
  }) {
    return WidgetSnapshot(
      businessId: businessId ?? this.businessId,
      businessName: businessName ?? this.businessName,
      shiftLabel: shiftLabel ?? this.shiftLabel,
      shiftRange: shiftRange ?? this.shiftRange,
      shiftStartAt: shiftStartAt ?? this.shiftStartAt,
      shiftEndAt: shiftEndAt ?? this.shiftEndAt,
      clockedInAt: clockedInAt ?? this.clockedInAt,
      clockedOutAt: clockedOutAt ?? this.clockedOutAt,
      signedOut: signedOut ?? this.signedOut,
      deviceId: deviceId ?? this.deviceId,
      geofenceDistanceM: geofenceDistanceM ?? this.geofenceDistanceM,
      failureMessage: failureMessage ?? this.failureMessage,
      pendingSync: pendingSync ?? this.pendingSync,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'businessId': businessId,
    'businessName': businessName,
    'shiftLabel': shiftLabel,
    'shiftRange': shiftRange,
    'shiftStartAt': shiftStartAt?.toIso8601String(),
    'shiftEndAt': shiftEndAt?.toIso8601String(),
    'clockedInAt': clockedInAt?.toIso8601String(),
    'clockedOutAt': clockedOutAt?.toIso8601String(),
    'signedOut': signedOut,
    'deviceId': deviceId,
    'geofenceDistanceM': geofenceDistanceM,
    'failureMessage': failureMessage,
    'pendingSync': pendingSync,
    'cachedAt': cachedAt.toIso8601String(),
  };

  factory WidgetSnapshot.fromJson(Map<String, dynamic> json) {
    DateTime? instant(String key) {
      final raw = json[key];
      return raw is String ? DateTime.tryParse(raw) : null;
    }

    return WidgetSnapshot(
      businessId: json['businessId'] as String?,
      businessName: json['businessName'] as String?,
      shiftLabel: json['shiftLabel'] as String?,
      shiftRange: json['shiftRange'] as String?,
      shiftStartAt: instant('shiftStartAt'),
      shiftEndAt: instant('shiftEndAt'),
      clockedInAt: instant('clockedInAt'),
      clockedOutAt: instant('clockedOutAt'),
      signedOut: json['signedOut'] as bool? ?? false,
      deviceId: json['deviceId'] as String?,
      geofenceDistanceM: (json['geofenceDistanceM'] as num?)?.toDouble(),
      failureMessage: json['failureMessage'] as String?,
      pendingSync: json['pendingSync'] as bool? ?? false,
      cachedAt: instant('cachedAt') ?? DateTime.now(),
    );
  }
}

/// Persists [WidgetSnapshot]s to the default SharedPreferences, shared with
/// the native widget provider. Every write bumps the `kk_widget_etag` counter
/// so consumers (and the widget renderer) can cheaply detect a newer snapshot.
abstract final class WidgetStore {
  static const snapshotKey = 'kk_widget_snapshot';
  static const etagKey = 'kk_widget_etag';

  /// Snapshots older than this read back as signed-out — a stale widget must
  /// never impersonate a live session.
  static const staleAfter = Duration(minutes: 30);

  static Future<SharedPreferences> _prefs() => SharedPreferences.getInstance();

  /// Persist [snapshot] and bump the etag counter. Best-effort: a missing
  /// platform channel or storage failure degrades to a no-op.
  static Future<void> saveSnapshot(WidgetSnapshot snapshot) async {
    try {
      final json = jsonEncode(snapshot.toJson());
      final prefs = await _prefs();
      await prefs.setString(snapshotKey, json);
      final etag = (prefs.getInt(etagKey) ?? 0) + 1;
      await prefs.setInt(etagKey, etag);
      // iOS: also publish into the App Group container so the widget
      // extension can read it without the app running (Android ignores this
      // copy — its provider reads the default prefs directly).
      await _publishToAppGroup(json);
    } catch (_) {
      // The widget is a convenience surface — never throw into the caller.
    }
  }

  /// Current etag counter, or 0 when nothing has been written yet.
  static Future<int> readEtag() async {
    try {
      return (await _prefs()).getInt(etagKey) ?? 0;
    } catch (_) {
      return 0;
    }
  }

  /// Read the cached snapshot. Returns `WidgetSnapshot.signedOut()` when:
  /// - nothing is stored,
  /// - the stored snapshot is stale (> [staleAfter] old),
  /// - the stored snapshot has no `businessId` (previous user / corrupted),
  /// - the stored snapshot was explicitly signed out.
  static Future<WidgetSnapshot> readSnapshot() async {
    try {
      final prefs = await _prefs();
      final raw = prefs.getString(snapshotKey);
      if (raw == null) return WidgetSnapshot.signedOut();
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return WidgetSnapshot.signedOut();
      final snapshot = WidgetSnapshot.fromJson(decoded);
      if (snapshot.signedOut || snapshot.businessId == null) {
        return WidgetSnapshot.signedOut();
      }
      if (DateTime.now().difference(snapshot.cachedAt) > staleAfter) {
        return WidgetSnapshot.signedOut();
      }
      return snapshot;
    } catch (_) {
      return WidgetSnapshot.signedOut();
    }
  }

  /// Wipe the snapshot to the signed-out state and bump the etag, so the
  /// widget flips to "Masuk KaryawanKu" immediately.
  static Future<void> markSignedOut() async {
    try {
      final json = jsonEncode(WidgetSnapshot.signedOut().toJson());
      final prefs = await _prefs();
      await prefs.setString(snapshotKey, json);
      final etag = (prefs.getInt(etagKey) ?? 0) + 1;
      await prefs.setInt(etagKey, etag);
      await _publishToAppGroup(json);
    } catch (_) {
      // Best-effort — same contract as [saveSnapshot].
    }
  }

  /// Publish the raw snapshot JSON into the iOS App Group UserDefaults via
  /// the home_widget plugin. Android's provider never reads this copy; on iOS
  /// it is the only channel the widget extension can reach. Fails silently
  /// when no App Group is configured.
  static Future<void> _publishToAppGroup(String json) async {
    try {
      await HomeWidget.saveWidgetData<String>(snapshotKey, json);
    } catch (_) {
      // No group id / entitlement / platform channel — iOS widget falls back
      // to its own cached entry.
    }
  }
}
