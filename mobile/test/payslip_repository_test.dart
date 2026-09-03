import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_exception.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/repositories/payslip_repository.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  PayslipRepository repoFor(
    Future<ResponseBody> Function(RequestOptions) handler,
  ) =>
      PayslipRepository(buildTestClient(store, handler));

  Map<String, dynamic> rowJson({
    String id = 'ps-1',
    String periode = '2026-08',
    String status = 'disetujui',
    int takeHome = 4235000,
    bool? isThr,
    String? category,
  }) =>
      {
        'id': id,
        'pdf_url': '/api/payslips/$id/download',
        'created_at': '2026-08-31T02:00:00.000Z',
        'periode': periode,
        'status': status,
        'employee': {'id': 'emp-1', 'nama_lengkap': 'Siti Nurhaliza'},
        'payroll_item_id': 'pi-1',
        'take_home': takeHome,
        'is_thr': ?isThr,
        'category': ?category,
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
        {
          'nama_komponen': 'BPJS Kesehatan',
          'nominal': 42000,
          'formula': 'gaji_pokok * 0.01',
        },
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

  group('getPayslips', () {
    test('GETs /payslips with page/limit and parses the summary rows', () async {
      String? path;
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        path = o.path;
        query = o.queryParameters;
        return jsonResponse({
          'items': [
            rowJson(id: 'ps-1', periode: '2026-08'),
            rowJson(id: 'ps-2', periode: '2026-07', takeHome: 4180000),
          ],
          'total': 2,
          'page': 1,
          'limit': 50,
          'has_more': false,
        });
      });

      final list = await repo.getPayslips();

      expect(path, '/payslips');
      expect(query!['limit'], 50);
      expect(query!['page'], 1);
      expect(list, hasLength(2));
      expect(list.first.id, 'ps-1');
      expect(list.first.periode, '2026-08');
      expect(list.first.periodLabel, 'Agustus 2026');
      expect(list.first.takeHome, 4235000);
      expect(list.first.employeeName, 'Siti Nurhaliza');
      expect(list.first.paid, isTrue);
      expect(list.first.isThr, isFalse);
    });

    test('converts offset to a 1-indexed page', () async {
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        query = o.queryParameters;
        return jsonResponse({'items': <dynamic>[], 'total': 0});
      });

      await repo.getPayslips(limit: 20, offset: 60);

      expect(query!['limit'], 20);
      expect(query!['page'], 4);
    });

    test('filters by the year of the periode', () async {
      final repo = repoFor((o) async {
        return jsonResponse({
          'items': [
            rowJson(id: 'ps-1', periode: '2026-08'),
            rowJson(id: 'ps-2', periode: '2025-12', takeHome: 4100000),
          ],
          'total': 2,
        });
      });

      final list = await repo.getPayslips(year: 2025);

      expect(list, hasLength(1));
      expect(list.first.id, 'ps-2');
    });

    test('flags THR from the server is_thr flag, never a fixture', () async {
      final repo = repoFor((o) async {
        return jsonResponse({
          'items': [
            rowJson(id: 'ps-1', isThr: true),
            rowJson(id: 'ps-2', category: 'thr'),
            rowJson(id: 'ps-3'),
          ],
          'total': 3,
        });
      });

      final list = await repo.getPayslips();

      expect(list[0].isThr, isTrue);
      expect(list[1].isThr, isTrue);
      expect(list[2].isThr, isFalse);
    });

    test('returns an empty list for a missing items key', () async {
      final repo = repoFor((o) async => jsonResponse({'total': 0}));

      final list = await repo.getPayslips();

      expect(list, isEmpty);
    });
  });

  group('getPayslip', () {
    test('GETs /payslips/:id and parses the full server breakdown', () async {
      String? path;
      final repo = repoFor((o) async {
        path = o.path;
        return jsonResponse(detailJson());
      });

      final detail = await repo.getPayslip('ps-1');

      expect(path, '/payslips/ps-1');
      expect(detail.id, 'ps-1');
      expect(detail.periodLabel, 'Agustus 2026');
      expect(detail.employeeName, 'Siti Nurhaliza');
      expect(detail.jabatan, 'Kasir');
      expect(detail.breakdown.earnings, hasLength(2));
      expect(detail.breakdown.earnings.first.namaKomponen, 'Gaji Pokok');
      expect(detail.breakdown.earnings.first.nominal, 4200000);
      expect(detail.breakdown.deductions, hasLength(2));
      expect(detail.breakdown.deductions.last.namaKomponen, 'PPh 21');
      // Server totals — read verbatim, never summed client-side.
      expect(detail.takeHome, 3911000);
      expect(detail.totalEarnings, 4700000);
      expect(detail.totalDeductions, 789000);
    });
  });

  group('downloadPayslip', () {
    test('GETs /payslips/:id/download and returns the raw PDF bytes', () async {
      String? path;
      final bytes = Uint8List.fromList(
        List.generate(32, (i) => i),
      );
      final repo = repoFor((o) async {
        path = o.path;
        return ResponseBody.fromBytes(
          bytes,
          200,
          headers: {'content-type': ['application/pdf']},
        );
      });

      final result = await repo.downloadPayslip('ps-1', fileName: 'x.pdf');

      expect(path, '/payslips/ps-1/download');
      expect(result, bytes);
    });

    test('surfaces a BE failure as an ApiException message', () async {
      final repo = repoFor((o) async {
        return jsonErrorResponse('File slip gaji tidak ditemukan', status: 404);
      });

      await expectLater(
        repo.downloadPayslip('ps-1'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            'File slip gaji tidak ditemukan',
          ),
        ),
      );
    });
  });
}