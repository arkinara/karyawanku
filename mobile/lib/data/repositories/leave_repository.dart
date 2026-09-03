import '../../core/api/api_client.dart';
import '../models.dart';

/// Typed access to the BE leave-request list
/// (`backend/src/routes/leave-requests.ts`). The schedule uses it to mark
/// days covered by a leave request (pending or approved) so the calendar can
/// show "Cuti" instead of a shift. The full cuti screen still runs off
/// fixtures until its own MOB ticket.
class LeaveRepository {
  const LeaveRepository(this._api);

  final ApiClient _api;

  /// `GET /leave-requests?limit=100` — the signed-in employee's requests.
  /// The BE resolves the employee from the JWT, so no `employee_id` is sent.
  Future<List<LeaveRequestRecord>> getRequests() async {
    final data = await _api.get<Map<String, dynamic>>(
      '/leave-requests',
      query: {'limit': 100},
    );
    final raw = data['items'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(LeaveRequestRecord.fromJson)
        .toList();
  }
}