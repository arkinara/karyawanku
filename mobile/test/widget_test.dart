import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/app.dart';
import 'package:karyawanku_mobile/features/shell/home_shell.dart';
import 'package:karyawanku_mobile/theme/app_theme.dart';

import 'helpers.dart';

void main() {
  testWidgets('signed-in app opens on Beranda with the shift hero', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [signedInOverride],
        child: const KaryawanKuApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(HomeShell), findsOneWidget);
    expect(find.text('SEDANG BEKERJA'), findsOneWidget);
    expect(find.text('5j 43m'), findsOneWidget);
  });

  testWidgets('every tab in the navigation bar renders', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [signedInOverride],
        child: MaterialApp(theme: buildAppTheme(), home: const HomeShell()),
      ),
    );
    await tester.pumpAndSettle();

    for (final label in ['Absensi', 'Cuti', 'Slip Gaji']) {
      // NavigationBar stacks a selected and an unselected label per
      // destination, so the finder matches twice.
      await tester.tap(
        find
            .descendant(
              of: find.byType(NavigationBar),
              matching: find.text(label),
            )
            .first,
      );
      await tester.pumpAndSettle();
    }

    expect(tester.takeException(), isNull);
  });
}