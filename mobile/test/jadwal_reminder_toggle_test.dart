import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/repositories/notification_prefs_repository.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/jadwal/jadwal_screen.dart';
import 'package:karyawanku_mobile/features/jadwal/notification_prefs_provider.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  Map<String, dynamic> prefsJson({bool enabled = true, int lead = 30}) => {
    'shift_reminders_enabled': enabled,
    'reminder_lead_minutes': lead,
  };

  Widget jadwal(Future<ResponseBody> Function(RequestOptions) handler) {
    final prefsRepo = NotificationPrefsRepository(
      buildTestClient(store, handler),
    );
    final today = DateTime.now();
    return ProviderScope(
      overrides: [
        signedInOverride,
        attendanceOverride(const AttendanceState()),
        shiftOverride(
          ShiftState(
            assignmentsByDate: {
              DateTime(today.year, today.month, today.day): testShiftAssignment(
                tanggal: today,
              ),
            },
          ),
        ),
        notificationPrefsRepositoryProvider.overrideWithValue(prefsRepo),
      ],
      child: const MaterialApp(home: JadwalScreen()),
    );
  }

  testWidgets(
    'toggle OFF → PATCH shift_reminders_enabled=false + subtitle updates',
    (tester) async {
      Map<String, dynamic>? patchBody;
      var getCount = 0;
      await tester.pumpWidget(
        jadwal((o) async {
          if (o.path == '/notification-prefs/me' && o.method == 'GET') {
            getCount++;
            return jsonResponse({'preferences': prefsJson()});
          }
          if (o.path == '/notification-prefs/me' && o.method == 'PATCH') {
            patchBody = o.data as Map<String, dynamic>;
            return jsonResponse({
              'preferences': prefsJson(
                enabled: patchBody!['shift_reminders_enabled'] as bool,
              ),
            });
          }
          return jsonErrorResponse('blocked', status: 503);
        }),
      );
      await tester.pumpAndSettle();

      expect(getCount, 1);
      expect(
        find.text('Pengingat 30 menit sebelum shift — aktif'),
        findsOneWidget,
      );

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();

      expect(patchBody, isNotNull);
      expect(patchBody!['shift_reminders_enabled'], isFalse);
      expect(find.text('Pengingat shift nonaktif'), findsOneWidget);
      expect(
        find.text('Pengingat 30 menit sebelum shift — aktif'),
        findsNothing,
      );
    },
  );

  testWidgets('PATCH lead 30 → Jadwal subtitle reflects the server value', (
    tester,
  ) async {
    Map<String, dynamic>? patchBody;
    await tester.pumpWidget(
      jadwal((o) async {
        if (o.path == '/notification-prefs/me' && o.method == 'GET') {
          return jsonResponse({'preferences': prefsJson(lead: 60)});
        }
        if (o.path == '/notification-prefs/me' && o.method == 'PATCH') {
          patchBody = o.data as Map<String, dynamic>;
          return jsonResponse({
            'preferences': prefsJson(
              lead: patchBody!['reminder_lead_minutes'] as int,
            ),
          });
        }
        return jsonErrorResponse('blocked', status: 503);
      }),
    );
    await tester.pumpAndSettle();

    // Server said 60 — the subtitle and the dropdown reflect it.
    expect(
      find.text('Pengingat 60 menit sebelum shift — aktif'),
      findsOneWidget,
    );

    await tester.tap(find.text('60 menit sebelum shift'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('30 menit sebelum shift').last);
    await tester.pumpAndSettle();

    expect(patchBody, isNotNull);
    expect(patchBody!['reminder_lead_minutes'], 30);
    expect(
      find.text('Pengingat 30 menit sebelum shift — aktif'),
      findsOneWidget,
    );
  });

  testWidgets(
    'load failure degrades to defaults without breaking the schedule',
    (tester) async {
      await tester.pumpWidget(
        jadwal((o) async => jsonErrorResponse('offline', status: 503)),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Pengingat 30 menit sebelum shift — aktif'),
        findsOneWidget,
      );
      expect(find.byType(Switch), findsOneWidget);
    },
  );
}
