import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/cuti/cuti_screen.dart';
import 'package:karyawanku_mobile/features/cuti/leave_provider.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';
import 'package:karyawanku_mobile/widgets/common.dart';

import 'helpers.dart';

/// A [LeaveNotifier] that records the loads the screen triggered while serving
/// a fixed [LeaveState] — deterministic rendering + wiring in one.
class RecordingLeave extends LeaveNotifier {
  RecordingLeave(this.initial);
  final LeaveState initial;
  int loadAllCalls = 0;

  @override
  LeaveState build() => initial;

  @override
  Future<void> loadAll() async {
    loadAllCalls++;
  }

  @override
  Future<void> submit({
    required String leaveTypeId,
    required DateTime tanggalMulai,
    required DateTime tanggalSelesai,
    required String alasan,
  }) async {}

  @override
  void clearActionError() {}
}

Widget cuti(LeaveState state) {
  return ProviderScope(
    overrides: [
      signedInOverride,
      attendanceOverride(const AttendanceState()),
      shiftOverride(const ShiftState()),
      leaveOverride(state),
    ],
    child: const MaterialApp(home: CutiScreen()),
  );
}

void main() {
  testWidgets('loads balances, requests and leave types on mount', (
    tester,
  ) async {
    final notifier = RecordingLeave(const LeaveState());
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          signedInOverride,
          attendanceOverride(const AttendanceState()),
          shiftOverride(const ShiftState()),
          leaveProvider.overrideWith(() => notifier),
        ],
        child: const MaterialApp(home: CutiScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(notifier.loadAllCalls, 1);
  });

  testWidgets('renders the real balances and request history', (tester) async {
    // Tall surface so every request card is built — ListView builds lazily.
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(cuti(sampleLeaveState()));
    await tester.pumpAndSettle();

    // Balance tiles from the server.
    expect(find.text('Tahunan'), findsOneWidget);
    expect(find.text('Sakit'), findsOneWidget);
    expect(find.text('Izin'), findsOneWidget);
    expect(find.text('dari 12 hari'), findsNWidgets(2));

    // Request history — server type names + statuses.
    expect(find.text('Cuti Tahunan'), findsOneWidget);
    expect(find.text('Cuti Sakit'), findsOneWidget);
    expect(find.text('Cuti Izin'), findsOneWidget);
    expect(find.text('Menunggu'), findsWidgets);
    expect(find.text('Disetujui'), findsOneWidget);
    expect(find.text('Ditolak'), findsOneWidget);
  });

  testWidgets('status filter shows only matching requests', (tester) async {
    await tester.pumpWidget(cuti(sampleLeaveState()));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ToneChip, 'Menunggu'));
    await tester.pumpAndSettle();

    expect(find.text('Cuti Tahunan'), findsOneWidget);
    expect(find.text('Cuti Sakit'), findsNothing);
    expect(find.text('Cuti Izin'), findsNothing);

    await tester.tap(find.widgetWithText(ToneChip, 'Selesai'));
    await tester.pumpAndSettle();

    expect(find.text('Cuti Tahunan'), findsNothing);
    expect(find.text('Cuti Sakit'), findsOneWidget);
    expect(find.text('Cuti Izin'), findsOneWidget);
  });

  testWidgets('a filter with no matches keeps the empty state', (tester) async {
    final onlyPending = LeaveState(
      requests: [
        LeaveRequest(
          id: 'r-1',
          leaveTypeName: 'Tahunan',
          status: LeaveStatus.menunggu,
          start: DateTime(2026, 9, 15),
          end: DateTime(2026, 9, 17),
          days: 3,
          reason: 'Acara keluarga di Bandung',
        ),
      ],
    );
    await tester.pumpWidget(cuti(onlyPending));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ToneChip, 'Selesai'));
    await tester.pumpAndSettle();

    expect(find.text('Belum ada pengajuan "Selesai"'), findsOneWidget);
  });

  testWidgets('decision note comes from the server data', (tester) async {
    final state = LeaveState(
      requests: [
        LeaveRequest(
          id: 'r-1',
          leaveTypeName: 'Izin',
          status: LeaveStatus.ditolak,
          start: DateTime(2026, 7, 28),
          end: DateTime(2026, 7, 28),
          days: 1,
          reason: 'Keperluan pribadi',
          decisionNote: 'Shift sedang kekurangan orang, ajukan minggu depan.',
        ),
      ],
    );
    await tester.pumpWidget(cuti(state));
    await tester.pumpAndSettle();

    expect(
      find.text('Shift sedang kekurangan orang, ajukan minggu depan.'),
      findsOneWidget,
    );
    // The hardcoded placeholder is gone.
    expect(find.textContaining('menunggu Pak Darmawan'), findsNothing);
  });

  testWidgets('a load failure shows retry, never zero balances as fact', (
    tester,
  ) async {
    final notifier = RecordingLeave(
      const LeaveState(error: 'Server bermasalah'),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          signedInOverride,
          attendanceOverride(const AttendanceState()),
          shiftOverride(const ShiftState()),
          leaveProvider.overrideWith(() => notifier),
        ],
        child: const MaterialApp(home: CutiScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Server bermasalah'), findsOneWidget);
    expect(find.text('Coba lagi'), findsOneWidget);

    await tester.tap(find.text('Coba lagi'));
    await tester.pumpAndSettle();

    expect(notifier.loadAllCalls, 2);
  });
}
