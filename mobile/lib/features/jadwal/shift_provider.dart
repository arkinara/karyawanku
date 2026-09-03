import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_provider.dart';
import '../../data/models.dart';
import '../../data/repositories/leave_repository.dart';
import '../../data/repositories/shift_repository.dart';
import '../cuti/leave_provider.dart';

/// Single [ShiftRepository] shared by the notifier and by tests.
final shiftRepositoryProvider = Provider<ShiftRepository>(
  (ref) => ShiftRepository(ref.watch(apiClientProvider)),
);

/// Live roster state for JadwalScreen and the Beranda upcoming list.
///
/// Assignments are keyed by date (date-only, no time component) so both the
/// week strip and the month grid look up a day in O(1), and already-fetched
/// ranges never trigger a second request.
@immutable
class ShiftState {
  const ShiftState({
    this.assignmentsByDate = const {},
    this.leaveBlockedDates = const {},
    this.upcoming = const [],
    this.loading = false,
    this.error,
  });

  /// Published assignments indexed by their date-only key.
  final Map<DateTime, ShiftAssignment> assignmentsByDate;

  /// Dates covered by a pending or approved leave request — rendered amber in
  /// the calendar instead of the shift that may still sit under it.
  final Set<DateTime> leaveBlockedDates;

  /// The next-days roster for Beranda's "Jadwal 3 hari ke depan" list.
  final List<ShiftAssignment> upcoming;

  /// True while a range fetch is in flight. The screens keep showing whatever
  /// is already loaded; this only drives the initial skeleton.
  final bool loading;

  /// Most recent load failure message. A failed range fetch never blanks the
  /// screen — the previous data stays and the UI offers retry.
  final String? error;

  ShiftState copyWith({
    Map<DateTime, ShiftAssignment>? assignmentsByDate,
    Set<DateTime>? leaveBlockedDates,
    List<ShiftAssignment>? upcoming,
    bool? loading,
    String? error,
    bool clearError = false,
  }) {
    return ShiftState(
      assignmentsByDate: assignmentsByDate ?? this.assignmentsByDate,
      leaveBlockedDates: leaveBlockedDates ?? this.leaveBlockedDates,
      upcoming: upcoming ?? this.upcoming,
      loading: loading ?? this.loading,
      error: clearError ? null : error ?? this.error,
    );
  }
}

final shiftProvider =
    NotifierProvider<ShiftNotifier, ShiftState>(ShiftNotifier.new);

/// Owns the roster for the visible ranges. Ranges are memoized by their
/// `(start, end)` tuple, so paging back to an already-loaded month is a
/// no-op — no duplicate request, no loading flash.
class ShiftNotifier extends Notifier<ShiftState> {
  ShiftRepository get _repo => ref.read(shiftRepositoryProvider);
  LeaveRepository get _leaveRepo => ref.read(leaveRepositoryProvider);

  final Set<(DateTime, DateTime)> _fetchedRanges = {};
  bool _leaveFetched = false;

  @override
  ShiftState build() => const ShiftState();

  static DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  /// Fetch every assignment in [month] (first to last day). Cached by range.
  Future<void> loadMonth(DateTime month) => _loadRange(
    DateTime(month.year, month.month, 1),
    DateTime(month.year, month.month + 1, 0),
  );

  /// Fetch the Monday–Sunday week starting at [weekStart]. Cached by range.
  Future<void> loadWeek(DateTime weekStart) {
    final start = dateOnly(weekStart);
    return _loadRange(start, start.add(const Duration(days: 6)));
  }

  Future<void> _loadRange(DateTime start, DateTime end) async {
    final key = (start, end);
    if (_fetchedRanges.contains(key)) return;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final assignments = await _repo.getAssignments(
        start: start,
        end: end,
      );
      final byDate = Map<DateTime, ShiftAssignment>.from(
        state.assignmentsByDate,
      );
      for (final a in assignments) {
        byDate[dateOnly(a.tanggal)] = a;
      }
      _fetchedRanges.add(key);
      state = state.copyWith(
        assignmentsByDate: byDate,
        loading: false,
        error: null,
      );
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Gagal memuat jadwal');
    }
  }

  /// Fetch the Beranda "Jadwal N hari ke depan" roster from
  /// `/shift-assignments/upcoming`. Runs on mount; not range-cached.
  Future<void> loadUpcoming({int days = 3}) async {
    try {
      final list = await _repo.getUpcoming(days: days);
      state = state.copyWith(upcoming: list, error: null);
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
    } catch (_) {
      state = state.copyWith(error: 'Gagal memuat jadwal ke depan');
    }
  }

  /// Mark leave-blocked days from real leave requests (fetched once). A
  /// failure is swallowed — the decoration is secondary to the roster.
  Future<void> loadLeaveBlocks() async {
    if (_leaveFetched) return;
    _leaveFetched = true;
    try {
      final requests = await _leaveRepo.getRequests();
      final blocked = <DateTime>{};
      for (final r in requests) {
        if (r.status == LeaveStatus.ditolak) continue;
        var d = dateOnly(r.start);
        final end = dateOnly(r.end);
        while (!d.isAfter(end)) {
          blocked.add(d);
          d = d.add(const Duration(days: 1));
        }
      }
      state = state.copyWith(leaveBlockedDates: blocked);
    } on ApiException {
      // Leave blocks are a best-effort decoration — keep the roster.
    } catch (_) {
      // Transport failure — same, no UI action.
    }
  }

  /// Clear the one-shot error after the UI surfaced it as a snackbar.
  void clearError() {
    if (state.error != null) state = state.copyWith(clearError: true);
  }
}