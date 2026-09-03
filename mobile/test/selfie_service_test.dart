import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:karyawanku_mobile/core/selfie/selfie_service.dart';

/// A real JPEG on disk (the `image` package is pure Dart, so it decodes fine
/// in flutter_test).
Future<File> makeJpegFile({int width = 1000, int height = 500}) async {
  final image = img.Image(width: width, height: height);
  img.fill(image, color: img.ColorRgb8(200, 80, 60));
  final jpeg = img.encodeJpg(image, quality: 90);
  final file = File(
    '${Directory.systemTemp.path}/service_selfie_${DateTime.now().microsecondsSinceEpoch}.jpg',
  );
  await file.writeAsBytes(jpeg);
  return file;
}

SelfieService buildService({
  Future<PermissionStatus> Function()? permissionRequester,
  Future<XFile?> Function(
    ImageSource source, {
    int? imageQuality,
    CameraDevice? preferredCameraDevice,
  })? pickImage,
}) {
  return SelfieService(
    permissionRequester: permissionRequester ?? () async => PermissionStatus.granted,
    pickImage: pickImage ??
        (source, {imageQuality, preferredCameraDevice}) async => null,
  );
}

void main() {
  group('captureSelfie', () {
    test('returns null when the user cancels the camera sheet', () async {
      final service = buildService(pickImage: (
        source, {
        imageQuality,
        preferredCameraDevice,
      }) async => null);

      final file = await service.captureSelfie();

      expect(file, isNull);
    });

    test('prefers the front camera and returns a File', () async {
      final fileOnDisk = await makeJpegFile();
      CameraDevice? requestedDevice;
      final service = buildService(pickImage: (source, {
        imageQuality,
        preferredCameraDevice,
      }) async {
        requestedDevice = preferredCameraDevice;
        return XFile(fileOnDisk.path);
      });

      final file = await service.captureSelfie();

      expect(requestedDevice, CameraDevice.front);
      expect(file, isNotNull);
      expect(file!.path, fileOnDisk.path);
    });
  });

  group('compress', () {
    test('downscales a wide image to the max width and stays JPEG', () async {
      final file = await makeJpegFile(width: 1000, height: 500);
      final service = buildService();

      final bytes = await service.compress(file);

      final decoded = img.decodeJpg(bytes);
      expect(decoded, isNotNull);
      expect(decoded!.width, lessThanOrEqualTo(SelfieService.kMaxWidth));
      // Aspect ratio is preserved: 1000x500 → 720x360.
      expect(decoded.width, SelfieService.kMaxWidth);
      expect(decoded.height, lessThan(decoded.width));
    });

    test('keeps a small image unchanged (no enlargement)', () async {
      final file = await makeJpegFile(width: 400, height: 300);
      final service = buildService();

      final bytes = await service.compress(file);

      final decoded = img.decodeJpg(bytes);
      expect(decoded!.width, 400);
      expect(decoded.height, 300);
    });

    test('throws SelfieException for non-image bytes', () async {
      final file = File(
        '${Directory.systemTemp.path}/not_an_image_${DateTime.now().microsecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes([1, 2, 3, 4, 5]);
      final service = buildService();

      expect(service.compress(file), throwsA(isA<SelfieException>()));
    });
  });

  group('isAcceptable', () {
    test('accepts a normal-size JPEG', () async {
      final file = await makeJpegFile();
      final service = buildService();

      expect(await service.isAcceptable(file), isTrue);
    });

    test('rejects a non-image extension', () async {
      final file = File(
        '${Directory.systemTemp.path}/notes_${DateTime.now().microsecondsSinceEpoch}.txt',
      );
      await file.writeAsString('hello');
      final service = buildService();

      expect(await service.isAcceptable(file), isFalse);
    });

    test('rejects an oversized file', () async {
      final file = File(
        '${Directory.systemTemp.path}/huge_${DateTime.now().microsecondsSinceEpoch}.jpg',
      );
      // 6 MB > the 5 MB pre-compression gate.
      await file.writeAsBytes(List.filled(6 * 1024 * 1024, 0));
      final service = buildService();

      expect(await service.isAcceptable(file), isFalse);
    });
  });

  group('requestCameraPermission', () {
    test('maps granted → canUse', () async {
      final service = buildService(
        permissionRequester: () async => PermissionStatus.granted,
      );

      final permission = await service.requestCameraPermission();

      expect(permission, CameraPermission.granted);
      expect(permission.canUse, isTrue);
    });

    test('maps permanentlyDenied → not usable', () async {
      final service = buildService(
        permissionRequester: () async => PermissionStatus.permanentlyDenied,
      );

      final permission = await service.requestCameraPermission();

      expect(permission, CameraPermission.permanentlyDenied);
      expect(permission.canUse, isFalse);
    });
  });
}