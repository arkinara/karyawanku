import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_exception.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/repositories/device_repository.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  DeviceRepository repoFor(
    Future<ResponseBody> Function(RequestOptions) handler,
  ) => DeviceRepository(buildTestClient(store, handler));

  group('register', () {
    test('POSTs /devices and returns the device id', () async {
      String? path;
      Map<String, dynamic>? body;
      final repo = repoFor((o) async {
        path = o.path;
        body = o.data as Map<String, dynamic>;
        return jsonResponse({
          'device': {
            'id': 'dev-1',
            'platform': 'android',
            'token': 'fcm-token',
            'app_version': '1.0.0',
          },
        }, 201);
      });

      final id = await repo.register(
        token: 'fcm-token',
        platform: 'android',
        appVersion: '1.0.0',
      );

      expect(path, '/devices');
      expect(body!['token'], 'fcm-token');
      expect(body!['platform'], 'android');
      expect(body!['app_version'], '1.0.0');
      expect(id, 'dev-1');
    });

    test(
      '401 (not signed in) → no-op, returns empty id, never throws',
      () async {
        final repo = repoFor(
          (o) async => jsonErrorResponse('Sesi telah berakhir', status: 401),
        );

        final id = await repo.register(token: 't', platform: 'ios');

        expect(id, isEmpty);
      },
    );

    test('a 5xx register failure surfaces as an ApiException', () async {
      final repo = repoFor(
        (o) async => jsonErrorResponse('server exploded', status: 500),
      );

      await expectLater(
        repo.register(token: 't', platform: 'android'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('unregister', () {
    test('DELETEs /devices/:id', () async {
      String? path;
      final repo = repoFor((o) async {
        path = o.path;
        return jsonResponse({'ok': true});
      });

      await repo.unregister('dev-1');

      expect(path, '/devices/dev-1');
    });

    test('best-effort: a failure is swallowed', () async {
      final repo = repoFor((o) async => jsonErrorResponse('gone', status: 500));

      await repo.unregister('dev-1'); // must not throw
    });
  });

  group('invalidate', () {
    test(
      'finds the device by token and POSTs /devices/:id/invalidate',
      () async {
        final calls = <String>[];
        final repo = repoFor((o) async {
          calls.add(o.path);
          if (o.path == '/devices') {
            return jsonResponse({
              'devices': [
                {'id': 'dev-1', 'token': 'fcm-token', 'platform': 'android'},
              ],
            });
          }
          return jsonResponse({'ok': true});
        });

        await repo.invalidate('fcm-token');

        expect(calls, ['/devices', '/devices/dev-1/invalidate']);
      },
    );

    test('unknown token → nothing sent, no throw', () async {
      final repo = repoFor((o) async {
        if (o.path == '/devices') return jsonResponse({'devices': []});
        return jsonResponse({'ok': true});
      });

      await repo.invalidate('nope');
    });
  });

  group('list', () {
    test('GETs /devices and parses the rows', () async {
      String? path;
      final repo = repoFor((o) async {
        path = o.path;
        return jsonResponse({
          'devices': [
            {'id': 'dev-1', 'token': 't1', 'platform': 'android'},
            {'id': 'dev-2', 'token': 't2', 'platform': 'ios'},
          ],
        });
      });

      final devices = await repo.list();

      expect(path, '/devices');
      expect(devices, hasLength(2));
      expect(devices.first.id, 'dev-1');
      expect(devices.last.platform, 'ios');
    });
  });
}
