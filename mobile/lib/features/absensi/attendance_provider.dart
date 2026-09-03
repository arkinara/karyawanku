import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_provider.dart';
import '../../data/models.dart';
import '../../data/repositories/attendance_repository.dart';
import 'geofence_provider.dart';

/// Single [AttendanceRepository] shared by the notifier and by tests.
final attendanceRepositoryProvider = Provider<AttendanceRepository>(
  (ref) => AttendanceRepository(ref.watch(apiClientProvider)),
);

/// Live attendance state for the employee-facing screens. `today` and
/// `aggregate` come from the BE; the wall clock is the device clock and only
/// drives elapsed display (the authoritative clock-in time is the server's).
@immutable
class AttendanceState {
  const AttendanceState({
    this.today,
    this.aggregate,
    this.loading = false,
    this.error,
    this.submitting = false,
    this.actionError,
  });

  /// Today's record, or null before the first successful load and when the
  /// employee has not clocked in yet.
  final TodayAttendance? today;

  /// Current-month totals, or null before the first successful load.
  final AttendanceAggregate? aggregate;

  /// True while a load is in flight. The screen shows skeletons only when
  /// there is no data yet, so a background reload never flashes one.
  final bool loading;

  /// Load failure message — shown as a full error state with retry.
  final String? error;

  /// True while a clock-in / clock-out write is in flight. The primary button
  /// is disabled and shows a spinner while this is set.
  final bool submitting;

  /// One-shot message for a failed clock action — surfaced as a snackbar.
  final String? actionError;

  AttendanceState copyWith({
    TodayAttendance? today,
    AttendanceAggregate? aggregate,
    bool? loading,
    String? error,
    bool? submitting,
    String? actionError,
    bool clearActionError = false,
  }) {
    return AttendanceState(
      today: today ?? this.today,
      aggregate: aggregate ?? this.aggregate,
      loading: loading ?? this.loading,
      error: error ?? this.error,
      submitting: submitting ?? this.submitting,
      // `actionError` is one-shot: it can only be cleared explicitly, because
      // a null here is indistinguishable from "leave it unchanged".
      actionError: clearActionError ? null : actionError ?? this.actionError,
    );
  }
}

final attendanceProvider =
    NotifierProvider<AttendanceNotifier, AttendanceState>(
      AttendanceNotifier.new,
    );

/// Owns today's record and the monthly aggregate, and performs clock in/out.
/// Screens call [loadToday] + [loadAggregate] on mount and on resume, so the
/// state reflects what the server believes about today as the shift runs.
class AttendanceNotifier extends Notifier<AttendanceState> {
  AttendanceRepository get _repo => ref.read(attendanceRepositoryProvider);

  /// The signed-in employee's id; `null` for owners/managers with no linked
  /// record (the aggregate endpoints still work for them, but a clock action
  /// would be a 422 — surfaced verbatim).
  String? get _employeeId => ref.read(authProvider).user?.employeeId;

  @override
  AttendanceState build() => const AttendanceState(loading: true);

  /// Fetch today's record. Sets [AttendanceState.loading] so the initial
  /// skeleton shows; a failure lands in [AttendanceState.error].
  Future<void> loadToday() async {
    state = state.copyWith(loading: true, error: null);
    try {
      final today = await _repo.getToday();
      state = state.copyWith(today: today, loading: false, error: null);
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Gagal memuat absensi');
    }
  }

  /// Fetch the current month's aggregate for the signed-in employee. Fails
  /// silently — the tiles are secondary to the clock screen, so a load error
  /// here must not block the timeline or the clock-in button.
  Future<void> loadAggregate() async {
    final employeeId = _employeeId;
    if (employeeId == null) return;
    final now = DateTime.now();
    try {
      final aggregate = await _repo.getAggregate(
        employeeId: employeeId,
        year: now.year,
        month: now.month,
      );
      state = state.copyWith(aggregate: aggregate);
    } on ApiException {
      // Keep the previous aggregate; the tiles may simply stay empty.
    } catch (_) {
      // Transport failure — same, no UI action.
    }
  }

  /// `loadToday` + `loadAggregate` — the "on mount / on resume" refresh.
  Future<void> refresh() => Future.wait([loadToday(), loadAggregate()]);

  /// Clock in. On success today's record is refetched so the timeline and
  /// hero reconcile with the server's authoritative stamp. Server rejections
  /// (409 already clocked in, 422 no shift, 403 no linked employee) surface
  /// their Bahasa message verbatim in [AttendanceState.actionError].
  ///
  /// The device's latest fix (from the geofence chip) is attached to the
  /// payload; null when there is no fix — the BE accepts null, so a basement
  /// or a denied permission never blocks the clock-in.
  Future<void> clockIn() {
    final location = ref.read(geofenceProvider).userLocation;
    return _submit(
      (clientTimestamp) => _repo.clockIn(
        clientTimestamp: clientTimestamp,
        lat: location?.latitude,
        lng: location?.longitude,
        accuracyM: location?.accuracy,
      ),
    );
  }

  /// Clock out — same contract as [clockIn].
  Future<void> clockOut() {
    final location = ref.read(geofenceProvider).userLocation;
    return _submit(
      (clientTimestamp) => _repo.clockOut(
        clientTimestamp: clientTimestamp,
        lat: location?.latitude,
        lng: location?.longitude,
        accuracyM: location?.accuracy,
      ),
    );
  }

  Future<void> _submit(
    Future<void> Function(DateTime clientTimestamp) action,
  ) async {
    if (state.submitting) return;
    state = state.copyWith(submitting: true, clearActionError: true);
    try {
      await action(DateTime.now());
      await _refetchToday();
      state = state.copyWith(submitting: false, actionError: null);
    } on ApiException catch (e) {
      state = state.copyWith(submitting: false, actionError: e.message);
    } catch (_) {
      state = state.copyWith(
        submitting: false,
        actionError: 'Gagal mencatat absensi',
      );
    }
  }

  /// Silent refetch of today's record — no skeleton, keeps the current
  /// timeline visible while it reconciles.
  Future<void> _refetchToday() async {
    try {
      final today = await _repo.getToday();
      state = state.copyWith(today: today);
    } on ApiException catch (e) {
      state = state.copyWith(actionError: e.message);
    } catch (_) {
      state = state.copyWith(actionError: 'Gagal memuat absensi');
    }
  }

  /// Clear the one-shot action error after the UI surfaced it as a snackbar.
  void clearActionError() {
    if (state.actionError != null) {
      state = state.copyWith(clearActionError: true);
    }
  }
}