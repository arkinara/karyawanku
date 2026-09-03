import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:karyawanku_mobile/core/location/location_service.dart';

import 'helpers.dart';

LocationService buildService({
  Future<PermissionStatus> Function()? permissionFetcher,
  Future<PermissionStatus> Function()? permissionRequester,
  Future<Position> Function()? positionFetcher,
  Future<bool> Function()? serviceStatusChecker,
}) {
  return LocationService(
    permissionFetcher:
        permissionFetcher ?? () async => PermissionStatus.granted,
    permissionRequester:
        permissionRequester ?? () async => PermissionStatus.granted,
    positionFetcher: positionFetcher ?? () async => testPosition(),
    serviceStatusChecker: serviceStatusChecker ?? () async => true,
  );
}

void main() {
  group('permission mapping', () {
    test('granted maps to granted', () async {
      final s = buildService(
        permissionFetcher: () async => PermissionStatus.granted,
      );
      expect(await s.checkPermission(), LocationPermissionStatus.granted);
    });

    test('denied maps to denied', () async {
      final s = buildService(
        permissionFetcher: () async => PermissionStatus.denied,
      );
      expect(await s.checkPermission(), LocationPermissionStatus.denied);
    });

    test('permanentlyDenied maps and is not re-promptable', () async {
      final s = buildService(
        permissionFetcher: () async => PermissionStatus.permanentlyDenied,
      );
      final status = await s.checkPermission();
      expect(status, LocationPermissionStatus.permanentlyDenied);
      expect(status.canLocate, isFalse);
    });

    test('iOS restricted and limited map distinctly', () async {
      final restricted = buildService(
        permissionFetcher: () async => PermissionStatus.restricted,
      );
      final limited = buildService(
        permissionFetcher: () async => PermissionStatus.limited,
      );
      expect(
        await restricted.checkPermission(),
        LocationPermissionStatus.restricted,
      );
      expect(await limited.checkPermission(), LocationPermissionStatus.limited);
    });

    test('limited counts as usable (approximate fix)', () async {
      final limited = buildService(
        permissionFetcher: () async => PermissionStatus.limited,
      );
      expect((await limited.checkPermission()).canLocate, isTrue);
    });

    test('requestPermission returns the platform decision', () async {
      final s = buildService(
        permissionRequester: () async => PermissionStatus.permanentlyDenied,
      );
      expect(
        await s.requestPermission(),
        LocationPermissionStatus.permanentlyDenied,
      );
    });
  });

  group('isServiceEnabled', () {
    test('reports enabled and disabled', () async {
      final on = buildService(serviceStatusChecker: () async => true);
      final off = buildService(serviceStatusChecker: () async => false);
      expect(await on.isServiceEnabled(), isTrue);
      expect(await off.isServiceEnabled(), isFalse);
    });
  });

  group('getCurrentLocation', () {
    test('returns a fix when acquisition succeeds', () async {
      final s = buildService(
        positionFetcher: () async => testPosition(latitude: -6.2),
      );
      final p = await s.getCurrentLocation();
      expect(p, isNotNull);
      expect(p!.latitude, -6.2);
    });

    test('returns null when the fix times out (slow GPS)', () async {
      final s = buildService(
        positionFetcher: () => Completer<Position>().future,
      );
      final p = await s.getCurrentLocation(
        timeout: const Duration(milliseconds: 30),
      );
      expect(p, isNull);
    });

    test('returns null when the fetcher throws (no crash)', () async {
      final s = buildService(
        positionFetcher: () async => throw StateError('no gps in basement'),
      );
      expect(await s.getCurrentLocation(), isNull);
    });
  });

  group('evaluate', () {
    final geofence = testGeofence();

    test('inside when within radius at an accurate fix', () {
      final s = buildService();
      final onSite = testPosition();
      expect(
        s.evaluate(
          workLat: geofence.workLat,
          workLng: geofence.workLng,
          radiusMeters: geofence.radiusMeters,
          user: onSite,
        ),
        GeofenceStatus.inside,
      );
    });

    test('outside when beyond the radius', () {
      final s = buildService();
      final offSite = testPosition(latitude: -6.2, longitude: 106.86);
      expect(
        s.evaluate(
          workLat: geofence.workLat,
          workLng: geofence.workLng,
          radiusMeters: geofence.radiusMeters,
          user: offSite,
        ),
        GeofenceStatus.outside,
      );
    });

    test('lowAccuracy when the fix is coarse (>50m)', () {
      final s = buildService();
      final coarse = testPosition(accuracy: 65);
      expect(
        s.evaluate(
          workLat: geofence.workLat,
          workLng: geofence.workLng,
          radiusMeters: geofence.radiusMeters,
          user: coarse,
        ),
        GeofenceStatus.lowAccuracy,
      );
    });

    test('lowAccuracy when accuracy is zero (unknown)', () {
      final s = buildService();
      final unknown = testPosition(accuracy: 0);
      expect(
        s.evaluate(
          workLat: geofence.workLat,
          workLng: geofence.workLng,
          radiusMeters: geofence.radiusMeters,
          user: unknown,
        ),
        GeofenceStatus.lowAccuracy,
      );
    });

    test('lowAccuracy beats inside: a coarse on-site fix is not trusted', () {
      final s = buildService();
      final onSiteButCoarse = testPosition(accuracy: 60);
      expect(
        s.evaluate(
          workLat: geofence.workLat,
          workLng: geofence.workLng,
          radiusMeters: geofence.radiusMeters,
          user: onSiteButCoarse,
        ),
        GeofenceStatus.lowAccuracy,
      );
    });
  });
}
