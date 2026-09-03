import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// Kind of queued attendance action (mirrors the BE `clock_in`/`clock_out`
/// endpoints).
enum QueuedAttendanceKind { clockIn, clockOut }

/// Lifecycle of a queued entry (ticket #70):
/// - [pending]: persisted, waiting for a flush;
/// - [inFlight]: a flush POST is in flight for this entry;
/// - [sent]: the server accepted it (2xx) — never replayed again;
/// - [permanentlyFailed]: the server rejected it (4xx/409) — surfaced to the
///   employee, only a manual retry can requeue it.
enum QueuedAttendanceStatus { pending, inFlight, sent, permanentlyFailed }

QueuedAttendanceStatus _statusFromDb(String raw) => switch (raw) {
  'in_flight' => QueuedAttendanceStatus.inFlight,
  'sent' => QueuedAttendanceStatus.sent,
  'permanently_failed' => QueuedAttendanceStatus.permanentlyFailed,
  _ => QueuedAttendanceStatus.pending,
};

String _statusToDb(QueuedAttendanceStatus status) => switch (status) {
  QueuedAttendanceStatus.pending => 'pending',
  QueuedAttendanceStatus.inFlight => 'in_flight',
  QueuedAttendanceStatus.sent => 'sent',
  QueuedAttendanceStatus.permanentlyFailed => 'permanently_failed',
};

/// One row of the offline queue. `id` is the row primary key (the client-side
/// idempotency key, so a replayed flush can never double-write). `actionAt` is
/// the moment the employee tapped, preserved and sent as
/// `client_timestamp` so the BE keeps the original action time (#59).
class QueuedAttendance {
  const QueuedAttendance({
    required this.id,
    required this.idempotencyKey,
    required this.actionAt,
    required this.kind,
    required this.status,
    this.error,
    this.lat,
    this.lng,
    this.accuracyM,
  });

  final String id;
  final String idempotencyKey;
  final DateTime actionAt;
  final QueuedAttendanceKind kind;
  final QueuedAttendanceStatus status;
  final String? error;
  final double? lat;
  final double? lng;
  final double? accuracyM;

  /// BE endpoint this entry maps to: `clock_in` / `clock_out`.
  String get endpoint =>
      kind == QueuedAttendanceKind.clockIn ? 'clock_in' : 'clock_out';

  bool get isPending =>
      status == QueuedAttendanceStatus.pending ||
      status == QueuedAttendanceStatus.inFlight;

  String get kindLabel =>
      kind == QueuedAttendanceKind.clockIn ? 'Clock In' : 'Clock Out';

  String get statusLabel => switch (status) {
    QueuedAttendanceStatus.pending => 'Pending',
    QueuedAttendanceStatus.inFlight => 'Mengirim…',
    QueuedAttendanceStatus.sent => 'Terkirim',
    QueuedAttendanceStatus.permanentlyFailed => 'Gagal',
  };

  factory QueuedAttendance.fromRow(Map<String, Object?> row) {
    return QueuedAttendance(
      id: row['id']! as String,
      idempotencyKey: row['idempotency_key']! as String,
      actionAt: DateTime.fromMillisecondsSinceEpoch(row['action_at']! as int),
      kind: row['kind'] == 'clock_in'
          ? QueuedAttendanceKind.clockIn
          : QueuedAttendanceKind.clockOut,
      status: _statusFromDb(row['status']! as String),
      error: row['error'] as String?,
      lat: (row['lat'] as num?)?.toDouble(),
      lng: (row['lng'] as num?)?.toDouble(),
      accuracyM: (row['accuracy_m'] as num?)?.toDouble(),
    );
  }
}

/// Durable SQLite queue (`karyawanku_offline.db` in the app documents dir).
///
/// Survives app restarts and device reboots. A single table, opened at
/// version 1 — migrations beyond that are additive only. Tests pass an
/// in-memory/temp path + a `sqflite_common_ffi` factory so no platform
/// channel is touched.
class OfflineQueue {
  OfflineQueue._(this._db);

  static const dbFileName = 'karyawanku_offline.db';
  static const _table = 'queued_attendance';

  final Database _db;

  static Future<OfflineQueue> open({
    DatabaseFactory? factory,
    String? path,
  }) async {
    final f = factory ?? databaseFactory;
    final resolved =
        path ??
        '${(await getApplicationDocumentsDirectory()).path}/$dbFileName';
    final db = await f.openDatabase(
      resolved,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (db, _) async {
          await db.execute('''
            CREATE TABLE $_table (
              id TEXT PRIMARY KEY,
              idempotency_key TEXT NOT NULL UNIQUE,
              action_at INTEGER NOT NULL,
              kind TEXT NOT NULL,
              status TEXT NOT NULL,
              error TEXT,
              lat REAL,
              lng REAL,
              accuracy_m REAL
            )
          ''');
        },
      ),
    );
    return OfflineQueue._(db);
  }

  /// Persist a new entry. The caller generates the idempotency key (UUID v4)
  /// and records the tap's action time; both ride along to the BE on flush.
  Future<QueuedAttendance> enqueue({
    required String idempotencyKey,
    required DateTime actionAt,
    required QueuedAttendanceKind kind,
    double? lat,
    double? lng,
    double? accuracyM,
  }) async {
    await _db.insert(_table, {
      'id': idempotencyKey,
      'idempotency_key': idempotencyKey,
      'action_at': actionAt.millisecondsSinceEpoch,
      'kind': kind == QueuedAttendanceKind.clockIn ? 'clock_in' : 'clock_out',
      'status': _statusToDb(QueuedAttendanceStatus.pending),
      'error': null,
      'lat': lat,
      'lng': lng,
      'accuracy_m': accuracyM,
    });
    return QueuedAttendance(
      id: idempotencyKey,
      idempotencyKey: idempotencyKey,
      actionAt: actionAt,
      kind: kind,
      status: QueuedAttendanceStatus.pending,
      lat: lat,
      lng: lng,
      accuracyM: accuracyM,
    );
  }

  /// Entries still waiting to be sent — `pending` + `in_flight`, oldest first.
  Future<List<QueuedAttendance>> pending() async {
    final rows = await _db.query(
      _table,
      where: "status IN ('pending', 'in_flight')",
      orderBy: 'action_at ASC',
    );
    return rows.map(QueuedAttendance.fromRow).toList();
  }

  /// Every entry (including sent + permanently failed), for the queue sheet.
  Future<List<QueuedAttendance>> all() async {
    final rows = await _db.query(_table, orderBy: 'action_at ASC');
    return rows.map(QueuedAttendance.fromRow).toList();
  }

  Future<void> markInFlight(String id) => _db.update(
    _table,
    {'status': _statusToDb(QueuedAttendanceStatus.inFlight)},
    where: 'id = ?',
    whereArgs: [id],
  );

  /// 2xx from the server — the entry is accepted and never replayed.
  Future<void> markSent(String id) => _db.update(
    _table,
    {'status': _statusToDb(QueuedAttendanceStatus.sent), 'error': null},
    where: 'id = ?',
    whereArgs: [id],
  );

  /// Permanent rejection (4xx/409) surfaces the server message and stops
  /// retrying; transient failures pass `permanent: false` and stay pending.
  Future<void> markFailed(String id, String error, {bool permanent = false}) =>
      _db.update(
        _table,
        {
          'status': permanent
              ? _statusToDb(QueuedAttendanceStatus.permanentlyFailed)
              : _statusToDb(QueuedAttendanceStatus.pending),
          'error': error,
        },
        where: 'id = ?',
        whereArgs: [id],
      );

  /// Manual retry: move a permanently failed entry back to pending.
  Future<void> markPending(String id) => _db.update(
    _table,
    {'status': _statusToDb(QueuedAttendanceStatus.pending), 'error': null},
    where: 'id = ?',
    whereArgs: [id],
  );

  /// Close the underlying database (tests simulate an app restart this way;
  /// production keeps it open for the app's lifetime).
  Future<void> close() => _db.close();
}
