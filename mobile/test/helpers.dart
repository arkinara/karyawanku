import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/api/models.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/connectivity/connectivity_provider.dart';
import 'package:karyawanku_mobile/core/location/location_service.dart';
import 'package:karyawanku_mobile/data/models.dart';
import 'package:karyawanku_mobile/data/repositories/payslip_file_store.dart';
import 'package:karyawanku_mobile/features/absensi/attendance_provider.dart';
import 'package:karyawanku_mobile/features/absensi/geofence_provider.dart';
import 'package:karyawanku_mobile/features/absensi/offline_queue_manager.dart';
import 'package:karyawanku_mobile/features/cuti/leave_provider.dart';
import 'package:karyawanku_mobile/features/jadwal/shift_provider.dart';
import 'package:karyawanku_mobile/features/slip/payslip_provider.dart';

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

/// Pin [isOnlineProvider] to a fixed verdict so no widget test touches the
/// platform connectivity channel. Defaults online.
Override onlineOverride([bool online = true]) =>
    isOnlineProvider.overrideWith(() => _ReadyOnline(online));

class _ReadyOnline extends OnlineNotifier {
  _ReadyOnline(this.online);
  final bool online;

  @override
  bool build() => online;
}

/// A queue whose store is never opened (no platform path) — shared widget
/// tests get no offline banner without touching sqflite/path_provider.
final closedQueueOverride = offlineQueueStoreProvider.overrideWith(
  (ref) async => throw UnimplementedError('queue closed in shared tests'),
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
      onlineOverride(true),
      closedQueueOverride,
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

/// Overrides that make every request fail fast — shared widget tests render
/// with these so no screen can start a real (timer-backed) HTTP request while
/// an un-pinned provider (e.g. the AjukanCuti shift-conflict fetch) reaches
/// for [ApiClient.instance].
List<Override> blockedNetworkOverrides() {
  final store = SecureSessionStore(backend: InMemoryBackend());
  final client = buildTestClient(
    store,
    (o) async => jsonErrorResponse('blocked', status: 503),
  );
  return [
    secureSessionStoreProvider.overrideWithValue(store),
    apiClientProvider.overrideWithValue(client),
    onlineOverride(true),
    closedQueueOverride,
  ];
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

/// Pin [shiftProvider] to a fixed state with no network work — shared widget
/// tests get a deterministic schedule instead of a live ApiClient reaching
/// for a blocked test HttpClient.
Override shiftOverride(ShiftState state) =>
    shiftProvider.overrideWith(() => _ReadyShift(state));

class _ReadyShift extends ShiftNotifier {
  _ReadyShift(this.initial);
  final ShiftState initial;

  @override
  ShiftState build() => initial;

  @override
  Future<void> loadMonth(DateTime month) async {}

  @override
  Future<void> loadWeek(DateTime weekStart) async {}

  @override
  Future<void> loadUpcoming({int days = 3}) async {}

  @override
  Future<void> loadLeaveBlocks() async {}

  @override
  void clearError() {}
}

/// Pin [leaveProvider] to a fixed state with no network work — shared widget
/// tests get a deterministic cuti screen instead of a live ApiClient reaching
/// for a blocked test HttpClient.
Override leaveOverride(LeaveState state) =>
    leaveProvider.overrideWith(() => _ReadyLeave(state));

class _ReadyLeave extends LeaveNotifier {
  _ReadyLeave(this.initial);
  final LeaveState initial;

  @override
  LeaveState build() => initial;

  @override
  Future<void> loadAll() async {}

  @override
  Future<void> submit({
    required String leaveTypeId,
    required DateTime tanggalMulai,
    required DateTime tanggalSelesai,
    required String alasan,
  }) async {}

  @override
  void clearActionError() {}
}

/// A populated [LeaveState] mirroring the seeded BE data, for the shared
/// widget tests so the cuti screens render their real content.
LeaveState sampleLeaveState() => LeaveState(
  balances: const [
    LeaveBalance(label: 'Tahunan', remaining: 8, total: 12, tahun: 2026),
    LeaveBalance(label: 'Sakit', remaining: 10, total: 12, tahun: 2026),
    LeaveBalance(label: 'Izin', remaining: 3, total: 4, tahun: 2026),
  ],
  requests: [
    LeaveRequest(
      id: 'r-1',
      leaveTypeName: 'Tahunan',
      status: LeaveStatus.menunggu,
      start: DateTime(2026, 9, 15),
      end: DateTime(2026, 9, 17),
      days: 3,
      reason: 'Acara keluarga di Bandung',
      submittedAt: DateTime(2026, 9, 13),
    ),
    LeaveRequest(
      id: 'r-2',
      leaveTypeName: 'Sakit',
      status: LeaveStatus.disetujui,
      start: DateTime(2026, 8, 12),
      end: DateTime(2026, 8, 12),
      days: 1,
      reason: 'Demam, ada surat dokter',
      submittedAt: DateTime(2026, 8, 11),
    ),
    LeaveRequest(
      id: 'r-3',
      leaveTypeName: 'Izin',
      status: LeaveStatus.ditolak,
      start: DateTime(2026, 7, 28),
      end: DateTime(2026, 7, 28),
      days: 1,
      reason: 'Keperluan pribadi',
      decisionNote: 'Catatan: shift sedang kekurangan orang, ajukan minggu depan.',
      submittedAt: DateTime(2026, 7, 27),
    ),
  ],
  leaveTypes: const [
    LeaveType(
      id: 'lt-1',
      nama: 'Tahunan',
      defaultKuotaHari: 12,
      kebijakanSisa: 'carry-over',
      carryOverMaxDays: 5,
      aktif: true,
    ),
    LeaveType(
      id: 'lt-2',
      nama: 'Sakit',
      defaultKuotaHari: 5,
      kebijakanSisa: 'hangus',
      aktif: true,
    ),
    LeaveType(
      id: 'lt-3',
      nama: 'Izin',
      defaultKuotaHari: 3,
      kebijakanSisa: 'hangus',
      aktif: true,
    ),
  ],
);

/// A roster row fixture mirroring the BE shift-assignment envelope. [tanggal]
/// defaults to `now` so tests never hardcode a month.
ShiftAssignment testShiftAssignment({
  DateTime? tanggal,
  String namaShift = 'Pagi',
  String jamMulai = '07:00',
  String jamSelesai = '15:00',
  bool published = true,
}) {
  return ShiftAssignment(
    id: 'sa-1',
    employeeId: 'emp-1',
    employeeName: 'Siti Nurhaliza',
    shiftId: 's-1',
    shift: Shift(
      id: 's-1',
      namaShift: namaShift,
      jamMulai: jamMulai,
      jamSelesai: jamSelesai,
      aktif: true,
    ),
    tanggal: tanggal ?? DateTime.now(),
    published: published,
  );
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

/// A payslip list row fixture mirroring `GET /payslips` items.
Payslip testPayslip({
  String id = 'ps-1',
  String periode = '2026-08',
  String status = 'disetujui',
  int takeHome = 4235000,
  String employeeName = 'Siti Nurhaliza',
  bool isThr = false,
}) {
  return Payslip(
    id: id,
    periode: periode,
    status: status,
    employeeName: employeeName,
    takeHome: takeHome,
    createdAt: DateTime.parse('2026-08-31T02:00:00.000Z'),
    isThr: isThr,
  );
}

/// A full payslip detail fixture mirroring `GET /payslips/:id` — lines and
/// totals as the server computed them (ticket #42).
PayslipDetail testPayslipDetail({
  String id = 'ps-1',
  String periode = '2026-08',
  String employeeName = 'Siti Nurhaliza',
  String jabatan = 'Kasir',
  int takeHome = 4235000,
  int totalEarnings = 5150000,
  int totalDeductions = 915000,
  List<PayslipLine>? earnings,
  List<PayslipLine>? deductions,
}) {
  return PayslipDetail(
    id: id,
    periode: periode,
    employeeName: employeeName,
    jabatan: jabatan,
    breakdown: PayslipBreakdown(
      earnings:
          earnings ??
          const [
            PayslipLine(namaKomponen: 'Gaji Pokok', nominal: 4200000),
            PayslipLine(namaKomponen: 'Tunjangan Makan', nominal: 500000),
            PayslipLine(namaKomponen: 'Tunjangan Transport', nominal: 300000),
            PayslipLine(namaKomponen: 'Lembur (6 jam)', nominal: 150000),
          ],
      deductions:
          deductions ??
          const [
            PayslipLine(namaKomponen: 'BPJS Kesehatan', nominal: 42000),
            PayslipLine(namaKomponen: 'BPJS JHT', nominal: 84000),
            PayslipLine(namaKomponen: 'BPJS JP', nominal: 42000),
            PayslipLine(namaKomponen: 'PPh 21', nominal: 747000),
          ],
      totals: PayslipTotals(
        totalEarnings: totalEarnings,
        totalDeductions: totalDeductions,
        takeHome: takeHome,
      ),
    ),
  );
}

/// Pin [payslipProvider] to a fixed state with no network work — shared widget
/// tests get a deterministic payslip screen instead of a live ApiClient.
Override payslipOverride(PayslipState state) =>
    payslipProvider.overrideWith(() => _ReadyPayslip(state));

class _ReadyPayslip extends PayslipNotifier {
  _ReadyPayslip(this.initial);
  final PayslipState initial;

  @override
  PayslipState build() => initial;

  @override
  Future<void> loadList({int? year}) async {}

  @override
  Future<void> loadLatest() async {}

  @override
  Future<void> select(String id) async {}

  @override
  Future<void> download(String id, {String fileName = 'slip-gaji.pdf'}) async {}

  @override
  void clearError() {}

  @override
  void clearMessage() {}
}

/// A populated [PayslipState] mirroring the seeded BE data, for the shared
/// widget tests so the payslip screens render their real content.
PayslipState samplePayslipState() => PayslipState(
  payslips: [
    testPayslip(
      id: 'ps-1',
      periode: '2026-08',
      takeHome: 4235000,
    ),
    testPayslip(
      id: 'ps-2',
      periode: '2026-07',
      takeHome: 4180000,
    ),
    testPayslip(
      id: 'ps-3',
      periode: '2026-03',
      takeHome: 4200000,
      isThr: true,
    ),
    testPayslip(
      id: 'ps-4',
      periode: '2025-12',
      takeHome: 4100000,
    ),
  ],
  latest: testPayslip(),
  // Pre-loaded detail so shared widget tests (a11y, stress) render the full
  // breakdown without a fetch and settle instead of spinning forever.
  selected: testPayslipDetail(),
  loading: false,
);

/// An in-memory [PayslipFileStore] recording writes instead of touching
/// platform channels — used by provider tests.
class FakePayslipFileStore implements PayslipFileStore {
  final saved = <String, Uint8List>{};
  final paths = <String>[];
  Object? throwOnSave;

  @override
  Future<String> saveAndShare(Uint8List bytes, String fileName) async {
    final error = throwOnSave;
    if (error != null) throw error;
    saved[fileName] = bytes;
    final path = '/documents/payslips/$fileName';
    paths.add(path);
    return path;
  }
}

/// A work-area point fixture mirroring the #67 geofence contract.
Geofence testGeofence({
  double workLat = -6.2088,
  double workLng = 106.8456,
  double radiusMeters = 100,
}) {
  return Geofence(workLat: workLat, workLng: workLng, radiusMeters: radiusMeters);
}

/// A device fix fixture (geolocator `Position`). [accuracy] drives the
/// low-accuracy verdict; pass 65 to stand in for a coarse fix.
Position testPosition({
  double latitude = -6.2088,
  double longitude = 106.8456,
  double accuracy = 5,
}) {
  return Position(
    latitude: latitude,
    longitude: longitude,
    timestamp: DateTime.utc(2026, 9, 3),
    accuracy: accuracy,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}

/// Pin [geofenceProvider] to a fixed state with no platform work — shared
/// widget tests get a deterministic chip instead of a live LocationService
/// reaching for a missing platform channel.
Override geofenceOverride(GeofenceState state) =>
    geofenceProvider.overrideWith(() => _ReadyGeofence(state));

class _ReadyGeofence extends GeofenceNotifier {
  _ReadyGeofence(this.initial);
  final GeofenceState initial;

  @override
  GeofenceState build() => initial;

  @override
  Future<void> ensurePermission() async {}

  @override
  Future<void> refresh() async {}

  @override
  GeofenceStatus evaluate({
    required Position user,
    required Geofence geofence,
  }) =>
      GeofenceStatus.inside;

  @override
  void clearNotice() {}
}

/// The four chip states, as the provider would produce them.
GeofenceState sampleGeofenceInside({int distance = 0}) => GeofenceState(
  permission: LocationPermissionStatus.granted,
  service: LocationServiceStatus.enabled,
  userLocation: testPosition(),
  geofence: testGeofence(),
  status: GeofenceStatus.inside,
  distanceMeters: distance,
);

GeofenceState sampleGeofenceOutside({int distance = 25}) => GeofenceState(
  permission: LocationPermissionStatus.granted,
  service: LocationServiceStatus.enabled,
  userLocation: testPosition(
    latitude: -6.2,
    longitude: 106.86,
  ),
  geofence: testGeofence(),
  status: GeofenceStatus.outside,
  distanceMeters: distance,
);

GeofenceState sampleGeofenceLowAccuracy({int accuracy = 65}) => GeofenceState(
  permission: LocationPermissionStatus.granted,
  service: LocationServiceStatus.enabled,
  userLocation: testPosition(accuracy: accuracy.toDouble()),
  geofence: testGeofence(),
  status: GeofenceStatus.lowAccuracy,
  distanceMeters: accuracy,
);

GeofenceState sampleGeofenceUnknown() => const GeofenceState();

GeofenceState sampleGeofenceAcquiring() =>
    const GeofenceState(acquiring: true);