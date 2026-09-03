import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/repositories/shift_repository.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  ShiftRepository repoFor(
    Future<ResponseBody> Function(RequestOptions) handler,
  ) =>
      ShiftRepository(buildTestClient(store, handler));

  Map<String, dynamic> shiftJson() => {
    'id': 's-1',
    'nama_shift': 'Pagi',
    'jam_mulai': '07:00',
    'jam_selesai': '15:00',
    'aktif': true,
  };

  Map<String, dynamic> assignmentJson({String? tanggal}) => {
    'id': 'sa-1',
    'employee_id': 'emp-1',
    'employee_name': 'Siti Nurhaliza',
    'shift_id': 's-1',
    'shift': shiftJson(),
    'tanggal': tanggal ?? '2026-09-03',
    'published': true,
    'published_at': null,
    'published_by_user_id': null,
  };

  group('getAssignments', () {
    test('GETs /shift-assignments with the range + limit', () async {
      String? path;
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        path = o.path;
        query = o.queryParameters;
        return jsonResponse({
          'items': [assignmentJson()],
          'total': 1,
          'page': 1,
          'limit': 100,
          'has_more': false,
        });
      });

      final list = await repo.getAssignments(
        start: DateTime(2026, 9, 1),
        end: DateTime(2026, 9, 30),
      );

      expect(path, '/shift-assignments');
      expect(query!['start'], '2026-09-01');
      expect(query!['end'], '2026-09-30');
      expect(query!['limit'], 100);
      expect(list, hasLength(1));
      expect(list.first.shift, isNotNull);
      expect(list.first.shift!.namaShift, 'Pagi');
      expect(list.first.shift!.jamMulai, '07:00');
      expect(list.first.shift!.jamSelesai, '15:00');
      expect(list.first.tanggal, DateTime(2026, 9, 3));
      expect(list.first.published, isTrue);
    });

    test('zero-pads dates and survives a missing shift', () async {
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        query = o.queryParameters;
        return jsonResponse({
          'items': [
            {
              ...assignmentJson(tanggal: '2026-01-05'),
              'shift': null,
            },
          ],
        });
      });

      final list = await repo.getAssignments(
        start: DateTime(2026, 1, 1),
        end: DateTime(2026, 1, 31),
      );

      expect(query!['start'], '2026-01-01');
      expect(query!['end'], '2026-01-31');
      expect(list.first.shift, isNull);
      expect(list.first.tanggal, DateTime(2026, 1, 5));
    });

    test('returns an empty list for a missing items key', () async {
      final repo = repoFor((o) async => jsonResponse({'total': 0}));

      final list = await repo.getAssignments(
        start: DateTime(2026, 9, 1),
        end: DateTime(2026, 9, 30),
      );

      expect(list, isEmpty);
    });
  });

  group('getUpcoming', () {
    test('GETs /shift-assignments/upcoming with days and parses assignments', () async {
      String? path;
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        path = o.path;
        query = o.queryParameters;
        return jsonResponse({'assignments': [assignmentJson()]});
      });

      final list = await repo.getUpcoming(days: 3);

      expect(path, '/shift-assignments/upcoming');
      expect(query!['days'], 3);
      expect(list, hasLength(1));
      expect(list.first.employeeName, 'Siti Nurhaliza');
    });

    test('defaults days to 3', () async {
      Map<String, dynamic>? query;
      final repo = repoFor((o) async {
        query = o.queryParameters;
        return jsonResponse({'assignments': <Map<String, dynamic>>[]});
      });

      await repo.getUpcoming();

      expect(query!['days'], 3);
    });
  });
}