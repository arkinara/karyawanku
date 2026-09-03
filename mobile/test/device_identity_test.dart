import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/device/device_identity.dart';

import 'helpers.dart';

void main() {
  test(
    'mints a fresh id at first launch and persists it across re-init',
    () async {
      final backend = InMemoryBackend();
      final first = await DeviceIdentity.ensureInitialized(backend: backend);

      expect(first.isFresh, isTrue);
      expect(first.id, isNotEmpty);

      final second = await DeviceIdentity.ensureInitialized(backend: backend);
      expect(second.isFresh, isFalse);
      expect(second.id, first.id);
    },
  );

  test(
    'rotate() drops the identity; the next init mints a fresh one',
    () async {
      final backend = InMemoryBackend();
      final identity = await DeviceIdentity.ensureInitialized(backend: backend);
      final oldId = identity.id;

      await identity.rotate();

      final after = await DeviceIdentity.ensureInitialized(backend: backend);
      expect(after.id, isNot(oldId));
      expect(after.isFresh, isTrue);
    },
  );

  test(
    'rememberPushToken persists the opaque device-bound string, rotate clears it',
    () async {
      final backend = InMemoryBackend();
      final identity = await DeviceIdentity.ensureInitialized(backend: backend);
      expect(identity.pushToken, isNull);

      await identity.rememberPushToken('install-1');
      final reloaded = await DeviceIdentity.ensureInitialized(backend: backend);
      expect(reloaded.pushToken, 'install-1');

      await reloaded.rotate();
      final after = await DeviceIdentity.ensureInitialized(backend: backend);
      expect(after.pushToken, isNull);
    },
  );

  test(
    'unreadable storage degrades to a blank identity, not a crash',
    () async {
      final broken = _ThrowingBackend();
      final identity = await DeviceIdentity.ensureInitialized(backend: broken);
      expect(identity.id, isEmpty);
      expect(identity.isFresh, isFalse);
    },
  );
}

class _ThrowingBackend implements SecureStorageBackend {
  @override
  Future<String?> read(String key) async => throw Exception('unreachable');

  @override
  Future<void> write(String key, String value) async =>
      throw Exception('unreachable');

  @override
  Future<void> delete(String key) async => throw Exception('unreachable');
}
