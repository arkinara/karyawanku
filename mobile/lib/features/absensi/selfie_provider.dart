import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/selfie/selfie_file_store.dart';
import '../../core/selfie/selfie_service.dart';
import '../../data/models.dart';
import '../../data/repositories/attendance_repository.dart';
import '../absensi/attendance_provider.dart';

/// Live selfie state for the Absensi slot (ticket #69). The capture pipeline is
/// on-device (permission → pick → compress); [SelfieState.compressedBytes] is
/// what gets uploaded, and on failure it is preserved for retry.
@immutable
class SelfieState {
  const SelfieState({
    this.permission = CameraPermission.denied,
    this.consentGranted = false,
    this.capturedFile,
    this.compressedBytes,
    this.uploading = false,
    this.error,
    this.lastUpload,
  });

  /// The platform's camera decision from the last request.
  final CameraPermission permission;

  /// True once the user has tapped "Saya Mengerti" on the consent dialog.
  final bool consentGranted;

  /// The picked camera file (pre-compression), kept for re-compress/retry.
  final File? capturedFile;

  /// JPEG bytes after on-device downscale — what [upload] sends.
  final Uint8List? compressedBytes;

  /// True while the multipart upload is in flight — the slot shows a spinner.
  final bool uploading;

  /// One-shot upload failure message (BE message verbatim, or a fallback).
  final String? error;

  /// Non-null once an upload succeeded — the slot renders the retention hint.
  final SelfieUpload? lastUpload;

  bool get hasCapture => compressedBytes != null;

  bool get uploaded => lastUpload != null;

  SelfieState copyWith({
    CameraPermission? permission,
    bool? consentGranted,
    File? capturedFile,
    Uint8List? compressedBytes,
    bool? uploading,
    String? error,
    SelfieUpload? lastUpload,
    bool clearCapture = false,
    bool clearUpload = false,
    bool clearError = false,
  }) {
    return SelfieState(
      permission: permission ?? this.permission,
      consentGranted: consentGranted ?? this.consentGranted,
      capturedFile: clearCapture ? null : capturedFile ?? this.capturedFile,
      compressedBytes: clearCapture
          ? null
          : compressedBytes ?? this.compressedBytes,
      uploading: uploading ?? this.uploading,
      error: clearError ? null : error ?? this.error,
      // `lastUpload` is sticky (the retention hint stays visible) until a new
      // capture explicitly clears it via [SelfieState.copyWith.clearUpload].
      lastUpload: clearUpload ? null : lastUpload ?? this.lastUpload,
    );
  }
}

final selfieProvider = NotifierProvider<SelfieNotifier, SelfieState>(
  SelfieNotifier.new,
);

/// Owns the selfie capture → compress → upload flow. Screens drive it from the
/// slot: permission is requested at the point of use (ticket #68 pattern) and
/// a denied permission is a state, never a crash — clock-in proceeds regardless.
class SelfieNotifier extends Notifier<SelfieState> {
  SelfieService get _service => ref.read(selfieServiceProvider);
  SelfieFileStore get _fileStore => ref.read(selfieFileStoreProvider);
  AttendanceRepository get _repo => ref.read(attendanceRepositoryProvider);

  @override
  SelfieState build() => const SelfieState();

  /// Mark consent as granted (persisted in secure storage by the caller, but
  /// reflected here immediately so the dialog is not shown twice in-session).
  void acknowledgeConsent() {
    state = state.copyWith(consentGranted: true);
  }

  /// Request camera permission → capture → compress. Returns the captured
  /// [File] when a selfie is now ready, or `null` when the user cancelled or
  /// the permission was denied. A denial updates [SelfieState.permission] so
  /// the screen can show the "Selfie dilewati" fallback.
  Future<File?> capture() async {
    final permission = await _service.requestCameraPermission();
    state = state.copyWith(permission: permission, clearError: true);
    if (!permission.canUse) return null;

    final file = await _service.captureSelfie();
    if (file == null) return null; // user cancelled the camera sheet

    final acceptable = await _service.isAcceptable(file);
    if (!acceptable) {
      state = state.copyWith(
        error: 'File tidak didukung. Gunakan foto JPG/PNG di bawah 5 MB.',
      );
      return null;
    }

    final bytes = await _service.compress(file);
    state = state.copyWith(
      capturedFile: file,
      compressedBytes: bytes,
      clearUpload: true,
      clearError: true,
    );
    return file;
  }

  /// Discard the captured selfie (user cancelled the preview).
  void clear() {
    state = state.copyWith(clearCapture: true, clearError: true);
  }

  /// Upload the compressed selfie to an attendance record. On success the
  /// capture is discarded and [SelfieState.lastUpload] carries the server's
  /// retention; on failure the capture is preserved for retry.
  Future<void> upload(String attendanceId) async {
    final bytes = state.compressedBytes;
    if (bytes == null || state.uploading) return;
    state = state.copyWith(uploading: true, clearError: true);
    try {
      final file = await _fileStore.writeCompressed(
        bytes,
        name: 'selfie_$attendanceId.jpg',
      );
      final upload = await _repo.uploadSelfie(
        attendanceId: attendanceId,
        file: file,
      );
      state = state.copyWith(
        uploading: false,
        lastUpload: upload,
        clearCapture: true,
      );
    } on ApiException catch (e) {
      state = state.copyWith(uploading: false, error: e.message);
    } catch (_) {
      state = state.copyWith(
        uploading: false,
        error: 'Gagal mengunggah selfie',
      );
    }
  }
}
