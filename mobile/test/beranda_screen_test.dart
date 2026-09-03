import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/format.dart';
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/beranda/beranda_screen.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';

import 'helpers.dart';

Widget beranda(
  AttendanceState state, {
  ValueChanged<int>? onOpenTab,
  ShiftState shift = const ShiftState(),
}) {
  return ProviderScope(
    overrides: [
      signedInOverride,
      attendanceOverride(state),
      shiftOverride(shift),
    ],
    child: MaterialApp(home: Scaffold(body: BerandaScreen(onOpenTab: onOpenTab ?? (_) {}))),
  );
}

void main() {
  testWidgets('before clock-in the hero invites the action, not a stale duration', (
    tester,
  ) async {
    await tester.pumpWidget(beranda(const AttendanceState()));
    await tester.pumpAndSettle();

    expect(find.text('Belum Clock In'), findsWidgets);
    expect(find.text('Clock In'), findsOneWidget);
    // No fake duration may appear before a clock-in exists.
    expect(find.text('5j 43m'), findsNothing);
  });

  testWidgets('hero CTA opens the Absensi tab', (tester) async {
    int? opened;
    await tester.pumpWidget(beranda(const AttendanceState(), onOpenTab: (i) => opened = i));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Clock In'));
    expect(opened, 1);
  });

  testWidgets('on shift the hero shows live elapsed from the server clock-in', (
    tester,
  ) async {
    final clockIn = DateTime.now().subtract(const Duration(minutes: 343));
    final today = TodayAttendance(
      record: testAttendanceRecord(clockIn: clockIn),
    );

    await tester.pumpWidget(
      beranda(AttendanceState(today: today, loading: false)),
    );
    await tester.pumpAndSettle();

    expect(find.text('SEDANG BEKERJA'), findsOneWidget);
    expect(find.text('5j 43m'), findsOneWidget);
    expect(find.text('Belum Clock In'), findsNothing);
    expect(
      find.textContaining('Masuk ${Fmt.clock(clockIn)}'),
      findsOneWidget,
    );
  });

  testWidgets('clocked out hero shows the total between server times', (
    tester,
  ) async {
    final clockIn = DateTime.now().subtract(const Duration(hours: 6));
    final clockOut = DateTime.now().subtract(const Duration(minutes: 30));
    final today = TodayAttendance(
      record: testAttendanceRecord(clockIn: clockIn, clockOut: clockOut),
    );

    await tester.pumpWidget(
      beranda(AttendanceState(today: today, loading: false)),
    );
    await tester.pumpAndSettle();

    expect(find.text('SELESAI'), findsOneWidget);
    expect(find.text('5j 30m'), findsOneWidget);
    expect(find.text('Clock In'), findsNothing);
  });

  testWidgets('hero falls back to the invite when the load failed', (
    tester,
  ) async {
    await tester.pumpWidget(
      beranda(const AttendanceState(error: 'Server bermasalah')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Belum Clock In'), findsWidgets);
  });

  testWidgets('upcoming list is populated from getUpcoming()', (tester) async {
    final today = DateTime.now();
    final shift = ShiftState(
      upcoming: [
        testShiftAssignment(tanggal: today),
        testShiftAssignment(
          tanggal: today.add(const Duration(days: 1)),
          namaShift: 'Siang',
          jamMulai: '15:00',
          jamSelesai: '23:00',
        ),
      ],
    );

    await tester.pumpWidget(beranda(const AttendanceState(), shift: shift));
    await tester.pumpAndSettle();

    expect(find.text('Shift Pagi'), findsOneWidget);
    expect(find.text('Shift Siang'), findsOneWidget);
    expect(find.textContaining('07:00 – 15:00'), findsOneWidget);
    expect(find.textContaining('15:00 – 23:00'), findsOneWidget);
  });

  testWidgets('empty upcoming renders an explanatory empty state', (
    tester,
  ) async {
    await tester.pumpWidget(beranda(const AttendanceState()));
    await tester.pumpAndSettle();

    expect(find.text('Belum ada jadwal 3 hari ke depan.'), findsOneWidget);
    expect(find.text('Shift Pagi'), findsNothing);
  });

  testWidgets('loads the upcoming roster on mount', (tester) async {
    final notifier = _RecordingShift(const ShiftState());
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          signedInOverride,
          attendanceOverride(const AttendanceState()),
          shiftProvider.overrideWith(() => notifier),
        ],
        child: MaterialApp(
          home: Scaffold(body: BerandaScreen(onOpenTab: (_) {})),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(notifier.calls, contains('upcoming'));
  });
}

class _RecordingShift extends ShiftNotifier {
  _RecordingShift(this.initial);
  final ShiftState initial;
  final List<String> calls = [];

  @override
  ShiftState build() => initial;

  @override
  Future<void> loadMonth(DateTime month) async {}

  @override
  Future<void> loadWeek(DateTime weekStart) async {}

  @override
  Future<void> loadUpcoming({int days = 3}) async => calls.add('upcoming');

  @override
  Future<void> loadLeaveBlocks() async {}
}