import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/api/api_exception.dart';
import '../../data/models.dart';
import '../../data/repositories/notification_prefs_repository.dart';

final notificationPrefsRepositoryProvider = Provider<NotificationPrefsRepository>(
  (ref) => NotificationPrefsRepository(ref.watch(apiClientProvider)),
);

/// Lead times the Jadwal dropdown offers (must match the BE validation).
const reminderLeadOptions = [15, 30, 60];

@immutable
class NotificationPrefsState {
  const NotificationPrefsState({
    this.prefs,
    this.loading = false,
    this.error,
  });

  /// Null before the first successful load — the UI shows defaults
  /// (enabled, 30 minutes) and stays usable offline.
  final NotificationPrefs? prefs;
  final bool loading;
  final String? error;

  NotificationPrefsState copyWith({
    NotificationPrefs? prefs,
    bool? loading,
    String? error,
    bool clearError = false,
  }) {
    return NotificationPrefsState(
      prefs: prefs ?? this.prefs,
      loading: loading ?? this.loading,
      error: clearError ? null : error ?? this.error,
    );
  }
}

final notificationPrefsProvider =
    NotifierProvider<NotificationPrefsNotifier, NotificationPrefsState>(
  NotificationPrefsNotifier.new,
);

/// Owns the shift-reminder preference (ticket #71). The server is the source
/// of truth; failures degrade to the previous state / defaults and are
/// surfaced by the caller (the Jadwal toggle shows a snackbar).
class NotificationPrefsNotifier extends Notifier<NotificationPrefsState> {
  NotificationPrefsRepository get _repo =>
      ref.read(notificationPrefsRepositoryProvider);

  @override
  NotificationPrefsState build() => const NotificationPrefsState();

  Future<void> load() async {
    if (state.prefs != null) return;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final prefs = await _repo.getMy();
      state = NotificationPrefsState(prefs: prefs);
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Gagal memuat preferensi');
    }
  }

  Future<void> setEnabled(bool enabled) async {
    if (state.prefs?.shiftRemindersEnabled == enabled) return;
    final updated = await _repo.update(shiftRemindersEnabled: enabled);
    state = state.copyWith(prefs: updated, clearError: true);
  }

  Future<void> setLeadMinutes(int minutes) async {
    if (state.prefs?.reminderLeadMinutes == minutes) return;
    final updated = await _repo.update(reminderLeadMinutes: minutes);
    state = state.copyWith(prefs: updated, clearError: true);
  }

  void clearError() {
    if (state.error != null) state = state.copyWith(clearError: true);
  }
}