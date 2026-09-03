import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

/// Materialises in-memory JPEG bytes into a [File] the repository can upload
/// as multipart. Extracted so tests can substitute a temp-dir writer instead
/// of reaching for the platform channel (`getTemporaryDirectory`).
abstract interface class SelfieFileStore {
  Future<File> writeCompressed(Uint8List bytes, {required String name});
}

/// Writes to the device's cache directory — no storage permission needed.
class DefaultSelfieFileStore implements SelfieFileStore {
  const DefaultSelfieFileStore();

  @override
  Future<File> writeCompressed(Uint8List bytes, {required String name}) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$name');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}

/// Single [SelfieFileStore] shared by the provider and by tests.
final selfieFileStoreProvider = Provider<SelfieFileStore>(
  (ref) => const DefaultSelfieFileStore(),
);
