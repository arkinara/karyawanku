import 'dart:typed_data';

import '../../core/api/api_client.dart';
import '../models.dart';

/// Typed access to the BE payslip endpoints (`backend/src/routes/payslips.ts`).
///
/// The signed-in employee is resolved server-side from the JWT, so the list
/// never sends an `employee_id` and another employee's payslips can never
/// reach this device. The list carries only the take-home summary; the full
/// earnings + deductions breakdown is fetched per payslip from `/:id` so no
/// compliance line is ever recomputed on the client.
class PayslipRepository {
  const PayslipRepository(this._api);

  final ApiClient _api;

  /// `GET /payslips?page=&limit=` — the signed-in employee's payslips, newest
  /// first. [offset] is converted to the BE's 1-indexed `page`
  /// (`page = offset ~/ limit + 1`). The optional [year] filters the result by
  /// the calendar year of the `periode` — the BE does not filter server-side,
  /// so the filter is applied to the parsed rows.
  Future<List<Payslip>> getPayslips({
    int? year,
    int limit = 50,
    int offset = 0,
  }) async {
    final page = limit <= 0 ? 1 : offset ~/ limit + 1;
    final data = await _api.get<Map<String, dynamic>>(
      '/payslips',
      query: {'limit': limit, 'page': page},
    );
    final raw = data['items'];
    if (raw is! List) return const [];
    final rows = raw
        .whereType<Map<String, dynamic>>()
        .map(Payslip.fromJson)
        .toList();
    if (year == null) return rows;
    return rows.where((p) => p.year == year).toList();
  }

  /// `GET /payslips/:id` (ticket #42) — the full breakdown: earnings +
  /// deductions lines plus the server's own totals. The client renders these
  /// verbatim; nothing is summed here.
  Future<PayslipDetail> getPayslip(String id) async {
    final data = await _api.get<Map<String, dynamic>>('/payslips/$id');
    return PayslipDetail.fromJson(data);
  }

  /// `GET /payslips/:id/download` — the raw PDF bytes. [fileName] is only the
  /// caller's hint for saving; the endpoint streams the authoritative PDF.
  Future<Uint8List> downloadPayslip(String id, {String fileName = ''}) async {
    return _api.getBytes('/payslips/$id/download');
  }
}