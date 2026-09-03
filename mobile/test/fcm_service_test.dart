import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/push/fcm_service.dart';
import 'package:karyawanku_mobile/core/push/push_messaging.dart';

import 'helpers.dart';

void main() {
  group('FCMService', () {
    test('getDeviceToken returns the token from a fake getToken()', () async {
      final fake = FakeMessaging()..token = 'fcm-real-token';
      final service = testFCMService(fake);

      expect(await service.getDeviceToken(), 'fcm-real-token');
    });

    test('getDeviceToken returns null when messaging init fails', () async {
      final fake = FakeMessaging()..token = null;
      final service = testFCMService(fake);

      expect(await service.getDeviceToken(), isNull);
    });

    test('getDeviceToken tolerates a throwing token call', () async {
      final throwing = _ThrowingMessaging();
      final service = FCMService(messaging: throwing);

      expect(await service.getDeviceToken(), isNull);
    });

    test('requestPermission granted → true', () async {
      final fake = FakeMessaging()..permissionGranted = true;
      final service = testFCMService(fake);

      expect(await service.requestPermission(), isTrue);
    });

    test('requestPermission denied → false', () async {
      final fake = FakeMessaging()..permissionGranted = false;
      final service = testFCMService(fake);

      expect(await service.requestPermission(), isFalse);
    });

    test('requestPermission tolerates a throwing implementation', () async {
      final service = FCMService(messaging: _ThrowingMessaging());
      expect(await service.requestPermission(), isFalse);
    });

    test('foreground messages flow through onMessage', () async {
      final fake = FakeMessaging();
      final service = testFCMService(fake);
      RemoteMessage? seen;
      final sub = service.onMessage.listen((m) => seen = m);

      final message = fakeRemoteMessage(data: {'kind': 'leave', 'requestId': 'r-1'});
      fake.sendMessage(message);
      await Future<void>.delayed(Duration.zero);

      expect(seen?.messageId, 'msg-1');
      expect(seen?.data['requestId'], 'r-1');
      await sub.cancel();
    });

    test('onTokenRefresh carries rotated tokens', () async {
      final fake = FakeMessaging();
      final service = testFCMService(fake);
      final seen = <String>[];
      final sub = service.onTokenRefresh.listen(seen.add);

      fake.rotateToken('fcm-new-token');
      await Future<void>.delayed(Duration.zero);

      expect(seen, ['fcm-new-token']);
      await sub.cancel();
    });

    test('getInitialMessage returns the cold-start message', () async {
      final fake = FakeMessaging()
        ..initialMessage = fakeRemoteMessage(data: {
          'kind': 'shift_reminder',
          'assignmentId': 'sa-1',
        });
      final service = testFCMService(fake);

      final message = await service.getInitialMessage();
      expect(message?.data['assignmentId'], 'sa-1');
    });
  });
}

/// A [PushMessaging] whose every call throws — simulates a missing Firebase
/// config without a platform channel.
class _ThrowingMessaging implements PushMessaging {
  @override
  Future<String?> getToken() async => throw UnimplementedError('no firebase');

  @override
  Future<bool> requestPermission() async =>
      throw UnimplementedError('no firebase');

  @override
  Stream<RemoteMessage> get onMessage =>
      throw UnimplementedError('no firebase');

  @override
  Stream<RemoteMessage> get onMessageOpenedApp =>
      throw UnimplementedError('no firebase');

  @override
  Stream<String> get onTokenRefresh =>
      throw UnimplementedError('no firebase');

  @override
  Future<RemoteMessage?> getInitialMessage() async =>
      throw UnimplementedError('no firebase');
}