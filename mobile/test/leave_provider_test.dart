import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/features/cuti/leave_provider.dart';

import 'helpers.dart';

ProviderContainer makeContainer(SecureSessionStore store, ApiClient client) {
  final container = ProviderContainer(
    overrides: [
      secureSessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
      signedInEmployeeOverride,
    ],
  );
  addTearDown(container.dispose);
  return container;
}

Map<String, dynamic> requestJson({
  String id = 'lr-1',
  String status = 'pending',
}) =>
    {
      'id': id,
      'employee_id': 'emp-1',
      'employee_name': 'Siti Nurhaliza',
      'leave_type_id': 'lt-1',
      'leave_type_name': 'Tahunan',
      'tanggal_mulai': '2026-09-15',
      'tanggal_selesai': '2026-09-17',
      'alasan': 'Acara keluarga di Bandung',
      'status': status,
      'approver_user_id': null,
      'catatan_approver': null,
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

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  group('loadAll', () {
    test('fetches balances, requests and leave types in parallel', () async {
      final paths = <String>[];
      final client = buildTestClient(store, (o) async {
        paths.add(o.path);
        return switch (o.path) {
          '/leave-balances' => jsonResponse({
            'employee_id': 'emp-1',
            'tahun': 2026,
            'balances': [balanceJson()],
          }),
          '/leave-requests' => jsonResponse({
            'items': [requestJson()],
          }),
          '/leave-types' => jsonResponse({
            'leave_types': [typeJson()],
          }),
          _ => jsonErrorResponse('nope', status: 404),
        };
      });
      final container = makeContainer(store, client);
      final notifier = container.read(leaveProvider.notifier);

      await notifier.loadAll();

      expect(paths, contains('/leave-balances'));
      expect(paths, contains('/leave-requests'));
      expect(paths, contains('/leave-types'));
      final state = container.read(leaveProvider);
      expect(state.loading, isFalse);
      expect(state.error, isNull);
      expect(state.balances, hasLength(1));
      expect(state.balances.first.remaining, 8);
      expect(state.requests, hasLength(1));
      expect(state.requests.first.status, LeaveStatus.menunggu);
      expect(state.leaveTypes, hasLength(1));
      expect(state.leaveTypes.first.nama, 'Tahunan');
    });

    test('stores the failure message and keeps whatever loaded', () async {
      final client = buildTestClient(store, (o) async {
        return switch (o.path) {
          '/leave-balances' => jsonErrorResponse(
            'Server bermasalah',
            status: 500,
          ),
          '/leave-requests' => jsonResponse({
            'items': [requestJson()],
          }),
          '/leave-types' => jsonResponse({
            'leave_types': [typeJson()],
          }),
          _ => jsonErrorResponse('nope', status: 404),
        };
      });
      final container = makeContainer(store, client);
      final notifier = container.read(leaveProvider.notifier);

      await notifier.loadAll();

      final state = container.read(leaveProvider);
      expect(state.loading, isFalse);
      expect(state.error, 'Server bermasalah');
      // The successful fetches are not thrown away.
      expect(state.requests, hasLength(1));
      expect(state.leaveTypes, hasLength(1));
    });
  });

  group('submit', () {
    test('posts, refetches the list, and returns idle on success', () async {
      var posted = false;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/leave-requests' && o.method == 'POST') {
          expect((o.data as Map)['leave_type_id'], 'lt-1');
          expect((o.data as Map)['tanggal_mulai'], '2026-09-15');
          expect((o.data as Map)['tanggal_selesai'], '2026-09-17');
          expect((o.data as Map)['alasan'], 'Acara keluarga di Bandung');
          posted = true;
          return jsonResponse({
            'request': requestJson(id: 'lr-new'),
          });
        }
        if (o.path == '/leave-requests' && o.method == 'GET') {
          return jsonResponse({
            'items': [requestJson(id: 'lr-new')],
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(leaveProvider.notifier);

      await notifier.submit(
        leaveTypeId: 'lt-1',
        tanggalMulai: DateTime(2026, 9, 15),
        tanggalSelesai: DateTime(2026, 9, 17),
        alasan: 'Acara keluarga di Bandung',
      );

      expect(posted, isTrue);
      final state = container.read(leaveProvider);
      expect(state.submitting, isFalse);
      expect(state.actionError, isNull);
      expect(state.requests.map((r) => r.id), contains('lr-new'));
    });

    test('surfaces the BE rejection message verbatim', () async {
      final client = buildTestClient(store, (o) async {
        if (o.path == '/leave-requests' && o.method == 'POST') {
          return jsonErrorResponse(
            'Sisa kuota cuti tidak mencukupi (sisa 2 hari)',
            status: 422,
          );
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(leaveProvider.notifier);

      await notifier.submit(
        leaveTypeId: 'lt-1',
        tanggalMulai: DateTime(2026, 9, 15),
        tanggalSelesai: DateTime(2026, 9, 17),
        alasan: 'Acara keluarga di Bandung',
      );

      final state = container.read(leaveProvider);
      expect(state.submitting, isFalse);
      expect(state.actionError, 'Sisa kuota cuti tidak mencukupi (sisa 2 hari)');

      notifier.clearActionError();
      expect(container.read(leaveProvider).actionError, isNull);
    });

    test('double-tap produces exactly one request', () async {
      final gate = Completer<void>();
      var requests = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/leave-requests' && o.method == 'POST') {
          requests++;
          await gate.future;
          return jsonResponse({'request': requestJson()});
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(store, client);
      final notifier = container.read(leaveProvider.notifier);

      final first = notifier.submit(
        leaveTypeId: 'lt-1',
        tanggalMulai: DateTime(2026, 9, 15),
        tanggalSelesai: DateTime(2026, 9, 17),
        alasan: 'Acara keluarga di Bandung',
      );
      await notifier.submit(
        leaveTypeId: 'lt-1',
        tanggalMulai: DateTime(2026, 9, 15),
        tanggalSelesai: DateTime(2026, 9, 17),
        alasan: 'Acara keluarga di Bandung',
      );
      expect(container.read(leaveProvider).submitting, isTrue);

      gate.complete();
      await first;

      expect(requests, 1);
      expect(container.read(leaveProvider).submitting, isFalse);
    });
  });
}