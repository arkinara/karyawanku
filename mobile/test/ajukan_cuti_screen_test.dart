import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/features/cuti/ajukan_cuti_screen.dart';
import 'package:karyawanku_mobile/features/cuti/leave_provider.dart';

import 'helpers.dart';

/// A [LeaveNotifier] seeded with server data whose [LeaveNotifier.submit] is
/// the real one — the form drives a real POST through the overridden
/// [ApiClient], exactly like production.
class SeededLeave extends LeaveNotifier {
  SeededLeave(this.seed);
  final LeaveState seed;

  @override
  LeaveState build() => seed;
}

LeaveState formSeed({int annualRemaining = 8, int annualTotal = 12}) =>
    LeaveState(
      balances: [
        LeaveBalance(
          label: 'Tahunan',
          remaining: annualRemaining,
          total: annualTotal,
          tahun: 2026,
        ),
        const LeaveBalance(label: 'Sakit', remaining: 10, total: 12, tahun: 2026),
        const LeaveBalance(label: 'Izin', remaining: 3, total: 4, tahun: 2026),
      ],
      leaveTypes: const [
        LeaveType(
          id: 'lt-1',
          nama: 'Tahunan',
          defaultKuotaHari: 12,
          kebijakanSisa: 'carry-over',
          carryOverMaxDays: 5,
          aktif: true,
        ),
        LeaveType(
          id: 'lt-2',
          nama: 'Sakit',
          defaultKuotaHari: 5,
          kebijakanSisa: 'hangus',
          aktif: true,
        ),
        LeaveType(
          id: 'lt-3',
          nama: 'Izin',
          defaultKuotaHari: 3,
          kebijakanSisa: 'hangus',
          aktif: true,
        ),
      ],
    );

Map<String, dynamic> requestJson({String id = 'lr-new'}) => {
  'id': id,
  'employee_id': 'emp-1',
  'employee_name': 'Siti Nurhaliza',
  'leave_type_id': 'lt-1',
  'leave_type_name': 'Tahunan',
  'tanggal_mulai': '2026-09-15',
  'tanggal_selesai': '2026-09-17',
  'alasan': 'Acara keluarga di Bandung',
  'status': 'pending',
  'approver_user_id': null,
  'catatan_approver': null,
  'created_at': '2026-09-13T00:00:00.000Z',
  'decided_at': null,
};

Map<String, dynamic> assignmentJson(String tanggal) => {
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
  'tanggal': tanggal,
  'published': true,
};

String dateStr(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// Pushes AjukanCutiScreen onto a host route so a successful submit pops back
/// to a visible screen instead of leaving an empty navigator.
Widget host(
  LeaveNotifier notifier,
  Future<ResponseBody> Function(RequestOptions) handler,
) {
  final store = SecureSessionStore(backend: InMemoryBackend());
  final client = buildTestClient(store, handler);
  return ProviderScope(
    overrides: [
      secureSessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
      signedInOverride,
      leaveProvider.overrideWith(() => notifier),
    ],
    child: MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AjukanCutiScreen()),
              ),
              child: const Text('buka form'),
            ),
          ),
        ),
      ),
    ),
  );
}

Future<void> openForm(WidgetTester tester) async {
  // Tall surface so every form field is built — ListView builds lazily.
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.tap(find.text('buka form'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders server leave types and the annual balance', (
    tester,
  ) async {
    final notifier = SeededLeave(formSeed());
    await tester.pumpWidget(
      host(notifier, (o) async => jsonResponse({'items': <Map<String, dynamic>>[]})),
    );
    await openForm(tester);

    // The form chips come from /leave-types.
    expect(find.text('Cuti Tahunan'), findsOneWidget);
    expect(find.text('Cuti Sakit'), findsOneWidget);
    expect(find.text('Cuti Izin'), findsOneWidget);

    // Annual balance header from /leave-balances, expiry included.
    expect(find.text('8'), findsOneWidget);
    expect(find.textContaining('berlaku s/d 31/12/2026'), findsOneWidget);

    // Impact line computed from the real balance and roster.
    expect(find.textContaining('sisa jadi 5 hari'), findsOneWidget);
  });

  testWidgets('submit posts to /leave-requests and shows success, then pops', (
    tester,
  ) async {
    Map<String, dynamic>? posted;
    final notifier = SeededLeave(formSeed());
    await tester.pumpWidget(
      host(notifier, (o) async {
        if (o.path == '/shift-assignments') {
          return jsonResponse({'items': <Map<String, dynamic>>[]});
        }
        if (o.path == '/leave-requests' && o.method == 'POST') {
          posted = o.data as Map<String, dynamic>;
          return jsonResponse({'request': requestJson()});
        }
        if (o.path == '/leave-requests' && o.method == 'GET') {
          return jsonResponse({
            'items': [requestJson()],
          });
        }
        return jsonErrorResponse('nope', status: 404);
      }),
    );
    await openForm(tester);

    await tester.tap(find.text('Kirim Pengajuan'));
    await tester.pumpAndSettle();

    expect(posted, isNotNull);
    expect(posted!['leave_type_id'], 'lt-1');
    final base = DateTime.now();
    final start = DateTime(base.year, base.month, base.day + 3);
    final end = DateTime(base.year, base.month, base.day + 5);
    expect(posted!['tanggal_mulai'], dateStr(start));
    expect(posted!['tanggal_selesai'], dateStr(end));
    expect(posted!['alasan'], 'Acara keluarga di Bandung');

    // Success: snackbar + the form popped back to the host.
    expect(find.text('Pengajuan terkirim'), findsOneWidget);
    expect(find.text('buka form'), findsOneWidget);
  });

  testWidgets('submit shows in-flight spinner and disables the form', (
    tester,
  ) async {
    final gate = Completer<void>();
    final notifier = SeededLeave(formSeed());
    await tester.pumpWidget(
      host(notifier, (o) async {
        if (o.path == '/shift-assignments') {
          return jsonResponse({'items': <Map<String, dynamic>>[]});
        }
        if (o.path == '/leave-requests' && o.method == 'POST') {
          await gate.future;
          return jsonResponse({'request': requestJson()});
        }
        if (o.path == '/leave-requests' && o.method == 'GET') {
          return jsonResponse({
            'items': [requestJson()],
          });
        }
        return jsonErrorResponse('nope', status: 404);
      }),
    );
    await openForm(tester);

    await tester.tap(find.text('Kirim Pengajuan'));
    await tester.pump();

    // Button swaps to a spinner and the submit label disappears.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Kirim Pengajuan'), findsNothing);

    gate.complete();
    await tester.pumpAndSettle();
    expect(find.text('Pengajuan terkirim'), findsOneWidget);
  });

  testWidgets('a server rejection surfaces the BE message and keeps the form', (
    tester,
  ) async {
    final notifier = SeededLeave(formSeed());
    await tester.pumpWidget(
      host(notifier, (o) async {
        if (o.path == '/shift-assignments') {
          return jsonResponse({'items': <Map<String, dynamic>>[]});
        }
        if (o.path == '/leave-requests' && o.method == 'POST') {
          return jsonErrorResponse(
            'Sisa kuota cuti tidak mencukupi (sisa 2 hari)',
            status: 422,
          );
        }
        return jsonErrorResponse('nope', status: 404);
      }),
    );
    await openForm(tester);

    await tester.tap(find.text('Kirim Pengajuan'));
    await tester.pumpAndSettle();

    expect(
      find.text('Sisa kuota cuti tidak mencukupi (sisa 2 hari)'),
      findsOneWidget,
    );
    expect(find.text('Pengajuan terkirim'), findsNothing);
    // No data loss: the form is still there with its input preserved.
    expect(find.text('Kirim Pengajuan'), findsOneWidget);
    expect(find.text('Acara keluarga di Bandung'), findsOneWidget);
    expect(find.text('buka form'), findsNothing);
  });

  testWidgets('impact preview warns when the request exceeds the balance', (
    tester,
  ) async {
    final notifier = SeededLeave(formSeed(annualRemaining: 2));
    await tester.pumpWidget(
      host(notifier, (o) async => jsonResponse({'items': <Map<String, dynamic>>[]})),
    );
    await openForm(tester);

    // Default range is 3 days > the 2 remaining → over-balance guard on.
    expect(find.textContaining('melebihi sisa Tahunan (2 hari)'), findsOneWidget);

    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Kirim Pengajuan'),
    );
    expect(button.onPressed, isNull);
  });

  testWidgets('conflict warning lists the overlapping shifts', (tester) async {
    final notifier = SeededLeave(formSeed(annualRemaining: 10));
    await tester.pumpWidget(
      host(notifier, (o) async {
        if (o.path == '/shift-assignments') {
          final start = o.queryParameters['start'] as String;
          return jsonResponse({
            'items': [assignmentJson(start)],
          });
        }
        return jsonErrorResponse('nope', status: 404);
      }),
    );
    await openForm(tester);

    expect(
      find.textContaining('bentrok dengan Shift Pagi'),
      findsOneWidget,
    );
    expect(find.textContaining('cari pengganti shift'), findsOneWidget);
  });
}