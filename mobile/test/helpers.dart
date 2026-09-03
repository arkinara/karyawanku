import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/api/models.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';

/// In-memory [SecureStorageBackend] so session roundtrips and auth flows run
/// without platform channels.
class InMemoryBackend implements SecureStorageBackend {
  final _data = <String, String>{};

  @override
  Future<String?> read(String key) async => _data[key];

  @override
  Future<void> write(String key, String value) async => _data[key] = value;

  @override
  Future<void> delete(String key) async => _data.remove(key);

  Map<String, String> get data => Map.unmodifiable(_data);
}

/// A canned Dio adapter: each request is routed to [handler], which decides
/// the status + body (or throws to simulate a network failure).
class FakeHttpAdapter implements HttpClientAdapter {
  FakeHttpAdapter(this.handler);

  Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

/// Route a request through a real [Dio] so the ApiClient interceptors run.
Dio testDio(Future<ResponseBody> Function(RequestOptions options) handler) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));
  dio.httpClientAdapter = FakeHttpAdapter(handler);
  return dio;
}

ResponseBody jsonResponse(Map<String, dynamic> body, [int status = 200]) {
  return ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: {'content-type': ['application/json']},
  );
}

/// BE error envelope: `{ error: { message, details } }`.
ResponseBody jsonErrorResponse(
  String message, {
  int status = 400,
  Map<String, dynamic>? details,
}) {
  return jsonResponse({'error': {'message': message, 'details': details}}, status);
}

/// A signed-in user that mirrors what `publicUser` returns.
final testUser = User(
  id: 'u-1',
  businessId: 'b-1',
  email: 'siti@usaha.com',
  nama: 'Siti Nurhaliza',
  role: UserRole.employee,
  status: 'aktif',
);

final testSession = Session(
  accessToken: 'access-token-1',
  refreshToken: 'refresh-token-1',
  user: testUser,
);

/// Wire an ApiClient + in-memory store the auth notifier reads.
Widget testScope(
  SecureSessionStore store,
  ApiClient client, {
  List<Override> extra = const [],
  required Widget child,
}) {
  return ProviderScope(
    overrides: [
      secureSessionStoreProvider.overrideWithValue(store),
      apiClientProvider.overrideWithValue(client),
      ...extra,
    ],
    child: child,
  );
}

/// Override that hands the app a pre-signed-in session with no network work.
final signedInOverride = authProvider.overrideWith(
  () => _ReadyAuth(AuthState.signedIn(testSession)),
);

class _ReadyAuth extends AuthNotifier {
  _ReadyAuth(this.initial);
  final AuthState initial;

  @override
  AuthState build() => initial;

  // Tests render a fixed signed-in state; cold-start restore must not touch
  // platform secure storage and flip the app back to MasukScreen.
  @override
  Future<void> restoreSession() async {}
}

/// Build an ApiClient wired to a canned adapter + the given store.
ApiClient buildTestClient(
  SecureSessionStore store,
  Future<ResponseBody> Function(RequestOptions options) handler,
) {
  return ApiClient(dio: testDio(handler), sessionStore: store);
}