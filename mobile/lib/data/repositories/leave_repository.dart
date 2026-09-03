import '../../core/api/api_client.dart';
import '../models.dart';

/// Typed access to the BE leave endpoints (`backend/src/routes/leave-requests.ts`,
/// `leave-balances.ts`, `leave-types.ts`). Everything flows through the shared
/// [ApiClient] from #62 — no screen touches HTTP, and the employee is resolved
/// server-side from the JWT, so no `employee_id` is ever sent by the employee
/// app.
class LeaveRepository {
  const LeaveRepository(this._api);

  final ApiClient _api;

  /// `GET /leave-requests?limit=100` — the signed-in employee's requests,
  /// newest first. The BE resolves the employee from the JWT and filters
  /// server-side, so another employee's requests never reach this device.
  Future<List<LeaveRequest>> getRequests() async {
    final data = await _api.get<Map<String, dynamic>>(
      '/leave-requests',
      query: {'limit': 100},
    );
    final raw = data['items'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(LeaveRequest.fromJson)
        .toList();
  }

  /// `GET /leave-balances?tahun=` — the signed-in employee's quota rows for
  /// the current year, one per active leave type.
  Future<List<LeaveBalance>> getBalances() async {
    final data = await _api.get<Map<String, dynamic>>(
      '/leave-balances',
      query: {'tahun': DateTime.now().year},
    );
    final raw = data['balances'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(LeaveBalance.fromJson)
        .toList();
  }

  /// `GET /leave-types` — the business's active leave types, which the form's
  /// chips are built from.
  Future<List<LeaveType>> getLeaveTypes() async {
    final data = await _api.get<Map<String, dynamic>>('/leave-types');
    final raw = data['leave_types'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(LeaveType.fromJson)
        .toList();
  }

  /// `POST /leave-requests` with `{ leave_type_id, tanggal_mulai,
  /// tanggal_selesai, alasan }`. Dates are sent as `YYYY-MM-DD`; the BE runs
  /// its own balance and range validation and stamps `status: pending`.
  Future<LeaveRequest> submit({
    required String leaveTypeId,
    required DateTime tanggalMulai,
    required DateTime tanggalSelesai,
    required String alasan,
  }) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/leave-requests',
      body: {
        'leave_type_id': leaveTypeId,
        'tanggal_mulai': _date(tanggalMulai),
        'tanggal_selesai': _date(tanggalSelesai),
        'alasan': alasan.trim(),
      },
    );
    final raw = data['request'];
    if (raw is Map<String, dynamic>) return LeaveRequest.fromJson(raw);
    return LeaveRequest.fromJson(data);
  }

  static String _date(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}