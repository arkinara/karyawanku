import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/biometric_providers.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/widget/widget_bridge.dart';
import 'package:karyawanku_mobile/core/widget/widget_state.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';

import 'helpers.dart';

Map<String, dynamic> recordJson({String? clockIn, String? clockOut}) => {
  'id': 'att-1',
  'employee_id': 'emp-1',
  'tanggal': '2026-09-03',
  'clock_in': clockIn,
  'clock_out': clockOut,
  'catatan': null,
  'status': 'hadir',
  'late_minutes': 0,
  'overtime_minutes': 0,
  'overtime_override_minutes': null,
  'submission_method': 'live',
  'time_drift_detected': false,
};

String date(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

Map<String, dynamic> assignmentJson(DateTime tanggal) => {
  'id': 'sa-1',
  'employee_id': 'emp-1',
  'employee_name': 'Siti Nurhaliza',
  'shift_id': 's-1',
  'shift': {
    'id': 's-1',
    'nama_shift': 'Pagi',
    'jam_mulai': '07:00',
    'jam_selesai': '15:00',
    'aktif': true,
  },
  'tanggal': date(tanggal),
  'published': true,
  'published_at': null,
  'published_by_user_id': null,
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  late InMemoryBackend backend;
  late SecureSessionStore store;
  late FakeWidgetBridge bridge;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
    bridge = FakeWidgetBridge();
  });

  ProviderContainer makeContainer(ApiClient client) {
    final container = ProviderContainer(
      overrides: [
        secureSessionStoreProvider.overrideWithValue(store),
        secureStorageBackendProvider.overrideWithValue(backend),
        apiClientProvider.overrideWithValue(client),
        signedInEmployeeOverride,
        onlineOverride(true),
        widgetBridgeProvider.overrideWithValue(bridge),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  test(
    'clockIn success writes the snapshot AND refreshes the widget',
    () async {
      var clockedIn = false;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/clock-in') {
          clockedIn = true;
          return jsonResponse({'record': recordJson()});
        }
        if (o.path == '/attendance/today') {
          return jsonResponse({
            'record': clockedIn
                ? recordJson(clockIn: '2026-09-03T00:58:00.000Z')
                : null,
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(client);

      await container.read(attendanceProvider.notifier).clockIn();

      expect(bridge.updateCount, 1);
      final snapshot = await WidgetStore.readSnapshot();
      expect(snapshot.signedOut, isFalse);
      expect(snapshot.hasClockIn, isTrue);
      expect(snapshot.deviceId, isNotEmpty);
    },
  );

  test('shift load writes the snapshot AND refreshes the widget', () async {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final client = buildTestClient(store, (o) async {
      if (o.path == '/shift-assignments/upcoming') {
        return jsonResponse({
          'assignments': [assignmentJson(tomorrow)],
        });
      }
      return jsonErrorResponse('nope', status: 404);
    });
    final container = makeContainer(client);

    await container.read(shiftProvider.notifier).loadUpcoming(days: 3);

    expect(bridge.updateCount, 1);
    final snapshot = await WidgetStore.readSnapshot();
    expect(snapshot.signedOut, isFalse);
    expect(snapshot.shiftLabel, 'Shift Pagi');
    expect(snapshot.shiftRange, '07:00 – 15:00');
  });
}
