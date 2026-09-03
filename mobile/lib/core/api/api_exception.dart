/// Typed errors thrown by [ApiClient]. Screens catch these — never the raw
/// transport error — so the BE's Bahasa message survives, the device being
/// offline reads differently from "email atau sandi salah", and a 401 that
/// refresh could not repair is distinguishable from a normal validation error.
///
/// Mirrors the web client's `ApiError` (`frontend/src/lib/api-client.ts`) plus
/// the mobile-only transport and session-loss splits.
class ApiException implements Exception {
  const ApiException({
    required this.status,
    required this.message,
    this.details,
  });

  /// HTTP status, or `0` when the server was never reached.
  final int status;

  /// Localised message from the BE envelope (`{ error: { message } }`), or a
  /// friendly fallback for transport failures.
  final String message;

  /// Raw `details` from the BE envelope, e.g. a zod field-error map.
  final Object? details;

  @override
  String toString() => 'ApiException(status: $status, message: $message)';
}

/// The server (or network) could not be reached: timeouts, refused
/// connections, dropped TLS. Distinct from wrong credentials.
class NetworkException extends ApiException {
  const NetworkException({
    super.status = 0,
    super.message = 'Tidak terhubung ke server',
  });
}

/// A 401 that survived the one refresh attempt — the session is dead and the
/// user must sign in again.
class UnauthorizedException extends ApiException {
  const UnauthorizedException({
    super.status = 401,
    super.message = 'Sesi telah berakhir. Silakan masuk kembali.',
    super.details,
  });
}