import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/location/location_service.dart';
import '../../data/models.dart';
import '../../data/repositories/geofence_repository.dart';

/// Single [LocationService] shared by the notifier and by tests.
final locationServiceProvider = Provider<LocationService>(
  (ref) => LocationService(),
);

/// Single [GeofenceRepository] shared by the notifier and by tests.
final geofenceRepositoryProvider = Provider<GeofenceRepository>(
  (ref) => GeofenceRepository(ref.watch(apiClientProvider)),
);

/// One-shot reason the geofence state needs a settings detour. Surfaced as a
/// snackbar with a settings button — never a second futile re-prompt.
enum GeofenceNotice {
  permanentlyDenied,
  serviceDisabled,
}

/// Live geofence state for the Absensi chip. `status` is [GeofenceStatus]:
/// inside / outside / unknown / lowAccuracy. `unknown` is an honest "we do not
/// know" (permission denied, service off, no fix) — never faked on either side
/// of the boundary.
@immutable
class GeofenceState {
  const GeofenceState({
    this.permission = LocationPermissionStatus.denied,
    this.service = LocationServiceStatus.disabled,
    this.userLocation,
    this.geofence,
    this.status = GeofenceStatus.unknown,
    this.distanceMeters,
    this.acquiring = false,
    this.notice,
  });

  final LocationPermissionStatus permission;
  final LocationServiceStatus service;

  /// The latest acquired fix, or null. Clock-in attaches its lat/lng/accuracy
  /// to the payload when present; null means "no coordinates available" and
  /// the BE accepts null.
  final Position? userLocation;

  /// The work-area point this fix is measured against (mock in dev, real once
  /// #67 lands).
  final Geofence? geofence;

  final GeofenceStatus status;

  /// Display metres: distance to the work point for inside/outside, the fix
  /// accuracy for lowAccuracy, null for unknown.
  final int? distanceMeters;

  /// True while a fix is being acquired — the chip shows a progress spinner
  /// and the clock-in button stays enabled.
  final bool acquiring;

  /// One-shot reason for a settings snackbar; consumed by the screen.
  final GeofenceNotice? notice;

  GeofenceState copyWith({
    LocationPermissionStatus? permission,
    LocationServiceStatus? service,
    Position? userLocation,
    Geofence? geofence,
    GeofenceStatus? status,
    int? distanceMeters,
    bool? acquiring,
    GeofenceNotice? notice,
    bool clearNotice = false,
    bool clearLocation = false,
  }) {
    return GeofenceState(
      permission: permission ?? this.permission,
      service: service ?? this.service,
      userLocation: clearLocation ? null : userLocation ?? this.userLocation,
      geofence: geofence ?? this.geofence,
      status: status ?? this.status,
      distanceMeters: distanceMeters ?? this.distanceMeters,
      acquiring: acquiring ?? this.acquiring,
      notice: clearNotice ? null : notice ?? this.notice,
    );
  }
}

final geofenceProvider =
    NotifierProvider<GeofenceNotifier, GeofenceState>(GeofenceNotifier.new);

/// Owns permission, service and the latest fix, and evaluates the chip state.
///
/// Permission is requested only at the point of use — the chip's tap runs
/// [ensurePermission] + [refresh]. Nothing here prompts on app launch.
class GeofenceNotifier extends Notifier<GeofenceState> {
  LocationService get _service => ref.read(locationServiceProvider);
  GeofenceRepository get _repo => ref.read(geofenceRepositoryProvider);
  String? get _businessId => ref.read(authProvider).user?.businessId;

  @override
  GeofenceState build() => const GeofenceState();

  /// Check the permission, requesting it only when not already usable.
  /// Permanently-denied sets a one-shot [GeofenceNotice.permanentlyDenied] so
  /// the screen can route the user to system settings instead of re-prompting.
  Future<void> ensurePermission() async {
    final current = await _service.checkPermission();
    if (current.canLocate) {
      state = state.copyWith(permission: current);
      return;
    }
    final requested = await _service.requestPermission();
    state = state.copyWith(
      permission: requested,
      notice: requested == LocationPermissionStatus.permanentlyDenied
          ? GeofenceNotice.permanentlyDenied
          : null,
    );
  }

  /// Re-fetch the geofence config (falling back to the cached one), then
  /// check service + permission, acquire a fix and evaluate. A slow fix shows
  /// `acquiring` on the chip but never blocks anything else.
  Future<void> refresh() async {
    state = state.copyWith(acquiring: true);
    try {
      var geofence = state.geofence;
      final businessId = _businessId;
      if (businessId != null) {
        try {
          geofence = await _repo.getGeofence(businessId);
        } catch (_) {
          // A failed config fetch keeps the cached one — the chip is never
          // blanked by a network hiccup.
        }
      }

      final permission = await _service.checkPermission();
      final serviceEnabled = await _service.isServiceEnabled();
      final service = serviceEnabled
          ? LocationServiceStatus.enabled
          : LocationServiceStatus.disabled;

      if (!serviceEnabled) {
        state = state.copyWith(
          permission: permission,
          service: service,
          geofence: geofence,
          status: GeofenceStatus.unknown,
          clearLocation: true,
          distanceMeters: null,
          notice: GeofenceNotice.serviceDisabled,
        );
        return;
      }

      if (!permission.canLocate) {
        state = state.copyWith(
          permission: permission,
          service: service,
          geofence: geofence,
          status: GeofenceStatus.unknown,
          clearLocation: true,
          distanceMeters: null,
        );
        return;
      }

      final location = await _service.getCurrentLocation();
      if (location == null) {
        // Timeout, dead GPS, basement — no fix, but clock-in still works and
        // sends null coordinates.
        state = state.copyWith(
          permission: permission,
          service: service,
          geofence: geofence,
          status: GeofenceStatus.unknown,
          clearLocation: true,
          distanceMeters: null,
        );
        return;
      }

      if (geofence == null) {
        state = state.copyWith(
          permission: permission,
          service: service,
          userLocation: location,
          status: GeofenceStatus.unknown,
          distanceMeters: null,
        );
        return;
      }

      final status = evaluate(user: location, geofence: geofence);
      state = state.copyWith(
        permission: permission,
        service: service,
        geofence: geofence,
        userLocation: location,
        status: status,
        distanceMeters: _displayMeters(status, location, geofence),
      );
    } finally {
      if (state.acquiring) state = state.copyWith(acquiring: false);
    }
  }

  /// Pure evaluation: a user fix against a geofence config → status.
  GeofenceStatus evaluate({required Position user, required Geofence geofence}) {
    return _service.evaluate(
      workLat: geofence.workLat,
      workLng: geofence.workLng,
      radiusMeters: geofence.radiusMeters,
      user: user,
    );
  }

  int? _displayMeters(
    GeofenceStatus status,
    Position user,
    Geofence geofence,
  ) {
    switch (status) {
      case GeofenceStatus.lowAccuracy:
        return user.accuracy <= 0 ? null : user.accuracy.round();
      case GeofenceStatus.inside:
      case GeofenceStatus.outside:
        return _service
            .distanceBetween(
              geofence.workLat,
              geofence.workLng,
              user.latitude,
              user.longitude,
            )
            .round();
      case GeofenceStatus.unknown:
        return null;
    }
  }

  /// Consume the one-shot notice after the screen surfaced it.
  void clearNotice() {
    if (state.notice != null) state = state.copyWith(clearNotice: true);
  }
}