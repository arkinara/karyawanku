import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/api/api_exception.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/data/repositories/notification_prefs_repository.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  NotificationPrefsRepository repoFor(
    Future<ResponseBody> Function(RequestOptions) handler,
  ) =>
      NotificationPrefsRepository(buildTestClient(store, handler));

  Map<String, dynamic> prefsJson({
    bool enabled = true,
    int lead = 30,
  }) =>
      {'shift_reminders_enabled': enabled, 'reminder_lead_minutes': lead};

  group('getMy', () {
    test('GETs /notification-prefs/me and parses the prefs', () async {
      String? path;
      final repo = repoFor((o) async {
        path = o.path;
        return jsonResponse({'preferences': prefsJson(enabled: false, lead: 60)});
      });

      final prefs = await repo.getMy();

      expect(path, '/notification-prefs/me');
      expect(prefs.shiftRemindersEnabled, isFalse);
      expect(prefs.reminderLeadMinutes, 60);
    });

    test('missing preferences key falls back to defaults', () async {
      final repo = repoFor((o) async => jsonResponse({}));

      final prefs = await repo.getMy();

      expect(prefs.shiftRemindersEnabled, isTrue);
      expect(prefs.reminderLeadMinutes, 30);
    });
  });

  group('update', () {
    test('PATCHes only the supplied fields and parses the result', () async {
      String? path;
      Map<String, dynamic>? body;
      final repo = repoFor((o) async {
        path = o.path;
        body = o.data as Map<String, dynamic>;
        return jsonResponse({
          'preferences': prefsJson(enabled: false, lead: 30),
        });
      });

      final prefs = await repo.update(shiftRemindersEnabled: false);

      expect(path, '/notification-prefs/me');
      expect(body!.containsKey('shift_reminders_enabled'), isTrue);
      expect(body!['shift_reminders_enabled'], isFalse);
      expect(body!.containsKey('reminder_lead_minutes'), isFalse);
      expect(prefs.shiftRemindersEnabled, isFalse);
    });

    test('PATCH with a lead time of 30 persists it', () async {
      Map<String, dynamic>? body;
      final repo = repoFor((o) async {
        body = o.data as Map<String, dynamic>;
        return jsonResponse({'preferences': prefsJson(lead: 30)});
      });

      final prefs = await repo.update(reminderLeadMinutes: 30);

      expect(body!['reminder_lead_minutes'], 30);
      expect(prefs.reminderLeadMinutes, 30);
    });

    test('server error surfaces as an ApiException', () async {
      final repo = repoFor(
        (o) async => jsonErrorResponse('Data tidak valid', status: 422),
      );

      await expectLater(
        repo.update(reminderLeadMinutes: 20),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 422)),
      );
    });
  });
}