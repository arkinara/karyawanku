import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

/// Camera permission state. Mirrors the platform's decision at the point of
/// use — never derived from what the app expects. `granted` and `limited`
/// (iOS) both allow capture; everything else means "cannot open the camera".
enum CameraPermission {
  granted,
  denied,
  permanentlyDenied,
  restricted,
  limited;

  /// True when the OS allows the app to open the camera.
  bool get canUse => this == granted || this == limited;
}

/// Failures from the selfie pipeline that are not API errors — a corrupt or
/// unsupported image, a permission the user cannot recover from.
class SelfieException implements Exception {
  const SelfieException(this.message);

  final String message;

  @override
  String toString() => 'SelfieException($message)';
}

/// Injectable calls behind the plugin surfaces so tests can simulate the
/// platform channels (no emulator/simulator on CI). Defaults are the real
/// `permission_handler` / `image_picker` calls.
typedef CameraPermissionRequester = Future<ph.PermissionStatus> Function();
typedef PickImageFn =
    Future<XFile?> Function(
      ImageSource source, {
      int? imageQuality,
      CameraDevice? preferredCameraDevice,
    });

/// Single [SelfieService] shared by the provider and by tests.
final selfieServiceProvider = Provider<SelfieService>((ref) => SelfieService());

/// Front-camera selfie capture for clock-in verification (ticket #69).
///
/// Everything is on-device and privacy-first:
/// - capture uses the **front** camera (`CameraDevice.front`);
/// - [compress] downsizes to a maximum of [maxWidth] px and re-encodes as
///   JPEG at [quality], which also drops EXIF (GPS) metadata;
/// - [isAcceptable] rejects files that are too large or not an image.
class SelfieService {
  SelfieService({
    CameraPermissionRequester? permissionRequester,
    PickImageFn? pickImage,
  }) : _permissionRequester =
           permissionRequester ?? _defaultPermissionRequester,
       _pickImage = pickImage ?? _defaultPickImage;

  final CameraPermissionRequester _permissionRequester;
  final PickImageFn _pickImage;

  /// Maximum on-device width after downscaling — the BE compresses again to
  /// the same bound, so the two never fight over a larger intermediate file.
  static const kMaxWidth = 720;

  /// JPEG quality after on-device compression.
  static const kQuality = 75;

  /// Pre-compression file size limit: an oversized source is rejected before
  /// any decode work is wasted (5 MB, generous for a camera capture).
  static const kMaxSourceBytes = 5 * 1024 * 1024;

  /// Ask the user for camera access. Returns the platform's decision.
  Future<CameraPermission> requestCameraPermission() async =>
      _mapPermission(await _permissionRequester());

  /// Open the front camera and return the captured file, or `null` when the
  /// user cancels. Throws [SelfieException] only for hard failures; a denied
  /// permission surfaces through [CameraPermission] on the provider state.
  Future<File?> captureSelfie({ImageSource source = ImageSource.camera}) async {
    final file = await _pickImage(
      source,
      imageQuality: 92,
      preferredCameraDevice: CameraDevice.front,
    );
    return file == null ? null : File(file.path);
  }

  /// Downscale + re-encode to JPEG. Returns compressed bytes; the on-device
  /// encode also strips EXIF (GPS) metadata from the output.
  Future<Uint8List> compress(
    File file, {
    int maxWidth = kMaxWidth,
    int quality = kQuality,
  }) async {
    final bytes = await file.readAsBytes();
    final img.Image? decoded;
    try {
      decoded = img.decodeImage(bytes);
    } catch (_) {
      // Garbage bytes can throw instead of returning null.
      throw const SelfieException('Gagal membaca gambar');
    }
    if (decoded == null) {
      throw const SelfieException('Gagal membaca gambar');
    }
    final resized = decoded.width > maxWidth
        ? img.copyResize(decoded, width: maxWidth)
        : decoded;
    return img.encodeJpg(resized, quality: quality);
  }

  /// Cheap gate before decode/upload: known image extension + under 5 MB.
  Future<bool> isAcceptable(File file) async {
    final ext = file.path.toLowerCase();
    final imageExtension =
        ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png');
    if (!imageExtension) return false;
    final size = await file.length();
    return size <= kMaxSourceBytes;
  }

  static Future<ph.PermissionStatus> _defaultPermissionRequester() =>
      ph.Permission.camera.request();

  static Future<XFile?> _defaultPickImage(
    ImageSource source, {
    int? imageQuality,
    CameraDevice? preferredCameraDevice,
  }) {
    return ImagePicker().pickImage(
      source: source,
      imageQuality: imageQuality,
      preferredCameraDevice: preferredCameraDevice ?? CameraDevice.rear,
    );
  }

  CameraPermission _mapPermission(ph.PermissionStatus status) =>
      switch (status) {
        ph.PermissionStatus.granted => CameraPermission.granted,
        ph.PermissionStatus.permanentlyDenied =>
          CameraPermission.permanentlyDenied,
        ph.PermissionStatus.restricted => CameraPermission.restricted,
        ph.PermissionStatus.limited => CameraPermission.limited,
        _ => CameraPermission.denied,
      };
}
