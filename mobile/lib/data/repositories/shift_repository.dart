import '../../core/api/api_client.dart';
import '../models.dart';

/// Typed access to the BE roster endpoints
/// (`backend/src/routes/shift-assignments.ts`). Everything flows through the
/// shared [ApiClient] from #62 — no screen touches HTTP, and the employee is
/// resolved server-side from the JWT.
class ShiftRepository {
  const ShiftRepository(this._api);

  final ApiClient _api;

  /// `GET /shift-assignments?start=&end=&limit=` — the signed-in employee's
  /// published roster entries whose `tanggal` falls inside `[start, end]`
  /// (inclusive, `YYYY-MM-DD`). Drafts never reach the employee app: the BE
  /// filters `published = true` for employee roles.
  Future<List<ShiftAssignment>> getAssignments({
    required DateTime start,
    required DateTime end,
  }) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/shift-assignments',
      query: {'start': _date(start), 'end': _date(end), 'limit': 100},
    );
    return _parseItems(data);
  }

  /// `GET /shift-assignments/upcoming?days=` — the next [days] days of
  /// published roster, oldest first. Used by the Beranda "Jadwal 3 hari ke
  /// depan" list.
  Future<List<ShiftAssignment>> getUpcoming({int days = 3}) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/shift-assignments/upcoming',
      query: {'days': days},
    );
    return _parseItems(data);
  }

  /// The list endpoint returns `{ items: [...] }` (paginated) while the
  /// upcoming endpoint returns `{ assignments: [...] }`. Accept both.
  List<ShiftAssignment> _parseItems(Map<String, dynamic> data) {
    final raw = data['items'] ?? data['assignments'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(ShiftAssignment.fromJson)
        .toList();
  }

  static String _date(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}
