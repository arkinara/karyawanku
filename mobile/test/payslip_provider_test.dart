import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/features/slip/payslip_provider.dart';

import 'helpers.dart';

ProviderContainer makeContainer(
  SecureSessionStore store,
  ApiClient client, {
  FakePayslipFileStore? files,
}) {
  final container = ProviderContainer(
    overrides: [
      secureSessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
      payslipFileStoreProvider.overrideWithValue(files ?? FakePayslipFileStore()),
      signedInEmployeeOverride,
    ],
  );
  addTearDown(container.dispose);
  return container;
}

Map<String, dynamic> rowJson({
  String id = 'ps-1',
  String periode = '2026-08',
  int takeHome = 4235000,
}) =>
    {
      'id': id,
      'pdf_url': '/api/payslips/$id/download',
      'created_at': '2026-08-31T02:00:00.000Z',
      'periode': periode,
      'status': 'disetujui',
      'employee': {'id': 'emp-1', 'nama_lengkap': 'Siti Nurhaliza'},
      'payroll_item_id': 'pi-1',
      'take_home': takeHome,
    };

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
      'total_earnings': 4700000,
      'total_deductions': 789000,
      'take_home': 3911000,
    },
  },
  'totals': {
    'total_earnings': 4700000,
    'total_deductions': 789000,
    'take_home': 3911000,
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

  group('loadList', () {
    test('fetches the payslips newest-first and clears loading', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/payslips') {
          return jsonResponse({
            'items': [
              rowJson(id: 'ps-1'),
              rowJson(id: 'ps-2', periode: '2026-07', takeHome: 4180000),
            ],
            'total': 2,
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.loadList();

      final state = container.read(payslipProvider);
      expect(state.loading, isFalse);
      expect(state.error, isNull);
      expect(state.payslips, hasLength(2));
      expect(state.payslips.first.id, 'ps-1');
    });

    test('loadLatest keeps only the newest payslip', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/payslips') {
          expect((o.queryParameters as Map)['limit'], 1);
          return jsonResponse({
            'items': [rowJson()],
            'total': 1,
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.loadLatest();

      expect(container.read(payslipProvider).latest, isNotNull);
      expect(container.read(payslipProvider).latest!.id, 'ps-1');
    });

    test('stores the BE message on failure, never partial data', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('Server bermasalah', status: 500);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.loadList();

      final state = container.read(payslipProvider);
      expect(state.loading, isFalse);
      expect(state.payslips, isEmpty);
      expect(state.error, 'Server bermasalah');
    });
  });

  group('select', () {
    test('fetches the full server breakdown verbatim', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/payslips/ps-1') {
          return jsonResponse(detailJson());
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.select('ps-1');

      final selected = container.read(payslipProvider).selected;
      expect(selected, isNotNull);
      expect(selected!.breakdown.earnings.first.namaKomponen, 'Gaji Pokok');
      // Totals come straight off the server payload — never recomputed.
      expect(selected.takeHome, 3911000);
      expect(selected.totalEarnings, 4700000);
      expect(selected.totalDeductions, 789000);
      expect(container.read(payslipProvider).detailError, isNull);
    });

    test('surfaces the BE message on failure', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('Slip gaji tidak ditemukan', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.select('ps-1');

      expect(container.read(payslipProvider).selected, isNull);
      expect(
        container.read(payslipProvider).detailError,
        'Slip gaji tidak ditemukan',
      );
    });
  });

  group('download', () {
    test('fetches bytes, saves to the device and reports success', () async {
      final bytes = Uint8List.fromList([1, 2, 3, 4]);
      final files = FakePayslipFileStore();
      final client = buildTestClient(store, (o) async {
        if (o.path == '/payslips/ps-1/download') {
          return ResponseBody.fromBytes(bytes, 200);
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client, files: files);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.download('ps-1', fileName: 'slip-gaji.pdf');

      expect(files.saved['slip-gaji.pdf'], bytes);
      expect(container.read(payslipProvider).downloading, isFalse);
      expect(container.read(payslipProvider).message, 'Slip gaji tersimpan');
    });

    test('BE download failure surfaces its message as a snackbar error', () async {
      final files = FakePayslipFileStore();
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('File slip gaji tidak ditemukan', status: 404);
      });
      final container = makeContainer(store, client, files: files);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.download('ps-1');

      expect(files.saved, isEmpty);
      expect(container.read(payslipProvider).downloading, isFalse);
      expect(
        container.read(payslipProvider).message,
        'File slip gaji tidak ditemukan',
      );
    });

    test('a failed device write never reports success', () async {
      final files = FakePayslipFileStore()..throwOnSave = Exception('disk');
      final client = buildTestClient(store, (o) async {
        return ResponseBody.fromBytes(Uint8List.fromList([1]), 200);
      });
      final container = makeContainer(store, client, files: files);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.download('ps-1', fileName: 'slip-gaji.pdf');

      expect(container.read(payslipProvider).downloading, isFalse);
      expect(
        container.read(payslipProvider).message,
        'Gagal mengunduh slip gaji',
      );
    });

    test('the message is one-shot: clearing resets it for the next action', () async {
      final files = FakePayslipFileStore();
      final client = buildTestClient(store, (o) async {
        return ResponseBody.fromBytes(Uint8List.fromList([1]), 200);
      });
      final container = makeContainer(store, client, files: files);
      final notifier = container.read(payslipProvider.notifier);

      await notifier.download('ps-1');
      notifier.clearMessage();

      expect(container.read(payslipProvider).message, isNull);
    });
  });
}