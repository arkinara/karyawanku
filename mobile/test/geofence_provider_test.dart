import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/api/api_exception.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/location/location_service.dart';
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/data/repositories/geofence_repository.dart';
import 'package:karyawanku_mobile/features/absensi/geofence_provider.dart';

import 'helpers.dart';

/// A geofence repository whose failure behaviour can be flipped mid-test.
class _SequencedGeofenceRepo extends GeofenceRepository {
  _SequencedGeofenceRepo() : super(ApiClient.instance);

  bool fail = false;

  @override
  Future<Geofence> getGeofence(String businessId) async {
    if (fail) throw const NetworkException();
    return testGeofence();
  }
}

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

/// A client whose geofence endpoint returns [geofence], or 404 when null.
ApiClient geofenceClient(
  SecureSessionStore store,
  Map<String, dynamic>? geofence,
) {
  return buildTestClient(store, (o) async {
    if (o.path == '/businesses/b-1/geofence') {
      return geofence == null
          ? jsonErrorResponse('geofence belum diatur', status: 404)
          : jsonResponse(geofence);
    }
    return jsonErrorResponse('nope', status: 404);
  });
}

ProviderContainer makeContainer({
  required SecureSessionStore store,
  required ApiClient client,
  required LocationService service,
}) {
  final container = ProviderContainer(
    overrides: [
      secureSessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
      signedInEmployeeOverride,
      locationServiceProvider.overrideWithValue(service),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  late SecureSessionStore store;

  setUp(() {
    store = SecureSessionStore(backend: InMemoryBackend());
  });

  Map<String, dynamic> geofenceJson() => {
    'workLat': -6.2088,
    'workLng': 106.8456,
    'radiusMeters': 100,
  };

  group('refresh', () {
    test('acquires permission + service + fix and evaluates inside', () async {
      var positionCalls = 0;
      final service = buildService(
        positionFetcher: () async {
          positionCalls++;
          return testPosition();
        },
      );
      final container = makeContainer(
        store: store,
        client: geofenceClient(store, geofenceJson()),
        service: service,
      );
      final notifier = container.read(geofenceProvider.notifier);

      await notifier.refresh();

      final state = container.read(geofenceProvider);
      expect(positionCalls, 1);
      expect(state.permission, LocationPermissionStatus.granted);
      expect(state.service, LocationServiceStatus.enabled);
      expect(state.geofence, isNotNull);
      expect(state.status, GeofenceStatus.inside);
      expect(state.userLocation, isNotNull);
      expect(state.distanceMeters, 0);
      expect(state.acquiring, isFalse);
      expect(state.notice, isNull);
    });

    test('an off-site fix evaluates outside with a real distance', () async {
      final service = buildService(
        positionFetcher: () async =>
            testPosition(latitude: -6.2, longitude: 106.86),
      );
      final container = makeContainer(
        store: store,
        client: geofenceClient(store, geofenceJson()),
        service: service,
      );
      final notifier = container.read(geofenceProvider.notifier);

      await notifier.refresh();

      final state = container.read(geofenceProvider);
      expect(state.status, GeofenceStatus.outside);
      expect(state.distanceMeters, greaterThan(1000));
    });

    test(
      'a coarse fix evaluates lowAccuracy and reports the accuracy',
      () async {
        final service = buildService(
          positionFetcher: () async => testPosition(accuracy: 65),
        );
        final container = makeContainer(
          store: store,
          client: geofenceClient(store, geofenceJson()),
          service: service,
        );
        final notifier = container.read(geofenceProvider.notifier);

        await notifier.refresh();

        final state = container.read(geofenceProvider);
        expect(state.status, GeofenceStatus.lowAccuracy);
        expect(state.distanceMeters, 65);
      },
    );

    test(
      'a timed-out fix yields unknown and keeps clock-in unblocked',
      () async {
        final service = buildService(
          positionFetcher: () => Completer<Position>().future,
        );
        final container = makeContainer(
          store: store,
          client: geofenceClient(store, geofenceJson()),
          service: service,
        );
        final notifier = container.read(geofenceProvider.notifier);

        await notifier.refresh();

        final state = container.read(geofenceProvider);
        expect(state.status, GeofenceStatus.unknown);
        expect(state.userLocation, isNull);
        expect(state.acquiring, isFalse);
        expect(state.notice, isNull);
      },
    );

    test('service disabled surfaces a settings notice, not outside', () async {
      final service = buildService(serviceStatusChecker: () async => false);
      final container = makeContainer(
        store: store,
        client: geofenceClient(store, geofenceJson()),
        service: service,
      );
      final notifier = container.read(geofenceProvider.notifier);

      await notifier.refresh();

      final state = container.read(geofenceProvider);
      expect(state.service, LocationServiceStatus.disabled);
      expect(state.status, GeofenceStatus.unknown);
      expect(state.userLocation, isNull);
      expect(state.notice, GeofenceNotice.serviceDisabled);
    });

    test(
      'permission denied yields unknown without a settings notice',
      () async {
        final service = buildService(
          permissionFetcher: () async => PermissionStatus.denied,
        );
        final container = makeContainer(
          store: store,
          client: geofenceClient(store, geofenceJson()),
          service: service,
        );
        final notifier = container.read(geofenceProvider.notifier);

        await notifier.refresh();

        final state = container.read(geofenceProvider);
        expect(state.permission, LocationPermissionStatus.denied);
        expect(state.status, GeofenceStatus.unknown);
        expect(state.userLocation, isNull);
        expect(state.notice, isNull);
      },
    );

    test('permanently denied yields unknown; the notice comes from '
        'ensurePermission, not refresh (no duplicate snackbar)', () async {
      final service = buildService(
        permissionFetcher: () async => PermissionStatus.permanentlyDenied,
      );
      final container = makeContainer(
        store: store,
        client: geofenceClient(store, geofenceJson()),
        service: service,
      );
      final notifier = container.read(geofenceProvider.notifier);

      await notifier.refresh();

      final state = container.read(geofenceProvider);
      expect(state.status, GeofenceStatus.unknown);
      // The chip tap runs ensurePermission first, which sets the settings
      // notice; refresh merely verifies state so it does not re-arm it.
      expect(state.notice, isNull);
    });

    test(
      'falls back to the dev mock geofence when the endpoint 404s',
      () async {
        final service = buildService();
        final container = makeContainer(
          store: store,
          client: geofenceClient(store, null),
          service: service,
        );
        final notifier = container.read(geofenceProvider.notifier);

        await notifier.refresh();

        final state = container.read(geofenceProvider);
        expect(state.geofence, isNotNull);
        expect(state.geofence!.isMock, isTrue);
        // The mock point == the fix, so the chip reads on-site.
        expect(state.status, GeofenceStatus.inside);
      },
    );

    test('keeps the cached geofence when the config fetch fails', () async {
      final repo = _SequencedGeofenceRepo();
      final service = buildService();
      final container = ProviderContainer(
        overrides: [
          secureSessionStoreProvider.overrideWithValue(store),
          apiClientProvider.overrideWithValue(
            geofenceClient(store, geofenceJson()),
          ),
          signedInEmployeeOverride,
          locationServiceProvider.overrideWithValue(service),
          geofenceRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);
      final notifier = container.read(geofenceProvider.notifier);

      await notifier.refresh();
      expect(container.read(geofenceProvider).geofence, isNotNull);

      // The config fetch now fails; the chip must keep the cached point.
      repo.fail = true;
      await notifier.refresh();

      final state = container.read(geofenceProvider);
      expect(state.geofence, isNotNull);
      expect(state.status, GeofenceStatus.inside);
    });
  });

  group('ensurePermission', () {
    test('requests permission only when not already usable', () async {
      var requested = 0;
      final service = buildService(
        permissionFetcher: () async => PermissionStatus.denied,
        permissionRequester: () async {
          requested++;
          return PermissionStatus.granted;
        },
      );
      final container = makeContainer(
        store: store,
        client: geofenceClient(store, geofenceJson()),
        service: service,
      );
      final notifier = container.read(geofenceProvider.notifier);

      await notifier.ensurePermission();
      expect(requested, 1);
      expect(
        container.read(geofenceProvider).permission,
        LocationPermissionStatus.granted,
      );
    });

    test('does not re-prompt when already granted', () async {
      var requested = 0;
      final service = buildService(
        permissionFetcher: () async => PermissionStatus.granted,
        permissionRequester: () async {
          requested++;
          return PermissionStatus.granted;
        },
      );
      final container = makeContainer(
        store: store,
        client: geofenceClient(store, geofenceJson()),
        service: service,
      );
      final notifier = container.read(geofenceProvider.notifier);

      await notifier.ensurePermission();
      expect(requested, 0);
      expect(
        container.read(geofenceProvider).permission,
        LocationPermissionStatus.granted,
      );
    });

    test(
      'permanently denied sets the settings notice after requesting',
      () async {
        final service = buildService(
          permissionFetcher: () async => PermissionStatus.permanentlyDenied,
          permissionRequester: () async => PermissionStatus.permanentlyDenied,
        );
        final container = makeContainer(
          store: store,
          client: geofenceClient(store, geofenceJson()),
          service: service,
        );
        final notifier = container.read(geofenceProvider.notifier);

        await notifier.ensurePermission();
        expect(
          container.read(geofenceProvider).notice,
          GeofenceNotice.permanentlyDenied,
        );

        notifier.clearNotice();
        expect(container.read(geofenceProvider).notice, isNull);
      },
    );
  });

  group('evaluate (pure)', () {
    test('delegates the status decision to the service', () {
      final service = buildService();
      final container = makeContainer(
        store: store,
        client: geofenceClient(store, geofenceJson()),
        service: service,
      );
      final notifier = container.read(geofenceProvider.notifier);

      final status = notifier.evaluate(
        user: testPosition(),
        geofence: testGeofence(),
      );
      expect(status, GeofenceStatus.inside);
    });
  });
}
