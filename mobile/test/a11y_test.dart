import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/data/mock_data.dart';
import 'package:karyawanku_mobile/features/absensi/absensi_screen.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/auth/masuk_screen.dart';
import 'package:karyawanku_mobile/features/beranda/beranda_screen.dart';
import 'package:karyawanku_mobile/features/cuti/ajukan_cuti_screen.dart';
import 'package:karyawanku_mobile/features/cuti/cuti_screen.dart';
import 'package:karyawanku_mobile/features/jadwal/jadwal_screen.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';
import 'package:karyawanku_mobile/features/shell/home_shell.dart';
import 'package:karyawanku_mobile/features/slip/slip_detail_screen.dart';
import 'package:karyawanku_mobile/features/slip/slip_gaji_screen.dart';
import 'package:karyawanku_mobile/theme/app_theme.dart';

import 'helpers.dart';

final screens = <String, Widget>{
  'Masuk': const MasukScreen(),
  'Beranda': BerandaScreen(onOpenTab: (_) {}),
  'Absensi': const AbsensiScreen(),
  'Cuti': const CutiScreen(),
  'AjukanCuti': const AjukanCutiScreen(),
  'SlipGaji': const SlipGajiScreen(),
  'SlipDetail': SlipDetailScreen(payslip: Mock.latestPayslip),
  'Jadwal': const JadwalScreen(),
  'HomeShell': const HomeShell(),
};

void main() {
  // The palette is mirrored from the web for both brightnesses, so both are
  // audited — dark is not assumed to inherit light's contrast.
  for (final brightness in Brightness.values) {
    screens.forEach((name, screen) {
      testWidgets('$name meets guidelines in ${brightness.name}', (
        tester,
      ) async {
        final handle = tester.ensureSemantics();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              signedInOverride,
              attendanceOverride(const AttendanceState()),
              shiftOverride(const ShiftState()),
              leaveOverride(sampleLeaveState()),
              ...blockedNetworkOverrides(),
            ],
            child: MaterialApp(
              theme: buildAppTheme(brightness: brightness),
              home: screen,
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Android 48dp, iOS 44pt, every interactive element labelled, and
        // 4.5:1 text contrast.
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));

        handle.dispose();
      });
    });
  }
}
