import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_provider.dart';
import '../../data/models.dart';
import '../../data/repositories/leave_repository.dart';

/// Single [LeaveRepository] shared by the notifier and by tests.
final leaveRepositoryProvider = Provider<LeaveRepository>(
  (ref) => LeaveRepository(ref.watch(apiClientProvider)),
);

/// Live leave state for CutiScreen and the AjukanCutiScreen form. Balances,
/// requests and leave types all come from the BE; the signed-in employee is
/// resolved server-side from the JWT.
@immutable
class LeaveState {
  const LeaveState({
    this.balances = const [],
    this.requests = const [],
    this.leaveTypes = const [],
    this.loading = false,
    this.error,
    this.submitting = false,
    this.actionError,
  });

  /// The employee's quota rows for the current year.
  final List<LeaveBalance> balances;

  /// The employee's request history, newest first.
  final List<LeaveRequest> requests;

  /// The business's active leave types — the form's chips.
  final List<LeaveType> leaveTypes;

  /// True while [LeaveNotifier.loadAll] is in flight.
  final bool loading;

  /// Load failure message — surfaced with a retry action, never as zero data.
  final String? error;

  /// True while a submit is in flight; the form's button is disabled with a
  /// spinner while set.
  final bool submitting;

  /// One-shot message for a failed submit — surfaced as a snackbar.
  final String? actionError;

  int get pendingCount =>
      requests.where((r) => r.status == LeaveStatus.menunggu).length;

  LeaveState copyWith({
    List<LeaveBalance>? balances,
    List<LeaveRequest>? requests,
    List<LeaveType>? leaveTypes,
    bool? loading,
    String? error,
    bool clearError = false,
    bool? submitting,
    String? actionError,
    bool clearActionError = false,
  }) {
    return LeaveState(
      balances: balances ?? this.balances,
      requests: requests ?? this.requests,
      leaveTypes: leaveTypes ?? this.leaveTypes,
      loading: loading ?? this.loading,
      error: clearError ? null : error ?? this.error,
      submitting: submitting ?? this.submitting,
      // `actionError` is one-shot: it can only be cleared explicitly, because
      // a null here is indistinguishable from "leave it unchanged".
      actionError: clearActionError ? null : actionError ?? this.actionError,
    );
  }
}

final leaveProvider = NotifierProvider<LeaveNotifier, LeaveState>(
  LeaveNotifier.new,
);

/// Owns the leave data. [loadAll] runs on CutiScreen mount and after a
/// submit, so the list reconciles with what the server accepted.
class LeaveNotifier extends Notifier<LeaveState> {
  LeaveRepository get _repo => ref.read(leaveRepositoryProvider);

  @override
  LeaveState build() => const LeaveState();

  /// Fetch balances + requests + leave types in parallel. A failure in any one
  /// keeps whatever already loaded (so a partial load never blanked the
  /// screen) and stores the first failure message for a retry surface.
  Future<void> loadAll() async {
    state = state.copyWith(loading: true, clearError: true);
    final failures = <String>[];
    await Future.wait([
      _run(
        () => _repo.getBalances(),
        (value) => state = state.copyWith(balances: value),
        failures,
        'Gagal memuat saldo cuti',
      ),
      _run(
        () => _repo.getRequests(),
        (value) => state = state.copyWith(requests: value),
        failures,
        'Gagal memuat riwayat cuti',
      ),
      _run(
        () => _repo.getLeaveTypes(),
        (value) => state = state.copyWith(leaveTypes: value),
        failures,
        'Gagal memuat jenis cuti',
      ),
    ]);
    state = state.copyWith(
      loading: false,
      error: failures.isEmpty ? null : failures.first,
    );
  }

  /// `POST /leave-requests`, then refetch the request list so the new pending
  /// request appears immediately. Server rejections (422 over-balance,
  /// past start date, …) surface their Bahasa message verbatim in
  /// [LeaveState.actionError] — the form keeps its input.
  Future<void> submit({
    required String leaveTypeId,
    required DateTime tanggalMulai,
    required DateTime tanggalSelesai,
    required String alasan,
  }) async {
    if (state.submitting) return;
    state = state.copyWith(submitting: true, clearActionError: true);
    try {
      await _repo.submit(
        leaveTypeId: leaveTypeId,
        tanggalMulai: tanggalMulai,
        tanggalSelesai: tanggalSelesai,
        alasan: alasan,
      );
      await _refetchRequests();
      state = state.copyWith(submitting: false, actionError: null);
    } on ApiException catch (e) {
      state = state.copyWith(submitting: false, actionError: e.message);
    } catch (_) {
      state = state.copyWith(
        submitting: false,
        actionError: 'Gagal mengirim pengajuan',
      );
    }
  }

  Future<void> _refetchRequests() async {
    try {
      final requests = await _repo.getRequests();
      state = state.copyWith(requests: requests);
    } on ApiException catch (e) {
      state = state.copyWith(actionError: e.message);
    } catch (_) {
      state = state.copyWith(actionError: 'Gagal memuat riwayat cuti');
    }
  }

  Future<void> _run<T>(
    Future<T> Function() fetch,
    void Function(T) apply,
    List<String> failures,
    String fallback,
  ) async {
    try {
      apply(await fetch());
    } on ApiException catch (e) {
      failures.add(e.message);
    } catch (_) {
      failures.add(fallback);
    }
  }

  /// Clear the one-shot action error after the UI surfaced it as a snackbar.
  void clearActionError() {
    if (state.actionError != null) {
      state = state.copyWith(clearActionError: true);
    }
  }
}