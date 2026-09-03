import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/repositories/payslip_file_store.dart';
import 'package:karyawanku_mobile/features/slip/payslip_provider.dart';
import 'package:karyawanku_mobile/features/slip/slip_detail_screen.dart';

import 'helpers.dart';

/// Detail whose server totals intentionally disagree with a naive client sum:
/// lines add to Rp 4.700.000 but the server reports Rp 4.800.000. The screen
/// must show the server figure, proving no client-side arithmetic.
Map<String, dynamic> detailJson() => {
  'id': 'ps-1',
  'payroll_item_id': 'pi-1',
  'employee': {'id': 'emp-1', 'nama': 'Siti Nurhaliza', 'jabatan': 'Kasir'},
  'periode': '2026-08',
  'breakdown': {
    'earnings': [
      {'nama_komponen': 'Gaji Pokok', 'nominal': 4200000, 'formula': null},
      {'nama_komponen': 'Tunjangan Makan', 'nominal': 500000, 'formula': null},
    ],
    'deductions': [
      {'nama_komponen': 'BPJS Kesehatan', 'nominal': 42000, 'formula': null},
      {'nama_komponen': 'PPh 21', 'nominal': 747000, 'formula': null},
    ],
    'totals': {
      'total_earnings': 4800000,
      'total_deductions': 500000,
      'take_home': 3500000,
    },
  },
  'totals': {
    'total_earnings': 4800000,
    'total_deductions': 500000,
    'take_home': 3500000,
  },
  'pdf_url': '/api/payslips/ps-1/download',
};

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  Widget detailApp(ApiClient client, {PayslipFileStore? files}) {
    return ProviderScope(
      overrides: [
        signedInOverride,
        secureSessionStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(client),
        payslipFileStoreProvider.overrideWithValue(
          files ?? FakePayslipFileStore(),
        ),
      ],
      child: MaterialApp(home: SlipDetailScreen(payslip: testPayslip())),
    );
  }

  testWidgets('renders earnings and deductions verbatim from the server', (
    tester,
  ) async {
    final client = buildTestClient(store, (o) async {
      if (o.path == '/payslips/ps-1') return jsonResponse(detailJson());
      return jsonErrorResponse('nope', status: 404);
    });

    await tester.pumpWidget(detailApp(client));
    await tester.pumpAndSettle();

    // Lines come straight off the payload, never renamed or recomputed.
    expect(find.text('Gaji Pokok'), findsOneWidget);
    expect(find.text('Rp 4.200.000'), findsOneWidget);
    expect(find.text('Tunjangan Makan'), findsOneWidget);
    expect(find.text('BPJS Kesehatan'), findsOneWidget);
    expect(find.text('PPh 21'), findsOneWidget);
  });

  testWidgets('totals are the server figures, never summed client-side', (
    tester,
  ) async {
    final client = buildTestClient(store, (o) async {
      if (o.path == '/payslips/ps-1') return jsonResponse(detailJson());
      return jsonErrorResponse('nope', status: 404);
    });

    await tester.pumpWidget(detailApp(client));
    await tester.pumpAndSettle();

    // Server totals: earnings 4.800.000 (not the 4.700.000 line sum), take-home
    // 3.500.000 (not a computed residual).
    expect(find.text('Pendapatan · Rp 4.800.000'), findsOneWidget);
    expect(find.text('Potongan · Rp 500.000'), findsOneWidget);
    expect(find.text('Rp 3.500.000'), findsOneWidget);
    expect(find.text('Rp 4.700.000'), findsNothing);
    expect(find.text('Rp 3.000.000'), findsNothing);
  });

  testWidgets('download button fetches bytes, saves the file and toasts', (
    tester,
  ) async {
    final files = FakePayslipFileStore();
    final pdf = Uint8List.fromList(List.generate(16, (i) => i));
    final client = buildTestClient(store, (o) async {
      if (o.path == '/payslips/ps-1') return jsonResponse(detailJson());
      if (o.path == '/payslips/ps-1/download') {
        return ResponseBody.fromBytes(
          pdf,
          200,
          headers: {'content-type': ['application/pdf']},
        );
      }
      return jsonErrorResponse('nope', status: 404);
    });

    await tester.pumpWidget(detailApp(client, files: files));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Unduh PDF'));
    await tester.pumpAndSettle();

    expect(files.saved['slip-gaji-siti-nurhaliza-2026-08.pdf'], pdf);
    expect(find.text('Slip gaji tersimpan'), findsOneWidget);
  });

  testWidgets('a failed download shows the BE message and saves nothing', (
    tester,
  ) async {
    final files = FakePayslipFileStore();
    final client = buildTestClient(store, (o) async {
      if (o.path == '/payslips/ps-1') return jsonResponse(detailJson());
      if (o.path == '/payslips/ps-1/download') {
        return jsonErrorResponse('File slip gaji tidak ditemukan', status: 404);
      }
      return jsonErrorResponse('nope', status: 404);
    });

    await tester.pumpWidget(detailApp(client, files: files));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Unduh PDF'));
    await tester.pumpAndSettle();

    expect(files.saved, isEmpty);
    expect(find.text('File slip gaji tidak ditemukan'), findsOneWidget);
  });

  testWidgets('a failed detail load offers retry', (tester) async {
    final client = buildTestClient(store, (o) async {
      return jsonErrorResponse('Slip gaji tidak ditemukan', status: 404);
    });

    await tester.pumpWidget(detailApp(client));
    await tester.pumpAndSettle();

    expect(find.text('Slip gaji tidak ditemukan'), findsOneWidget);
    expect(find.text('Coba lagi'), findsOneWidget);
  });
}