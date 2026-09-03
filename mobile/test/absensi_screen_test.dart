import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/location/location_service.dart';
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/features/absensi/absensi_screen.dart';
import 'package:karyawanku_mobile/features/absensi/geofence_provider.dart';

import 'helpers.dart';

Map<String, dynamic> todayJson({
  String? clockIn,
  String? clockOut,
  int lateMinutes = 0,
  int overtimeMinutes = 0,
}) =>
    {
      'record': clockIn == null
          ? null
          : {
              'id': 'att-1',
              'employee_id': 'emp-1',
              'tanggal': '2026-09-03',
              'clock_in': clockIn,
              'clock_out': clockOut,
              'catatan': null,
              'status': 'hadir',
              'late_minutes': lateMinutes,
              'overtime_minutes': overtimeMinutes,
              'overtime_override_minutes': null,
              'submission_method': 'live',
              'time_drift_detected': false,
            },
    };

Map<String, dynamic> aggregateJson() => {
  'hadir': 21,
  'telat': 2,
  'absen': 0,
  'izin': 1,
  'total_late_minutes': 45,
  'total_overtime_minutes': 180,
};

Widget screen(
  SecureSessionStore store,
  ApiClient client, {
  GeofenceState? geofence,
}) {
  return testScope(
    store,
    client,
    extra: [
      signedInEmployeeOverride,
      geofenceOverride(geofence ?? const GeofenceState()),
    ],
    child: const MaterialApp(home: AbsensiScreen()),
  );
}

/// A geofence notifier whose state the test can flip after pump — lets the
/// widget test exercise the one-shot notice snackbars.
class _LiveGeofence extends GeofenceNotifier {
  _LiveGeofence(this.initial);

  GeofenceState initial;

  @override
  GeofenceState build() => initial;

  Future<void> setNotice(GeofenceNotice notice) async {
    initial = initial.copyWith(notice: notice);
    state = initial;
  }

  @override
  Future<void> ensurePermission() async {}

  @override
  Future<void> refresh() async {}

  @override
  GeofenceStatus evaluate({
    required Position user,
    required Geofence geofence,
  }) =>
      GeofenceStatus.inside;

  @override
  void clearNotice() {}
}

/// A geofence notifier that records chip taps (ensurePermission + refresh).
class _RecordingGeofence extends GeofenceNotifier {
  _RecordingGeofence(this.initial);

  final GeofenceState initial;
  int ensureCalls = 0;
  int refreshCalls = 0;

  @override
  GeofenceState build() => initial;

  @override
  Future<void> ensurePermission() async => ensureCalls++;

  @override
  Future<void> refresh() async => refreshCalls++;

  @override
  GeofenceStatus evaluate({
    required Position user,
    required Geofence geofence,
  }) =>
      GeofenceStatus.inside;

  @override
  void clearNotice() {}
}

/// The Absensi screen is a tall ListView; the timeline sits below the clock
/// card and would not be built in the default 800x600 test viewport.
void tallViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  testWidgets('shows a skeleton while today loads, then live state', (
    tester,
  ) async {
    tallViewport(tester);
    final gate = Completer<void>();
    final client = buildTestClient(store, (o) async {
      if (o.path == '/attendance/today') {
        await gate.future;
        return jsonResponse(todayJson(clockIn: '2026-09-03T00:58:00.000Z'));
      }
      return jsonResponse(aggregateJson());
    });

    await tester.pumpWidget(screen(store, client));
    await tester.pump();

    // Skeleton placeholders, never a blocking spinner or a stale timeline.
    expect(find.byKey(const ValueKey('attendance-loading')), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Clock In'), findsNothing);

    gate.complete();
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('attendance-loading')), findsNothing);
    // On shift now → the primary action is Clock Out, not Clock In.
    expect(find.text('Clock Out'), findsOneWidget);
    expect(find.text('Clock In'), findsNothing);
    expect(find.text('Masuk'), findsOneWidget);
  });

  testWidgets('load failure shows an error card and retry recovers', (
    tester,
  ) async {
    tallViewport(tester);
    var calls = 0;
    final client = buildTestClient(store, (o) async {
      if (o.path == '/attendance/today') {
        calls++;
        if (calls == 1) {
          return jsonErrorResponse('Server bermasalah', status: 500);
        }
        return jsonResponse(todayJson(clockIn: '2026-09-03T00:58:00.000Z'));
      }
      return jsonResponse(aggregateJson());
    });

    await tester.pumpWidget(screen(store, client));
    await tester.pumpAndSettle();

    // A failed load renders an error, never an empty timeline as "no activity".
    expect(find.text('Gagal memuat absensi'), findsOneWidget);
    expect(find.text('Server bermasalah'), findsOneWidget);
    expect(find.text('Coba lagi'), findsOneWidget);
    expect(find.text('Masuk'), findsNothing);

    await tester.tap(find.text('Coba lagi'));
    await tester.pumpAndSettle();

    expect(find.text('Gagal memuat absensi'), findsNothing);
    expect(find.text('Clock Out'), findsOneWidget);
  });

  testWidgets('clock-in posts, disables the button in flight, reconciles', (
    tester,
  ) async {
    tallViewport(tester);
    var clockedIn = false;
    final gate = Completer<void>();
    final client = buildTestClient(store, (o) async {
      if (o.path == '/attendance/clock-in') {
        await gate.future;
        clockedIn = true;
        return jsonResponse({'record': todayJson()});
      }
      if (o.path == '/attendance/today') {
        return jsonResponse(
          todayJson(
            clockIn: clockedIn ? '2026-09-03T00:58:00.000Z' : null,
          ),
        );
      }
      return jsonResponse(aggregateJson());
    });

    await tester.pumpWidget(screen(store, client));
    await tester.pumpAndSettle();

    expect(find.text('Clock In'), findsOneWidget);
    expect(find.text('Masuk'), findsOneWidget);
    // No record yet: the timeline shows --:-- for both events.
    expect(find.text('--:--'), findsNWidgets(2));

    await tester.tap(find.text('Clock In'));
    await tester.pump();

    // Disabled + spinner while the write is in flight.
    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull);
    expect(find.text('Memproses…'), findsOneWidget);

    gate.complete();
    await tester.pumpAndSettle();

    // Success refetches today's record: button flips to Clock Out.
    expect(find.text('Clock Out'), findsOneWidget);
    expect(find.text('Clock In'), findsNothing);
    expect(find.text('Memproses…'), findsNothing);
  });

  testWidgets('a closed day hides the primary action', (tester) async {
    tallViewport(tester);
    final client = buildTestClient(store, (o) async {
      if (o.path == '/attendance/today') {
        return jsonResponse(
          todayJson(
            clockIn: '2026-09-03T00:58:00.000Z',
            clockOut: '2026-09-03T07:00:00.000Z',
          ),
        );
      }
      return jsonResponse(aggregateJson());
    });

    await tester.pumpWidget(screen(store, client));
    await tester.pumpAndSettle();

    expect(find.text('Clock In'), findsNothing);
    expect(find.text('Clock Out'), findsNothing);
    expect(find.text('Absensi hari ini sudah lengkap'), findsOneWidget);
  });

  testWidgets('late and overtime render verbatim from the server', (
    tester,
  ) async {
    tallViewport(tester);
    final client = buildTestClient(store, (o) async {
      if (o.path == '/attendance/today') {
        return jsonResponse(
          todayJson(
            clockIn: '2026-09-03T00:58:00.000Z',
            clockOut: '2026-09-03T07:00:00.000Z',
            lateMinutes: 15,
            overtimeMinutes: 90,
          ),
        );
      }
      return jsonResponse(aggregateJson());
    });

    await tester.pumpWidget(screen(store, client));
    await tester.pumpAndSettle();

    // Shown twice: as chips in the clock card and as timeline notes.
    expect(find.text('Telat 15 mnt'), findsWidgets);
    expect(find.text('Lembur 1j 30m'), findsWidgets);
  });

  group('geofence chip', () {
    ApiClient todayClient() => buildTestClient(store, (o) async {
      if (o.path == '/attendance/today') {
        return jsonResponse(todayJson());
      }
      return jsonResponse(aggregateJson());
    });

    testWidgets('inside: green chip with distance', (tester) async {
      tallViewport(tester);
      await tester.pumpWidget(
        screen(store, todayClient(), geofence: sampleGeofenceInside(distance: 0)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Di dalam area · 0m'), findsOneWidget);
      expect(find.byIcon(LucideIcons.mapPinCheck), findsOneWidget);
    });

    testWidgets('outside: red chip with distance', (tester) async {
      tallViewport(tester);
      await tester.pumpWidget(
        screen(store, todayClient(), geofence: sampleGeofenceOutside(distance: 25)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Di luar area · 25m'), findsOneWidget);
      expect(find.byIcon(LucideIcons.mapPinOff), findsOneWidget);
    });

    testWidgets('unknown: grey chip, honest "do not know"', (tester) async {
      tallViewport(tester);
      await tester.pumpWidget(
        screen(store, todayClient(), geofence: sampleGeofenceUnknown()),
      );
      await tester.pumpAndSettle();

      expect(find.text('Lokasi tidak tersedia'), findsOneWidget);
      expect(find.byIcon(LucideIcons.mapPinX), findsOneWidget);
    });

    testWidgets('low accuracy: amber chip with the accuracy', (tester) async {
      tallViewport(tester);
      await tester.pumpWidget(
        screen(store, todayClient(), geofence: sampleGeofenceLowAccuracy()),
      );
      await tester.pumpAndSettle();

      expect(find.text('Akurasi rendah · 65m'), findsOneWidget);
      expect(find.byIcon(LucideIcons.mapPinMinus), findsOneWidget);
    });

    testWidgets('acquiring: spinner instead of a stale verdict', (tester) async {
      tallViewport(tester);
      await tester.pumpWidget(
        screen(store, todayClient(), geofence: sampleGeofenceAcquiring()),
      );
      // Attendance loads on a post-frame callback; pump past the skeleton
      // without pumpAndSettle (the chip spinner animates forever).
      for (
        var i = 0;
        i < 20 && tester.any(find.text('Mencari lokasi…')) == false;
        i++
      ) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      expect(find.text('Mencari lokasi…'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      // The clock-in button stays enabled while the fix is slow.
      final button = tester.widget<FilledButton>(find.byType(FilledButton));
      expect(button.onPressed, isNotNull);
    });

    testWidgets('tapping the chip re-runs ensurePermission + refresh', (
      tester,
    ) async {
      tallViewport(tester);
      final geofence = _RecordingGeofence(const GeofenceState());
      await tester.pumpWidget(
        testScope(
          store,
          todayClient(),
          extra: [
            signedInEmployeeOverride,
            geofenceProvider.overrideWith(() => geofence),
          ],
          child: const MaterialApp(home: AbsensiScreen()),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Geofence'));
      await tester.pumpAndSettle();

      expect(geofence.ensureCalls, 1);
      expect(geofence.refreshCalls, 1);
    });

    testWidgets('disabled service surfaces the settings snackbar', (
      tester,
    ) async {
      tallViewport(tester);
      final geofence = _LiveGeofence(const GeofenceState());
      await tester.pumpWidget(
        testScope(
          store,
          todayClient(),
          extra: [
            signedInEmployeeOverride,
            geofenceProvider.overrideWith(() => geofence),
          ],
          child: const MaterialApp(home: AbsensiScreen()),
        ),
      );
      await tester.pumpAndSettle();

      await geofence.setNotice(GeofenceNotice.serviceDisabled);
      await tester.pumpAndSettle();

      expect(
        find.text('Aktifkan layanan lokasi di pengaturan perangkat'),
        findsOneWidget,
      );
      expect(find.text('Buka'), findsOneWidget);
    });

    testWidgets('permanently denied surfaces the app-settings snackbar', (
      tester,
    ) async {
      tallViewport(tester);
      final geofence = _LiveGeofence(const GeofenceState());
      await tester.pumpWidget(
        testScope(
          store,
          todayClient(),
          extra: [
            signedInEmployeeOverride,
            geofenceProvider.overrideWith(() => geofence),
          ],
          child: const MaterialApp(home: AbsensiScreen()),
        ),
      );
      await tester.pumpAndSettle();

      await geofence.setNotice(GeofenceNotice.permanentlyDenied);
      await tester.pumpAndSettle();

      expect(
        find.text('Lokasi tidak diizinkan. Aktifkan di Pengaturan.'),
        findsOneWidget,
      );
      expect(find.text('Pengaturan'), findsOneWidget);
    });
  });
}