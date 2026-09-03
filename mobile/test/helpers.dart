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
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';

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

/// Same, but the signed-in user is linked to an employee record (`emp-1`) so
/// employee-scoped endpoints like the attendance aggregate resolve.
final signedInEmployeeOverride = authProvider.overrideWith(
  () => _ReadyAuth(
    AuthState.signedIn(
      Session(
        accessToken: testSession.accessToken,
        refreshToken: testSession.refreshToken,
        user: testEmployeeUser,
      ),
    ),
  ),
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

/// Pin [attendanceProvider] to a fixed state with no network work — shared
/// widget tests (a11y, stress) get a deterministic screen instead of a live
/// ApiClient reaching for a blocked test HttpClient.
Override attendanceOverride(AttendanceState state) =>
    attendanceProvider.overrideWith(() => _ReadyAttendance(state));

class _ReadyAttendance extends AttendanceNotifier {
  _ReadyAttendance(this.initial);
  final AttendanceState initial;

  @override
  AttendanceState build() => initial;

  @override
  Future<void> loadToday() async {}

  @override
  Future<void> loadAggregate() async {}

  @override
  Future<void> refresh() async {}

  @override
  Future<void> clockIn() async {}

  @override
  Future<void> clockOut() async {}

  @override
  void clearActionError() {}
}

/// A signed-in employee (with a linked employee record) for attendance tests.
final testEmployeeUser = User(
  id: 'u-1',
  businessId: 'b-1',
  email: 'siti@usaha.com',
  nama: 'Siti Nurhaliza',
  role: UserRole.employee,
  status: 'aktif',
  employeeId: 'emp-1',
);

/// A today record fixture mirroring the BE envelope shape.
AttendanceRecord testAttendanceRecord({
  DateTime? clockIn,
  DateTime? clockOut,
  int lateMinutes = 0,
  int overtimeMinutes = 0,
  String? catatan,
  AttendanceStatus status = AttendanceStatus.hadir,
}) {
  return AttendanceRecord(
    id: 'att-1',
    employeeId: 'emp-1',
    tanggal: '2026-09-03',
    clockIn: clockIn,
    clockOut: clockOut,
    catatan: catatan,
    status: status,
    lateMinutes: lateMinutes,
    overtimeMinutes: overtimeMinutes,
    submissionMethod: 'live',
    timeDriftDetected: false,
  );
}