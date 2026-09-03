import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/push/deep_link_router.dart';
import 'package:karyawanku_mobile/data/repositories/leave_repository.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  group('parseDeepLink', () {
    test('karyawanku://leave/<id> → leave target', () {
      final target = parseDeepLink(Uri.parse('karyawanku://leave/lr-1'));
      expect(target?.kind, DeepLinkKind.leave);
      expect(target?.id, 'lr-1');
    });

    test('karyawanku://shift/<id> → shift target', () {
      final target = parseDeepLink(Uri.parse('karyawanku://shift/sa-9'));
      expect(target?.kind, DeepLinkKind.shift);
      expect(target?.id, 'sa-9');
    });

    test('wrong scheme → null', () {
      expect(parseDeepLink(Uri.parse('https://karyawanku/leave/lr-1')), isNull);
    });

    test('unknown path → null', () {
      expect(parseDeepLink(Uri.parse('karyawanku://payslip/ps-1')), isNull);
      expect(parseDeepLink(Uri.parse('karyawanku://leave')), isNull);
      expect(parseDeepLink(Uri.parse('karyawanku://leave/a/b')), isNull);
    });
  });

  group('targetFromMessage', () {
    test('leave decision data → leave target', () {
      final target = targetFromMessage({
        'kind': 'leave',
        'requestId': 'lr-1',
        'decision': 'approved',
      });
      expect(target?.kind, DeepLinkKind.leave);
      expect(target?.id, 'lr-1');
    });

    test('shift reminder data → shift target', () {
      final target = targetFromMessage({
        'kind': 'shift_reminder',
        'assignmentId': 'sa-2',
      });
      expect(target?.kind, DeepLinkKind.shift);
      expect(target?.id, 'sa-2');
    });

    test('unknown kind → null', () {
      expect(targetFromMessage({'kind': 'payroll', 'id': 'x'}), isNull);
    });
  });

  group('DeepLinkGuard.owns', () {
    Map<String, dynamic> requestJson() => {
      'id': 'lr-1',
      'employee_id': 'emp-1',
      'employee_name': 'Siti Nurhaliza',
      'leave_type_id': 'lt-1',
      'leave_type_name': 'Tahunan',
      'tanggal_mulai': '2026-09-15',
      'tanggal_selesai': '2026-09-17',
      'alasan': 'Libur',
      'status': 'disetujui',
      'created_at': '2026-09-13T00:00:00.000Z',
    };

    test('owned leave id → true', () async {
      final repo = LeaveRepository(
        buildTestClient(
          store,
          (o) async => jsonResponse({'request': requestJson()}),
        ),
      );
      final guard = DeepLinkGuard(leaveRepo: repo);

      expect(
        await guard.owns(
          const DeepLinkTarget(kind: DeepLinkKind.leave, id: 'lr-1'),
        ),
        isTrue,
      );
    });

    test(
      'cross-employee leave id (403) → false → resolves to 404 page',
      () async {
        final repo = LeaveRepository(
          buildTestClient(
            store,
            (o) async => jsonErrorResponse(
              'Anda hanya dapat melihat pengajuan Anda sendiri.',
              status: 403,
            ),
          ),
        );
        final guard = DeepLinkGuard(leaveRepo: repo);

        expect(
          await guard.owns(
            const DeepLinkTarget(kind: DeepLinkKind.leave, id: 'lr-other'),
          ),
          isFalse,
        );
      },
    );

    test('unknown leave id (404) → false', () async {
      final repo = LeaveRepository(
        buildTestClient(
          store,
          (o) async =>
              jsonErrorResponse('Pengajuan cuti tidak ditemukan', status: 404),
        ),
      );
      final guard = DeepLinkGuard(leaveRepo: repo);

      expect(
        await guard.owns(
          const DeepLinkTarget(kind: DeepLinkKind.leave, id: 'lr-missing'),
        ),
        isFalse,
      );
    });

    test(
      'shift targets always owned (roster is employee-scoped server-side)',
      () async {
        final repo = LeaveRepository(
          buildTestClient(store, (o) async => jsonResponse({})),
        );
        final guard = DeepLinkGuard(leaveRepo: repo);

        expect(
          await guard.owns(
            const DeepLinkTarget(kind: DeepLinkKind.shift, id: 'sa-1'),
          ),
          isTrue,
        );
      },
    );

    test(
      'a 5xx (transient) is not treated as not-owned — screen shows its error state',
      () async {
        final repo = LeaveRepository(
          buildTestClient(
            store,
            (o) async => jsonErrorResponse('exploded', status: 500),
          ),
        );
        final guard = DeepLinkGuard(leaveRepo: repo);

        expect(
          await guard.owns(
            const DeepLinkTarget(kind: DeepLinkKind.leave, id: 'lr-1'),
          ),
          isTrue,
        );
      },
    );
  });
}
