import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_provider.dart';
import '../../data/models.dart';
import '../../data/repositories/payslip_file_store.dart';
import '../../data/repositories/payslip_repository.dart';

/// Single [PayslipRepository] shared by the notifier and by tests.
final payslipRepositoryProvider = Provider<PayslipRepository>(
  (ref) => PayslipRepository(ref.watch(apiClientProvider)),
);

/// Device file save + share, injectable so tests avoid platform channels.
final payslipFileStoreProvider = Provider<PayslipFileStore>(
  (ref) => const PayslipFileStore(),
);

/// Payslip state for SlipGajiScreen, SlipDetailScreen and the Beranda latest
/// row. The server is the source of truth for every number: the list carries
/// only summaries, and the detail's earnings/deductions/totals are rendered
/// verbatim from `GET /payslips/:id` — the client never sums a payslip.
@immutable
class PayslipState {
  const PayslipState({
    this.payslips = const [],
    this.latest,
    this.selected,
    this.loading = false,
    this.error,
    this.detailError,
    this.downloading = false,
    this.message,
  });

  /// The signed-in employee's payslips, newest first.
  final List<Payslip> payslips;

  /// The single most recent payslip (`getPayslips(limit: 1)`) for Beranda's
  /// "Slip gaji terakhir" row — independent of the full list.
  final Payslip? latest;

  /// The full detail for the payslip the user opened, or null while loading.
  final PayslipDetail? selected;

  /// True while the list fetch is in flight.
  final bool loading;

  /// List load failure — shown as a full error surface with retry, never as
  /// zero data.
  final String? error;

  /// Detail load failure — shown on SlipDetailScreen with retry.
  final String? detailError;

  /// True while a PDF download + save is in flight; the download button is
  /// disabled with a spinner.
  final bool downloading;

  /// One-shot message surfaced as a snackbar: download success
  /// ("Slip gaji tersimpan") or the BE's failure message.
  final String? message;

  PayslipState copyWith({
    List<Payslip>? payslips,
    Payslip? latest,
    PayslipDetail? selected,
    bool? loading,
    String? error,
    bool clearError = false,
    String? detailError,
    bool clearDetailError = false,
    bool? downloading,
    String? message,
    bool clearMessage = false,
  }) {
    return PayslipState(
      payslips: payslips ?? this.payslips,
      latest: latest ?? this.latest,
      selected: selected ?? this.selected,
      loading: loading ?? this.loading,
      error: clearError ? null : error ?? this.error,
      detailError: clearDetailError ? null : detailError ?? this.detailError,
      downloading: downloading ?? this.downloading,
      // `message` is one-shot: it can only be cleared explicitly, because a
      // null here is indistinguishable from "leave it unchanged".
      message: clearMessage ? null : message ?? this.message,
    );
  }
}

final payslipProvider = NotifierProvider<PayslipNotifier, PayslipState>(
  PayslipNotifier.new,
);

/// Owns the payslip list, the opened detail and the download lifecycle.
class PayslipNotifier extends Notifier<PayslipState> {
  PayslipRepository get _repo => ref.read(payslipRepositoryProvider);
  PayslipFileStore get _files => ref.read(payslipFileStoreProvider);

  @override
  PayslipState build() => const PayslipState(loading: true);

  /// `GET /payslips` — the employee's payslips, newest first. The optional
  /// [year] narrows the fetch; the screen's year chips are derived from the
  /// full list it renders. A failure lands in [PayslipState.error] so the UI
  /// offers retry instead of showing a zero-rupiah card.
  Future<void> loadList({int? year}) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final payslips = await _repo.getPayslips(year: year);
      state = state.copyWith(payslips: payslips, loading: false, error: null);
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Gagal memuat slip gaji');
    }
  }

  /// `GET /payslips?limit=1` — the latest payslip for Beranda's
  /// "Slip gaji terakhir" row. A failure keeps whatever was loaded; the row
  /// simply does not render.
  Future<void> loadLatest() async {
    try {
      final list = await _repo.getPayslips(limit: 1);
      state = state.copyWith(
        latest: list.isNotEmpty ? list.first : null,
        error: null,
      );
    } on ApiException {
      // Secondary to the home screen — keep the current row.
    } catch (_) {
      // Transport failure — same, no UI action.
    }
  }

  /// `GET /payslips/:id` — the full breakdown for the opened payslip. The
  /// detail screen renders the server's lines and totals verbatim.
  Future<void> select(String id) async {
    state = state.copyWith(selected: null, clearDetailError: true);
    try {
      final detail = await _repo.getPayslip(id);
      state = state.copyWith(selected: detail, detailError: null);
    } on ApiException catch (e) {
      state = state.copyWith(detailError: e.message);
    } catch (_) {
      state = state.copyWith(detailError: 'Gagal memuat rincian slip gaji');
    }
  }

  /// `GET /payslips/:id/download` → save the PDF to the device (`payslips/`
  /// under the app documents directory) → open the platform share sheet. The
  /// button stays disabled while [PayslipState.downloading] is set; success
  /// and failure both surface through [PayslipState.message] as a snackbar.
  Future<void> download(String id, {String fileName = 'slip-gaji.pdf'}) async {
    if (state.downloading) return;
    state = state.copyWith(downloading: true, clearMessage: true);
    try {
      final bytes = await _repo.downloadPayslip(id, fileName: fileName);
      await _files.saveAndShare(bytes, fileName);
      state = state.copyWith(
        downloading: false,
        message: 'Slip gaji tersimpan',
      );
    } on ApiException catch (e) {
      state = state.copyWith(downloading: false, message: e.message);
    } catch (_) {
      state = state.copyWith(
        downloading: false,
        message: 'Gagal mengunduh slip gaji',
      );
    }
  }

  /// Clear the list-load error after the UI surfaced it.
  void clearError() {
    if (state.error != null) state = state.copyWith(clearError: true);
  }

  /// Clear the one-shot snackbar message after the UI showed it.
  void clearMessage() {
    if (state.message != null) state = state.copyWith(clearMessage: true);
  }
}
