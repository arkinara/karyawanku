import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/data/repositories/leave_repository.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  LeaveRepository repoFor(
    Future<ResponseBody> Function(RequestOptions) handler,
  ) => LeaveRepository(buildTestClient(store, handler));

  Map<String, dynamic> requestJson({
    String status = 'pending',
    String? catatanApprover,
  }) => {
    'id': 'lr-1',
    'employee_id': 'emp-1',
    'employee_name': 'Siti Nurhaliza',
    'leave_type_id': 'lt-1',
    'leave_type_name': 'Tahunan',
    'tanggal_mulai': '2026-09-15',
    'tanggal_selesai': '2026-09-17',
    'alasan': 'Acara keluarga di Bandung',
    'status': status,
    'approver_user_id': null,
    'catatan_approver': catatanApprover,
    'created_at': '2026-09-13T00:00:00.000Z',
    'decided_at': null,
  };

  Map<String, dynamic> balanceJson() => {
    'id': 'lb-1',
    'employee_id': 'emp-1',
    'leave_type_id': 'lt-1',
    'nama_jenis_cuti': 'Tahunan',
    'tahun': 2026,
    'kuota_hari': 12,
    'terpakai_hari': 4,
    'sisa_hari': 8,
  };

  Map<String, dynamic> typeJson() => {
    'id': 'lt-1',
    'business_id': 'b-1',
    'nama_jenis_cuti': 'Tahunan',
    'default_kuota_hari': 12,
    'kebijakan_sisa': 'carry-over',
    'carry_over_max_days': 5,
    'aktif': true,
  };

  group('getRequests', () {
    test('GETs /leave-requests and parses the full display model', () async {
      String? path;
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        path = o.path;
        query = o.queryParameters;
        return jsonResponse({
          'items': [requestJson()],
          'total': 1,
          'page': 1,
          'limit': 100,
          'has_more': false,
        });
      });

      final list = await repo.getRequests();

      expect(path, '/leave-requests');
      expect(query!['limit'], 100);
      expect(list, hasLength(1));
      final request = list.first;
      expect(request.id, 'lr-1');
      expect(request.leaveTypeName, 'Tahunan');
      expect(request.kindLabel, 'Cuti Tahunan');
      expect(request.status, LeaveStatus.menunggu);
      expect(request.start, DateTime(2026, 9, 15));
      expect(request.end, DateTime(2026, 9, 17));
      expect(request.days, 3);
      expect(request.reason, 'Acara keluarga di Bandung');
      expect(request.decisionNote, isNull);
      expect(request.meta, 'Diajukan 13/09/2026');
    });

    test('maps approved/rejected statuses and the approver note', () async {
      final repo = repoFor((o) async {
        return jsonResponse({
          'items': [
            requestJson(
              status: 'disetujui',
              catatanApprover: 'Pengganti shift diatur supervisor',
            ),
            requestJson(status: 'ditolak', catatanApprover: 'Bentrok jadwal'),
          ],
        });
      });

      final list = await repo.getRequests();

      expect(list.first.status, LeaveStatus.disetujui);
      expect(list.first.decisionNote, 'Pengganti shift diatur supervisor');
      expect(list.last.status, LeaveStatus.ditolak);
    });

    test('returns an empty list for a missing items key', () async {
      final repo = repoFor((o) async => jsonResponse({'total': 0}));

      final list = await repo.getRequests();

      expect(list, isEmpty);
    });
  });

  group('getBalances', () {
    test(
      'GETs /leave-balances with the current year and parses rows',
      () async {
        String? path;
        Map<String, dynamic>? query;
        final repo = repoFor((o) async {
          path = o.path;
          query = o.queryParameters;
          return jsonResponse({
            'employee_id': 'emp-1',
            'tahun': 2026,
            'balances': [balanceJson()],
          });
        });

        final list = await repo.getBalances();

        expect(path, '/leave-balances');
        expect(query!['tahun'], DateTime.now().year);
        expect(list, hasLength(1));
        final balance = list.first;
        expect(balance.label, 'Tahunan');
        expect(balance.remaining, 8);
        expect(balance.total, 12);
        expect(balance.tahun, 2026);
        expect(balance.expiry, DateTime(2026, 12, 31));
      },
    );

    test('returns an empty list for a missing balances key', () async {
      final repo = repoFor((o) async => jsonResponse({'tahun': 2026}));

      final list = await repo.getBalances();

      expect(list, isEmpty);
    });
  });

  group('getLeaveTypes', () {
    test('GETs /leave-types and parses the active types', () async {
      String? path;
      final repo = repoFor((o) async {
        path = o.path;
        return jsonResponse({
          'leave_types': [typeJson()],
        });
      });

      final list = await repo.getLeaveTypes();

      expect(path, '/leave-types');
      expect(list, hasLength(1));
      expect(list.first.id, 'lt-1');
      expect(list.first.nama, 'Tahunan');
      expect(list.first.label, 'Cuti Tahunan');
      expect(list.first.defaultKuotaHari, 12);
      expect(list.first.kebijakanSisa, 'carry-over');
      expect(list.first.carryOverMaxDays, 5);
      expect(list.first.aktif, isTrue);
    });

    test('returns an empty list for a missing leave_types key', () async {
      final repo = repoFor((o) async => jsonResponse({}));

      final list = await repo.getLeaveTypes();

      expect(list, isEmpty);
    });
  });

  group('submit', () {
    test(
      'POSTs /leave-requests with the body and parses the response',
      () async {
        String? path;
        Map<String, dynamic>? body;
        final repo = repoFor((o) async {
          path = o.path;
          body = o.data as Map<String, dynamic>;
          return jsonResponse({'request': requestJson()});
        });

        final created = await repo.submit(
          leaveTypeId: 'lt-1',
          tanggalMulai: DateTime(2026, 9, 15),
          tanggalSelesai: DateTime(2026, 9, 17),
          alasan: '  Acara keluarga di Bandung  ',
        );

        expect(path, '/leave-requests');
        expect(body!['leave_type_id'], 'lt-1');
        expect(body!['tanggal_mulai'], '2026-09-15');
        expect(body!['tanggal_selesai'], '2026-09-17');
        expect(body!['alasan'], 'Acara keluarga di Bandung');
        expect(created.status, LeaveStatus.menunggu);
        expect(created.days, 3);
      },
    );
  });
}
