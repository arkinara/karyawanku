import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/features/absensi/absensi_screen.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/auth/masuk_screen.dart';
import 'package:karyawanku_mobile/features/beranda/beranda_screen.dart';
import 'package:karyawanku_mobile/features/cuti/ajukan_cuti_screen.dart';
import 'package:karyawanku_mobile/features/cuti/cuti_screen.dart';
import 'package:karyawanku_mobile/features/jadwal/jadwal_screen.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';
import 'package:karyawanku_mobile/features/slip/slip_detail_screen.dart';
import 'package:karyawanku_mobile/features/slip/slip_gaji_screen.dart';
import 'package:karyawanku_mobile/data/mock_data.dart';
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
};

void main() {
  for (final brightness in Brightness.values) {
    for (final scale in [1.0, 1.5, 2.0]) {
      for (final width in [320.0, 412.0]) {
        group('${brightness.name} scale $scale width $width', () {
          screens.forEach((name, screen) {
            testWidgets(name, (tester) async {
              tester.view.physicalSize = Size(width * 3, 900 * 3);
              tester.view.devicePixelRatio = 3;
              addTearDown(tester.view.reset);

              await tester.pumpWidget(
                MediaQuery(
                  data: MediaQueryData(textScaler: TextScaler.linear(scale)),
child: ProviderScope(
                      overrides: [
                        signedInOverride,
                        attendanceOverride(const AttendanceState()),
                        shiftOverride(const ShiftState()),
                      ],
                    child: MaterialApp(
                      theme: buildAppTheme(brightness: brightness),
                      home: screen,
                    ),
                  ),
                ),
              );
              await tester.pumpAndSettle();
              expect(
                tester.takeException(),
                isNull,
                reason: '$name overflowed',
              );
            });
          });
        });
      }
    }
  }
}
