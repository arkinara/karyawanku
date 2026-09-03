import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/features/slip/payslip_provider.dart';
import 'package:karyawanku_mobile/features/slip/slip_detail_screen.dart';
import 'package:karyawanku_mobile/features/slip/slip_gaji_screen.dart';

import 'helpers.dart';

Widget slipGaji(PayslipState state) {
  return ProviderScope(
    overrides: [
      signedInOverride,
      payslipOverride(state),
    ],
    child: const MaterialApp(home: SlipGajiScreen()),
  );
}

void main() {
  // The list renders hero + history inside a lazy ListView; a tall surface
  // keeps every row built so find.text can see them all.
  void tallView(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  testWidgets('renders the hero from the latest payslip and history from the list', (
    tester,
  ) async {
    tallView(tester);
    await tester.pumpWidget(slipGaji(samplePayslipState()));
    await tester.pumpAndSettle();

    // Hero: newest payslip promoted to the tonal card.
    expect(find.text('Terbaru · Agustus 2026'), findsOneWidget);
    expect(find.text('Rp 4.235.000'), findsOneWidget);

    // History rows: the rest of the server list.
    expect(find.text('Juli 2026'), findsOneWidget);
    expect(find.text('Maret 2026'), findsOneWidget);
    expect(find.text('Desember 2025'), findsOneWidget);
    // The THR row is flagged from the server, shown with a badge.
    expect(find.textContaining('THR'), findsOneWidget);
  });

  testWidgets('year chips are derived from the years present in the data', (
    tester,
  ) async {
    tallView(tester);
    await tester.pumpWidget(slipGaji(samplePayslipState()));
    await tester.pumpAndSettle();

    // 2026 (three rows) and 2025 (one row) — never a hardcoded pair.
    expect(find.text('Semua'), findsOneWidget);
    expect(find.text('2026'), findsOneWidget);
    expect(find.text('2025'), findsOneWidget);
    expect(find.text('2024'), findsNothing);
  });

  testWidgets('selecting a year filters history but keeps the hero', (
    tester,
  ) async {
    tallView(tester);
    await tester.pumpWidget(slipGaji(samplePayslipState()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('2025'));
    await tester.pumpAndSettle();

    // The hero stays the newest payslip overall.
    expect(find.text('Terbaru · Agustus 2026'), findsOneWidget);
    // History narrowed to 2025 only.
    expect(find.text('Desember 2025'), findsOneWidget);
    expect(find.text('Juli 2026'), findsNothing);
    expect(find.text('Maret 2026'), findsNothing);
  });

  testWidgets('renders the empty state when no payslips exist', (tester) async {
    await tester.pumpWidget(slipGaji(const PayslipState(loading: false)));
    await tester.pumpAndSettle();

    expect(find.text('Belum ada slip gaji tersedia'), findsOneWidget);
    expect(find.textContaining('setelah payroll periode'), findsOneWidget);
  });

  testWidgets('a load failure shows the error with retry, not a zero card', (
    tester,
  ) async {
    await tester.pumpWidget(
      slipGaji(const PayslipState(error: 'Server bermasalah')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Server bermasalah'), findsOneWidget);
    expect(find.text('Coba lagi'), findsOneWidget);
    expect(find.text('Rp 0'), findsNothing);
  });

  testWidgets('tapping a history row opens the detail screen', (tester) async {
    final state = samplePayslipState().copyWith(selected: testPayslipDetail());
    await tester.pumpWidget(slipGaji(state));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Juli 2026'));
    await tester.pumpAndSettle();

    expect(find.byType(SlipDetailScreen), findsOneWidget);
  });
}