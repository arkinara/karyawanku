import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../models.dart';

/// Typed access to the business geofence config
/// (`GET /businesses/:id/geofence`, ticket #67 contract:
/// `{ workLat, workLng, radiusMeters }`).
///
/// Ticket #67 has not landed on the BE yet, so while the endpoint is missing
/// this repository serves a fixed dev mock point (Jakarta, radius 100 m) for
/// the signed-in business. The mock keeps the geofence chip honest in dev
/// without fabricated per-user distance — it is the *config*, and distance is
/// still measured against the device's real fix. When #67 lands and returns a
/// definitive "no work location configured", switch [getGeofence] to return
/// null and hide the chip (the UI contract is already nullable-aware).
class GeofenceRepository {
  const GeofenceRepository(this._api);

  final ApiClient _api;

  /// Dev fallback point — Jakarta (Kota Tua / Monas area). Used when the
  /// geofence endpoint does not exist yet or fails.
  static const mockGeofence = Geofence(
    workLat: -6.2088,
    workLng: 106.8456,
    radiusMeters: 100,
    isMock: true,
  );

  /// Fetch the business's work-area point. Falls back to [mockGeofence] when
  /// the endpoint 404s (not implemented / not configured) or fails.
  Future<Geofence> getGeofence(String businessId) async {
    try {
      final data = await _api.get<Map<String, dynamic>>(
        '/businesses/$businessId/geofence',
      );
      final geofence = Geofence.fromJson(data);
      if (geofence.isConfigured) return geofence;
      return mockGeofence;
    } on ApiException {
      // 404 = endpoint or config missing → dev mock. Other API failures
      // degrade the same way rather than blanking the chip.
      return mockGeofence;
    } catch (_) {
      // Transport failure — keep a usable (mock) config.
      return mockGeofence;
    }
  }
}
