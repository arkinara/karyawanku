import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/connectivity/connectivity_provider.dart';
import '../../data/local/offline_queue.dart';
import 'attendance_provider.dart';

/// The device SQLite queue. Opened lazily in the app documents directory; tests
/// override with an in-memory `sqflite_common_ffi` backend.
final offlineQueueStoreProvider = FutureProvider<OfflineQueue>(
  (ref) => OfflineQueue.open(),
);

/// Live view of the offline queue for the Absensi banner + queue sheet.
@immutable
class OfflineQueueState {
  const OfflineQueueState({
    this.entries = const [],
    this.online = true,
    this.flushing = false,
    this.loaded = false,
  });

  final List<QueuedAttendance> entries;

  /// Current connectivity verdict (mirrors [isOnlineProvider]).
  final bool online;

  /// True while a flush is in flight.
  final bool flushing;

  /// True once the queue has been read at least once.
  final bool loaded;

  int get pendingCount => entries.where((e) => e.isPending).length;

  bool get hasPending => pendingCount > 0;

  OfflineQueueState copyWith({
    List<QueuedAttendance>? entries,
    bool? online,
    bool? flushing,
    bool? loaded,
  }) {
    return OfflineQueueState(
      entries: entries ?? this.entries,
      online: online ?? this.online,
      flushing: flushing ?? this.flushing,
      loaded: loaded ?? this.loaded,
    );
  }
}

final offlineQueueManagerProvider =
    NotifierProvider<OfflineQueueManager, OfflineQueueState>(
      OfflineQueueManager.new,
    );

/// Flushes the durable queue on triggers — app foreground and connectivity
/// reconnecting (the Absensi screen wires the lifecycle side) — one entry at a
/// time, each POST carrying its `Idempotency-Key` so a lost response can never
/// double-write attendance.
///
/// Outcome handling:
/// - 2xx → [QueuedAttendanceStatus.sent] (never replayed);
/// - 4xx/409 → [QueuedAttendanceStatus.permanentlyFailed] (surfaced to the
///   employee, retry only manual — never retried forever);
/// - 5xx / network error → stays [QueuedAttendanceStatus.pending] and the next
///   trigger tries again.
///
/// Backoff: exponential, 2s → 4s → … → 60s, reset to 2s on a fully successful
/// flush. [delay] is injectable so tests run on a fake clock.
class OfflineQueueManager extends Notifier<OfflineQueueState> {
  OfflineQueueManager({Future<void> Function(int seconds)? delay})
    : _delay =
          delay ??
          ((seconds) => Future<void>.delayed(Duration(seconds: seconds)));

  static const minBackoffSeconds = 2;
  static const maxBackoffSeconds = 60;

  final Future<void> Function(int seconds) _delay;

  bool _flushing = false;
  int _backoffSeconds = minBackoffSeconds;
  bool _hadFailure = false;

  @override
  OfflineQueueState build() {
    // Seed with the current verdict (not only future changes): a flush on
    // mount must not run while the device is already offline.
    final currentOnline = ref.read(isOnlineProvider);
    // Reconnect → flush. Riverpod runs this listener on every online change;
    // the offline→online transition is the primary flush trigger.
    ref.listen(isOnlineProvider, (previous, next) {
      state = state.copyWith(online: next);
      if (next) flush();
    });
    _loadEntries();
    return OfflineQueueState(online: currentOnline);
  }

  Future<OfflineQueue?> _store() async {
    try {
      return await ref.read(offlineQueueStoreProvider.future);
    } catch (_) {
      // Queue unavailable (e.g. no platform path in tests) — stay idle.
      return null;
    }
  }

  /// Re-read every entry from the queue so the banner/sheet reflect reality.
  Future<void> reload() => _loadEntries();

  Future<void> _loadEntries() async {
    final store = await _store();
    if (store == null) {
      state = state.copyWith(loaded: true);
      return;
    }
    final entries = await store.all();
    state = state.copyWith(entries: entries, loaded: true);
  }

  /// Send every pending entry, oldest first, one at a time. No-op while a
  /// flush is already running or the device is offline.
  Future<void> flush() async {
    if (_flushing) return;
    if (!state.online) return;
    final store = await _store();
    if (store == null) return;

    _flushing = true;
    state = state.copyWith(flushing: true);
    try {
      final entries = await store.pending();
      if (entries.isEmpty) {
        _backoffSeconds = minBackoffSeconds;
        _hadFailure = false;
        return;
      }

      // After a failed flush, wait an exponential window before trying again.
      if (_hadFailure) await _delay(_backoffSeconds);

      var anySuccess = false;
      var anyFailure = false;
      for (final entry in entries) {
        if (!state.online) break; // went offline mid-flush — stop, keep pending
        await store.markInFlight(entry.id);

        try {
          await _submit(entry);
          await store.markSent(entry.id);
          anySuccess = true;
        } on ApiException catch (e) {
          if (e.status == 0 || e.status >= 500) {
            // Transport / server hiccup — leave pending, retry next trigger.
            await store.markFailed(entry.id, e.message, permanent: false);
            anyFailure = true;
            break;
          }
          // 4xx (incl. 409 duplicate-day) — permanent rejection. Surface the
          // message, never retry automatically.
          await store.markFailed(entry.id, e.message, permanent: true);
          anySuccess = true;
        } catch (_) {
          anyFailure = true;
          break;
        }

        // Gentle gap between entries so a long backlog doesn't hammer the BE.
        await _delay(1);
      }

      if (anyFailure) {
        _hadFailure = true;
        _backoffSeconds = (_backoffSeconds * 2).clamp(
          minBackoffSeconds,
          maxBackoffSeconds,
        );
      } else if (anySuccess) {
        _hadFailure = false;
        _backoffSeconds = minBackoffSeconds;
      }

      await _loadEntries();
    } finally {
      _flushing = false;
      state = state.copyWith(flushing: false);
    }
  }

  /// Manual retry for a [QueuedAttendanceStatus.permanentlyFailed] entry.
  Future<void> retry(String id) async {
    final store = await _store();
    if (store == null) return;
    await store.markPending(id);
    await _loadEntries();
    await flush();
  }

  Future<void> _submit(QueuedAttendance entry) {
    final repo = ref.read(attendanceRepositoryProvider);
    switch (entry.kind) {
      case QueuedAttendanceKind.clockIn:
        return repo.clockIn(
          clientTimestamp: entry.actionAt,
          submissionMethod: 'offline_queue',
          idempotencyKey: entry.idempotencyKey,
          lat: entry.lat,
          lng: entry.lng,
          accuracyM: entry.accuracyM,
        );
      case QueuedAttendanceKind.clockOut:
        return repo.clockOut(
          clientTimestamp: entry.actionAt,
          submissionMethod: 'offline_queue',
          idempotencyKey: entry.idempotencyKey,
          lat: entry.lat,
          lng: entry.lng,
          accuracyM: entry.accuracyM,
        );
    }
  }
}
