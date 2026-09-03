import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:karyawanku_mobile/core/api/api_client.dart';
import 'package:karyawanku_mobile/core/auth/auth_provider.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/selfie/selfie_file_store.dart';
import 'package:karyawanku_mobile/core/selfie/selfie_service.dart';
import 'package:karyawanku_mobile/features/absensi/selfie_provider.dart';

import 'helpers.dart';

Future<File> makeJpegFile() async {
  final image = img.Image(width: 800, height: 600);
  img.fill(image, color: img.ColorRgb8(40, 140, 90));
  final jpeg = img.encodeJpg(image, quality: 90);
  final file = File(
    '${Directory.systemTemp.path}/provider_selfie_${DateTime.now().microsecondsSinceEpoch}.jpg',
  );
  await file.writeAsBytes(jpeg);
  return file;
}

SelfieService buildService({
  PermissionStatus permission = PermissionStatus.granted,
  XFile? picked,
}) {
  return SelfieService(
    permissionRequester: () async => permission,
    pickImage: (source, {imageQuality, preferredCameraDevice}) async => picked,
  );
}

class FakeFileStore implements SelfieFileStore {
  Uint8List? writtenBytes;
  String? writtenName;

  @override
  Future<File> writeCompressed(Uint8List bytes, {required String name}) async {
    writtenBytes = bytes;
    writtenName = name;
    final file = File('${Directory.systemTemp.path}/$name');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}

Map<String, dynamic> uploadJson() => {
  'url': '/api/attendance/att-1/selfie',
  'size_bytes': 3210,
  'retention_until': '2026-12-02T00:00:00.000Z',
};

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;
  late File selfieFile;

  setUp(() async {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
    selfieFile = await makeJpegFile();
  });

  ProviderContainer makeContainer({
    required ApiClient client,
    required SelfieService service,
    required SelfieFileStore fileStore,
  }) {
    final container = ProviderContainer(
      overrides: [
        secureSessionStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(client),
        selfieServiceProvider.overrideWithValue(service),
        selfieFileStoreProvider.overrideWithValue(fileStore),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('capture', () {
    test('capture → compress → state holds the compressed bytes', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(
        client: client,
        service: buildService(picked: XFile(selfieFile.path)),
        fileStore: FakeFileStore(),
      );
      final notifier = container.read(selfieProvider.notifier);

      final captured = await notifier.capture();

      expect(captured, isNotNull);
      final state = container.read(selfieProvider);
      expect(state.permission, CameraPermission.granted);
      expect(state.hasCapture, isTrue);
      expect(state.capturedFile, isNotNull);
      expect(state.error, isNull);
    });

    test('a denied permission returns null without an error', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(
        client: client,
        service: buildService(
          permission: PermissionStatus.permanentlyDenied,
          picked: XFile(selfieFile.path),
        ),
        fileStore: FakeFileStore(),
      );
      final notifier = container.read(selfieProvider.notifier);

      final captured = await notifier.capture();

      expect(captured, isNull);
      final state = container.read(selfieProvider);
      expect(state.permission, CameraPermission.permanentlyDenied);
      expect(state.permission.canUse, isFalse);
      expect(state.hasCapture, isFalse);
    });

    test('a cancelled camera returns null and keeps state clean', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(
        client: client,
        service: buildService(picked: null),
        fileStore: FakeFileStore(),
      );
      final notifier = container.read(selfieProvider.notifier);

      final captured = await notifier.capture();

      expect(captured, isNull);
      expect(container.read(selfieProvider).hasCapture, isFalse);
    });
  });

  group('upload', () {
    test('capture → upload success → lastUpload set, capture cleared', () async {
      final client = buildTestClient(store, (o) async {
        expect(o.path, '/attendance/att-1/selfie');
        return jsonResponse(uploadJson());
      });
      final fileStore = FakeFileStore();
      final container = makeContainer(
        client: client,
        service: buildService(picked: XFile(selfieFile.path)),
        fileStore: fileStore,
      );
      final notifier = container.read(selfieProvider.notifier);

      await notifier.capture();
      await notifier.upload('att-1');

      final state = container.read(selfieProvider);
      expect(state.uploading, isFalse);
      expect(state.error, isNull);
      expect(state.lastUpload, isNotNull);
      expect(state.lastUpload!.sizeBytes, 3210);
      expect(state.hasCapture, isFalse);
      // The compressed bytes were materialised to a temp file for the multipart.
      expect(fileStore.writtenBytes, isNotNull);
      expect(fileStore.writtenName, 'selfie_att-1.jpg');
    });

    test('a failed upload preserves the capture for retry', () async {
      var calls = 0;
      final client = buildTestClient(store, (o) async {
        if (o.path == '/attendance/att-1/selfie') {
          calls++;
          if (calls == 1) {
            return jsonErrorResponse('Server bermasalah', status: 500);
          }
          return jsonResponse(uploadJson());
        }
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(
        client: client,
        service: buildService(picked: XFile(selfieFile.path)),
        fileStore: FakeFileStore(),
      );
      final notifier = container.read(selfieProvider.notifier);

      await notifier.capture();
      await notifier.upload('att-1');

      final failed = container.read(selfieProvider);
      expect(failed.error, 'Server bermasalah');
      expect(failed.uploading, isFalse);
      expect(failed.lastUpload, isNull);
      // The captured photo survives so the user can retry without re-taking it.
      expect(failed.hasCapture, isTrue);

      await notifier.upload('att-1');

      final retried = container.read(selfieProvider);
      expect(retried.error, isNull);
      expect(retried.lastUpload, isNotNull);
      expect(retried.hasCapture, isFalse);
      expect(calls, 2);
    });

    test('upload without a capture is a no-op', () async {
      var requests = 0;
      final client = buildTestClient(store, (o) async {
        requests++;
        return jsonResponse(uploadJson());
      });
      final container = makeContainer(
        client: client,
        service: buildService(picked: null),
        fileStore: FakeFileStore(),
      );
      final notifier = container.read(selfieProvider.notifier);

      await notifier.upload('att-1');

      expect(requests, 0);
      expect(container.read(selfieProvider).lastUpload, isNull);
    });
  });

  group('clear', () {
    test('discards the captured selfie', () async {
      final client = buildTestClient(store, (o) async {
        return jsonErrorResponse('nope', status: 404);
      });
      final container = makeContainer(
        client: client,
        service: buildService(picked: XFile(selfieFile.path)),
        fileStore: FakeFileStore(),
      );
      final notifier = container.read(selfieProvider.notifier);

      await notifier.capture();
      expect(container.read(selfieProvider).hasCapture, isTrue);

      notifier.clear();

      expect(container.read(selfieProvider).hasCapture, isFalse);
      expect(container.read(selfieProvider).capturedFile, isNull);
    });
  });
}
