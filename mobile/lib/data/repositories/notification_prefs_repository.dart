import '../../core/api/api_client.dart';
import '../models.dart';

/// Typed access to `GET/PATCH /api/notification-prefs/me`
/// (`backend/src/routes/notification-prefs.ts`, ticket #71). The shift-reminder
/// toggle on the Jadwal screen reads and writes through here; the server holds
/// the source of truth (default: active, 30 minutes before shift start).
class NotificationPrefsRepository {
  const NotificationPrefsRepository(this._api);

  final ApiClient _api;

  Future<NotificationPrefs> getMy() async {
    final data = await _api.get<Map<String, dynamic>>('/notification-prefs/me');
    return NotificationPrefs.fromJson(
      data['preferences'] is Map<String, dynamic>
          ? data['preferences'] as Map<String, dynamic>
          : const <String, dynamic>{},
    );
  }

  Future<NotificationPrefs> update({
    bool? shiftRemindersEnabled,
    int? reminderLeadMinutes,
  }) async {
    final data = await _api.patch<Map<String, dynamic>>(
      '/notification-prefs/me',
      body: {
        'shift_reminders_enabled': ?shiftRemindersEnabled,
        'reminder_lead_minutes': ?reminderLeadMinutes,
      },
    );
    return NotificationPrefs.fromJson(
      data['preferences'] is Map<String, dynamic>
          ? data['preferences'] as Map<String, dynamic>
          : const <String, dynamic>{},
    );
  }
}
