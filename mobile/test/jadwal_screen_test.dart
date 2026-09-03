import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/format.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/jadwal/jadwal_screen.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';

import 'helpers.dart';

/// A [ShiftNotifier] that records which loads the screen triggered while
/// serving a fixed [ShiftState] — deterministic rendering + wiring in one.
class RecordingShift extends ShiftNotifier {
  RecordingShift(this.initial);
  final ShiftState initial;
  final List<String> calls = [];

  @override
  ShiftState build() => initial;

  @override
  Future<void> loadMonth(DateTime month) async => calls.add('month');

  @override
  Future<void> loadWeek(DateTime weekStart) async => calls.add('week');

  @override
  Future<void> loadUpcoming({int days = 3}) async {}

  @override
  Future<void> loadLeaveBlocks() async => calls.add('leave');

  @override
  void clearError() {}
}

DateTime keyOf(DateTime d) => DateTime(d.year, d.month, d.day);

/// Shifts into an error state when [loadMonth] runs, so the snackbar listener
/// observes a real state transition (a pre-set error would not fire it).
class ErroringShift extends ShiftNotifier {
  ErroringShift(this.initial);
  final ShiftState initial;

  @override
  ShiftState build() => initial;

  @override
  Future<void> loadMonth(DateTime month) async {
    state = const ShiftState(error: 'Server bermasalah');
  }

  @override
  Future<void> loadWeek(DateTime weekStart) async {}

  @override
  Future<void> loadUpcoming({int days = 3}) async {}

  @override
  Future<void> loadLeaveBlocks() async {}
}

Widget jadwal(ShiftState state, {ShiftNotifier? notifier}) {
  return ProviderScope(
    overrides: [
      signedInOverride,
      attendanceOverride(const AttendanceState()),
      if (notifier != null)
        shiftProvider.overrideWith(() => notifier)
      else
        shiftOverride(state),
    ],
    child: const MaterialApp(home: JadwalScreen()),
  );
}

void main() {
  testWidgets('loads the visible week, month and leave blocks on mount', (
    tester,
  ) async {
    final notifier = RecordingShift(const ShiftState());
    await tester.pumpWidget(jadwal(const ShiftState(), notifier: notifier));
    await tester.pumpAndSettle();

    expect(notifier.calls, contains('week'));
    expect(notifier.calls, contains('month'));
    expect(notifier.calls, contains('leave'));
  });

  testWidgets('a day with no assignment renders the rest-day state', (
    tester,
  ) async {
    await tester.pumpWidget(jadwal(const ShiftState()));
    await tester.pumpAndSettle();

    expect(find.text('Libur'), findsOneWidget);
    expect(find.textContaining('Tidak ada shift pada'), findsOneWidget);
    expect(find.text('Shift Pagi'), findsNothing);
  });

  testWidgets('a day with an assignment shows the shift from the server', (
    tester,
  ) async {
    final today = DateTime.now();
    final state = ShiftState(
      assignmentsByDate: {keyOf(today): testShiftAssignment(tanggal: today)},
    );
    await tester.pumpWidget(jadwal(state));
    await tester.pumpAndSettle();

    expect(find.text('Shift Pagi'), findsOneWidget);
    expect(find.text('07:00 – 15:00'), findsWidgets);
  });

  testWidgets('leave-blocked day renders the Cuti rest state', (tester) async {
    final today = DateTime.now();
    final state = ShiftState(leaveBlockedDates: {keyOf(today)});
    await tester.pumpWidget(jadwal(state));
    await tester.pumpAndSettle();

    expect(find.text('Cuti'), findsWidgets);
    expect(find.textContaining('Cuti pada'), findsOneWidget);
  });

  testWidgets('the month view shows the device-clock month and can page', (
    tester,
  ) async {
    final notifier = RecordingShift(const ShiftState());
    await tester.pumpWidget(jadwal(const ShiftState(), notifier: notifier));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Tampilan bulan'));
    await tester.pumpAndSettle();

    final now = DateTime.now();
    final month = DateTime(now.year, now.month);
    expect(
      find.text('${Fmt.monthNames[month.month - 1]} ${month.year}'),
      findsOneWidget,
    );

    final before = notifier.calls.where((c) => c == 'month').length;
    await tester.tap(find.byTooltip('Bulan berikutnya'));
    await tester.pumpAndSettle();

    final next = DateTime(now.year, now.month + 1);
    expect(
      find.text('${Fmt.monthNames[next.month - 1]} ${next.year}'),
      findsOneWidget,
    );
    // Paging triggered a fresh loadMonth for the newly displayed range.
    expect(
      notifier.calls.where((c) => c == 'month').length,
      greaterThan(before),
    );

    await tester.tap(find.byTooltip('Bulan sebelumnya'));
    await tester.pumpAndSettle();
    expect(
      find.text('${Fmt.monthNames[month.month - 1]} ${month.year}'),
      findsOneWidget,
    );
  });

  testWidgets('a range error surfaces as a snackbar and keeps the calendar', (
    tester,
  ) async {
    final notifier = ErroringShift(const ShiftState());
    await tester.pumpWidget(jadwal(const ShiftState(), notifier: notifier));
    await tester.pumpAndSettle();

    expect(find.text('Server bermasalah'), findsOneWidget);
    // The screen is not blanked — the rest-day state still renders.
    expect(find.text('Libur'), findsOneWidget);
  });
}
