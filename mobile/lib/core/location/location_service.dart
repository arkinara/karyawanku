import 'dart:async';

import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

/// Device permission for foreground location. Mirrors the platform's decision
/// at the point of use — never derived from what the app *expects* to have.
///
/// Stateful enum: `limited` (iOS approximate) and `granted` are both usable;
/// everything else means "cannot locate" and the caller falls back to a
/// no-coordinates clock-in.
enum LocationPermissionStatus {
  granted,
  denied,
  permanentlyDenied,
  restricted,
  limited;

  /// True when the OS allows the app to read a (possibly approximate) fix.
  bool get canLocate => this == granted || this == limited;
}

/// Whether the platform location service (GPS / location switch) is on. A
/// granted permission with the service off is reported as such — never as
/// "outside the area".
enum LocationServiceStatus { enabled, disabled }

/// Where the device sits relative to the business's work point. `unknown` is
/// an honest "we do not know" (permission denied, service off, no fix) — it
/// is never faked as inside or outside.
enum GeofenceStatus {
  inside,
  outside,
  unknown,
  lowAccuracy;

  bool get isKnown => this == inside || this == outside;
}

/// Injectable calls behind the plugin surface so tests can simulate the
/// platform channel (there is no emulator/simulator on CI). Defaults are the
/// real `geolocator` / `permission_handler` calls.
typedef PermissionStatusFetcher = Future<ph.PermissionStatus> Function();
typedef PositionFetcher = Future<Position> Function();
typedef ServiceStatusChecker = Future<bool> Function();

/// Foreground ("when in use") location for the Absensi geofence chip and for
/// attaching coordinates to clock-in. Only foreground location is ever asked
/// for — background location is out of scope.
///
/// Every acquisition goes through [getCurrentLocation] with a bounded timeout:
/// a slow fix returns null instead of blocking the clock-in button.
class LocationService {
  LocationService({
    PermissionStatusFetcher? permissionFetcher,
    PermissionStatusFetcher? permissionRequester,
    PositionFetcher? positionFetcher,
    ServiceStatusChecker? serviceStatusChecker,
  }) : _permissionFetcher = permissionFetcher ?? _defaultPermissionFetcher,
       _permissionRequester =
           permissionRequester ?? _defaultPermissionRequester,
       _positionFetcher = positionFetcher ?? _defaultPositionFetcher,
       _serviceStatusChecker =
           serviceStatusChecker ?? _defaultServiceStatusChecker;

  final PermissionStatusFetcher _permissionFetcher;
  final PermissionStatusFetcher _permissionRequester;
  final PositionFetcher _positionFetcher;
  final ServiceStatusChecker _serviceStatusChecker;

  /// A fix worse than this (or an absent/zero accuracy) is flagged
  /// `lowAccuracy` instead of being presented as confidently on-site.
  static const lowAccuracyMeters = 50.0;

  /// Read the current permission without prompting.
  Future<LocationPermissionStatus> checkPermission() async =>
      _mapPermission(await _permissionFetcher());

  /// Ask the user for foreground location. Returns the platform's decision.
  Future<LocationPermissionStatus> requestPermission() async =>
      _mapPermission(await _permissionRequester());

  /// True when the platform location service is on.
  Future<bool> isServiceEnabled() => _serviceStatusChecker();

  /// Acquire one fix, bounded by [timeout]. Returns null on timeout, on a
  /// disabled service, or on any other failure — never throws, so the clock-in
  /// flow can proceed with no coordinates.
  Future<Position?> getCurrentLocation({
    Duration timeout = const Duration(seconds: 8),
  }) async {
    try {
      return await _positionFetcher().timeout(timeout);
    } on TimeoutException {
      return null;
    } catch (_) {
      // LocationServiceDisabledException, PermissionDeniedException, a
      // MissingPluginException during tests, a dead GPS in a basement — all of
      // them degrade to "no fix" rather than a crash.
      return null;
    }
  }

  /// Pure geofence evaluation. Low accuracy always wins over distance: a 60 m
  /// fix is not trusted to say on-site or off-site.
  GeofenceStatus evaluate({
    required double workLat,
    required double workLng,
    required double radiusMeters,
    required Position user,
  }) {
    if (user.accuracy <= 0 || user.accuracy > lowAccuracyMeters) {
      return GeofenceStatus.lowAccuracy;
    }
    final distance = distanceBetween(
      workLat,
      workLng,
      user.latitude,
      user.longitude,
    );
    return distance <= radiusMeters
        ? GeofenceStatus.inside
        : GeofenceStatus.outside;
  }

  /// Haversine distance in metres — `geolocator.distanceBetween`, the same
  /// geodesic the server will use once #67 lands.
  double distanceBetween(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) {
    return Geolocator.distanceBetween(
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    );
  }

  /// System app settings — the way out of a permanent permission denial.
  Future<bool> openAppSettings() => ph.openAppSettings();

  /// System location settings — the way out of a disabled location service.
  Future<bool> openLocationSettings() => Geolocator.openLocationSettings();

  static Future<ph.PermissionStatus> _defaultPermissionFetcher() =>
      ph.Permission.location.status;

  static Future<ph.PermissionStatus> _defaultPermissionRequester() =>
      ph.Permission.location.request();

  static Future<Position> _defaultPositionFetcher() =>
      Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );

  static Future<bool> _defaultServiceStatusChecker() =>
      Geolocator.isLocationServiceEnabled();

  LocationPermissionStatus _mapPermission(ph.PermissionStatus status) =>
      switch (status) {
        ph.PermissionStatus.granted => LocationPermissionStatus.granted,
        ph.PermissionStatus.permanentlyDenied =>
          LocationPermissionStatus.permanentlyDenied,
        ph.PermissionStatus.restricted => LocationPermissionStatus.restricted,
        ph.PermissionStatus.limited => LocationPermissionStatus.limited,
        _ => LocationPermissionStatus.denied,
      };
}
