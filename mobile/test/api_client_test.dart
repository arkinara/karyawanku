import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_exception.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  group('auth header', () {
    test('attaches Authorization: Bearer to authenticated requests', () async {
      await store.saveSession(testSession);
      String? sentAuth;

      final client = buildTestClient(store, (options) async {
        if (options.path == '/auth/me') {
          sentAuth = options.headers['Authorization'] as String?;
          return jsonResponse({'user': testUser.toJson()});
        }
        return jsonErrorResponse('nope', status: 404);
      });

      final res = await client.get<Map<String, dynamic>>('/auth/me');
      expect(res['user']['nama'], 'Siti Nurhaliza');
      expect(sentAuth, 'Bearer access-token-1');
    });

    test('skips the header on anonymous requests', () async {
      String? sentAuth;
      final client = buildTestClient(store, (options) async {
        if (options.path == '/auth/sign-in') {
          sentAuth = options.headers['Authorization'] as String?;
          return jsonResponse({
            'user': testUser.toJson(),
            'token': 'a',
            'refresh_token': 'r',
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });

      await client.post<Map<String, dynamic>>(
        '/auth/sign-in',
        body: {'email': 'x', 'password': 'y'},
        anonymous: true,
      );
      expect(sentAuth, isNull);
    });
  });

  group('401 → refresh once', () {
    test('refreshes transparently and the retried request succeeds', () async {
      await store.saveSession(testSession);
      final calls = <String>[];
      final authHeaders = <String?>[];

      final client = buildTestClient(store, (options) async {
        calls.add(options.path);
        if (options.path == '/auth/me') {
          final first = calls.where((p) => p == '/auth/me').length == 1;
          authHeaders.add(options.headers['Authorization'] as String?);
          if (first) return jsonErrorResponse('token expired', status: 401);
          return jsonResponse({'user': testUser.toJson()});
        }
        if (options.path == '/auth/refresh') {
          return jsonResponse({
            'access_token': 'access-token-2',
            'refresh_token': 'refresh-token-2',
          });
        }
        return jsonErrorResponse('nope', status: 404);
      });

      final res = await client.get<Map<String, dynamic>>('/auth/me');

      expect(res['user']['nama'], 'Siti Nurhaliza');
      // Original request + refresh + retried original.
      expect(calls, ['/auth/me', '/auth/refresh', '/auth/me']);
      // The retry picked up the refreshed token from the store.
      expect(authHeaders[0], 'Bearer access-token-1');
      expect(authHeaders[1], 'Bearer access-token-2');
      expect(await store.getAccessToken(), 'access-token-2');
      expect(await store.getRefreshToken(), 'refresh-token-2');
    });

    test(
      'a failing refresh signs out and throws UnauthorizedException',
      () async {
        await store.saveSession(testSession);
        var expired = 0;

        final client = buildTestClient(store, (options) async {
          if (options.path == '/auth/me') {
            return jsonErrorResponse('token expired', status: 401);
          }
          if (options.path == '/auth/refresh') {
            return jsonErrorResponse('refresh invalid', status: 401);
          }
          return jsonErrorResponse('nope', status: 404);
        });
        client.onSessionExpired = () => expired++;

        await expectLater(
          client.get<Map<String, dynamic>>('/auth/me'),
          throwsA(isA<UnauthorizedException>()),
        );

        expect(expired, 1);
        // Local session wiped — a revoked session cannot be resurrected.
        expect(await store.getAccessToken(), isNull);
        expect(await store.getRefreshToken(), isNull);
      },
    );

    test('a second 401 on the retried request signs out too', () async {
      await store.saveSession(testSession);
      var expired = 0;

      final client = buildTestClient(store, (options) async {
        if (options.path == '/auth/refresh') {
          return jsonResponse({
            'access_token': 'access-token-2',
            'refresh_token': 'refresh-token-2',
          });
        }
        // Every /auth/me returns 401 — even the retry.
        return jsonErrorResponse('still dead', status: 401);
      });
      client.onSessionExpired = () => expired++;

      await expectLater(
        client.get<Map<String, dynamic>>('/auth/me'),
        throwsA(isA<UnauthorizedException>()),
      );
      expect(expired, 1);
      expect(await store.getAccessToken(), isNull);
    });
  });

  group('error mapping', () {
    test('anonymous 401 keeps the BE message (wrong credentials)', () async {
      final client = buildTestClient(store, (options) async {
        return jsonErrorResponse(
          'Email atau kata sandi salah',
          status: 401,
          details: {'fieldErrors': 'x'},
        );
      });

      await expectLater(
        client.post<Map<String, dynamic>>(
          '/auth/sign-in',
          body: {'email': 'x', 'password': 'y'},
          anonymous: true,
        ),
        throwsA(
          isA<ApiException>()
              .having((e) => e.status, 'status', 401)
              .having(
                (e) => e.message,
                'message',
                'Email atau kata sandi salah',
              )
              .having((e) => e.details, 'details', isNotNull),
        ),
      );
    });

    test(
      'BE validation envelope parses into ApiException with details',
      () async {
        final client = buildTestClient(store, (options) async {
          return jsonErrorResponse(
            'Data masuk tidak valid',
            status: 400,
            details: {
              'fieldErrors': {
                'email': ['Format email tidak valid'],
              },
            },
          );
        });

        await expectLater(
          client.post<Map<String, dynamic>>(
            '/auth/sign-in',
            body: {'email': 'bad', 'password': 'y'},
            anonymous: true,
          ),
          throwsA(
            isA<ApiException>()
                .having((e) => e.status, 'status', 400)
                .having((e) => e.message, 'message', 'Data masuk tidak valid')
                .having(
                  (e) => e.details,
                  'details',
                  isA<Map<String, dynamic>>(),
                ),
          ),
        );
      },
    );

    test('non-JSON error body keeps a friendly status message', () async {
      final client = buildTestClient(store, (options) async {
        return ResponseBody.fromString('<html>boom</html>', 500);
      });

      await expectLater(
        client.get<Map<String, dynamic>>('/auth/me'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.status, 'status', 500)
              .having((e) => e.message, 'message', 'Permintaan gagal (500)'),
        ),
      );
    });

    test('network failures throw NetworkException, not ApiException', () async {
      final client = buildTestClient(store, (options) async {
        throw const SocketException('Connection refused');
      });

      await expectLater(
        client.get<Map<String, dynamic>>('/auth/me'),
        throwsA(isA<NetworkException>()),
      );
    });

    test('timeouts throw NetworkException', () async {
      final client = buildTestClient(store, (options) async {
        throw DioException.connectionTimeout(
          timeout: const Duration(seconds: 10),
          requestOptions: options,
        );
      });

      await expectLater(
        client.get<Map<String, dynamic>>('/auth/me'),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
