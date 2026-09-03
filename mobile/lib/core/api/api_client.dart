import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../auth/secure_session_store.dart';
import 'api_exception.dart';
import 'models.dart';

/// Build-time base URL: `--dart-define=API_BASE_URL=https://staging...`.
/// Defaults to the local BE. Screens never hardcode a host — everything goes
/// through [ApiClient.instance].
abstract final class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001',
  );
}

/// Interceptor plumbing keys.
abstract final class _Extra {
  static const anonymous = 'kk_anonymous';
  static const retried = 'kk_retried';
}

/// Singleton typed client over Dio. One place that knows the base URL, adds
/// `Authorization: Bearer <jwt>` to every authenticated request, and turns BE
/// error envelopes (`{ error: { message, details } }`) into typed exceptions.
///
/// A 401 on an authenticated request triggers exactly ONE `POST /auth/refresh`;
/// if that also fails (or the retried request 401s again) the session is
/// cleared, [onSessionExpired] fires, and the call throws [UnauthorizedException].
class ApiClient {
  ApiClient({Dio? dio, SecureSessionStore? sessionStore})
      : _store = sessionStore ?? SecureSessionStore(),
        _dio = dio ?? _buildDio() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  /// Process-wide singleton — screens and providers import this, never a
  /// hardcoded host.
  static final ApiClient instance = ApiClient();

  static Dio _buildDio() {
    return Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 15),
        headers: {'Accept': 'application/json'},
      ),
    );
  }

  final Dio _dio;
  final SecureSessionStore _store;

  /// Fired once a refresh attempt fails and the session is cleared. The auth
  /// provider wires this to reset state and bounce to the sign-in screen —
  /// the mobile analogue of the web's `kk-session-expired` redirect.
  void Function()? onSessionExpired;

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra[_Extra.anonymous] == true) {
      handler.next(options);
      return;
    }
    final token = await _store.getAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final options = error.requestOptions;
    final status = error.response?.statusCode ?? 0;
    final anonymous = options.extra[_Extra.anonymous] == true;
    final alreadyRetried = options.extra[_Extra.retried] == true;

    if (error.response == null) {
      // Server unreachable: timeout, refused connection, dropped TLS.
      handler.next(_typed(error, const NetworkException()));
      return;
    }

    // Wrong-credentials 401s surface as ordinary envelope errors so the form
    // shows "Email atau kata sandi salah" — never treated as session loss
    // (matches the web client's `handleApiFailure` anonymous branch). A second
    // 401 on an already-refreshed request means the session is dead.
    if (status != 401 || anonymous || alreadyRetried) {
      handler.next(
        alreadyRetried && status == 401 && !anonymous
            ? _typed(error, const UnauthorizedException())
            : _typed(error, _envelopeError(error, status)),
      );
      return;
    }

    // One refresh attempt, then give up.
    final refreshToken = await _store.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await _store.clear();
      _emitSessionExpired();
      handler.next(_typed(error, const UnauthorizedException()));
      return;
    }

    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
        options: Options(extra: {_Extra.anonymous: true, _Extra.retried: true}),
      );
      final refresh = RefreshResponse.fromJson(res.data!);
      await _store.setTokens(
        accessToken: refresh.accessToken,
        refreshToken: refresh.refreshToken,
      );

      // Re-run the original request; the request interceptor re-reads the new
      // access token from the store. The `retried` flag stops a second refresh.
      options.extra[_Extra.retried] = true;
      final retry = await _dio.fetch<dynamic>(options);
      handler.resolve(retry);
    } on DioException catch (refreshFailure) {
      // The refresh call, or the retried original request, failed again.
      final mapped = refreshFailure.error is ApiException
          ? refreshFailure.error as ApiException
          : _envelopeError(
              refreshFailure,
              refreshFailure.response?.statusCode ?? 0,
            );
      final sessionLost =
          refreshFailure.response?.statusCode == 401 ||
          mapped is UnauthorizedException;
      if (sessionLost) {
        await _store.clear();
        _emitSessionExpired();
        handler.next(_typed(refreshFailure, const UnauthorizedException()));
      } else {
        handler.next(_typed(refreshFailure, mapped));
      }
    } catch (_) {
      await _store.clear();
      _emitSessionExpired();
      handler.next(_typed(error, const UnauthorizedException()));
    }
  }

  /// Wrap a typed exception in a [DioException] for the interceptor chain;
  /// [T _guard] unwraps it on the way out.
  DioException _typed(DioException source, ApiException apiError) {
    return DioException(
      requestOptions: source.requestOptions,
      error: apiError,
      type: source.type,
      response: source.response,
    );
  }

  void _emitSessionExpired() => onSessionExpired?.call();

  /// Parse `{ error: { message, details } }` into [ApiException]. Non-JSON
  /// bodies keep a friendly status-derived fallback. Error bodies on a
  /// `ResponseType.bytes` request arrive as raw bytes, so they are UTF-8
  /// decoded before the envelope is read.
  ApiException _envelopeError(DioException error, int status) {
    final data = _responseData(error);
    if (data is Map<String, dynamic>) {
      final errorBody = data['error'];
      if (errorBody is Map<String, dynamic>) {
        final message = errorBody['message'];
        if (message is String && message.isNotEmpty) {
          return ApiException(
            status: status,
            message: message,
            details: errorBody['details'],
          );
        }
      }
    }
    return ApiException(status: status, message: 'Permintaan gagal ($status)');
  }

  Object? _responseData(DioException error) {
    final data = error.response?.data;
    if (data is List<int>) {
      try {
        return jsonDecode(utf8.decode(data));
      } catch (_) {
        return null;
      }
    }
    return data;
  }

  /// Run a request, unwrapping the typed exceptions the error interceptor
  /// stashed in `DioException.error`.
  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on DioException catch (e) {
      if (e.error is ApiException) throw e.error as ApiException;
      throw const NetworkException();
    }
  }

  T _decode<T>(Response<dynamic> res) => res.data as T;

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _guard(() async {
        final res = await _dio.get<dynamic>(
          path,
          queryParameters: query,
          options: Options(extra: {_Extra.anonymous: false}),
        );
        return _decode<T>(res);
      });

  /// Raw-bytes `GET` for binary payloads (payslip PDFs). The same auth, refresh
  /// and error-envelope plumbing as [get], but the response body stays a byte
  /// array instead of being decoded as JSON.
  Future<Uint8List> getBytes(String path) => _guard(() async {
    final res = await _dio.get<List<int>>(
      path,
      options: Options(
        responseType: ResponseType.bytes,
        extra: {_Extra.anonymous: false},
      ),
    );
    return Uint8List.fromList(res.data ?? const []);
  });

  Future<T> post<T>(
    String path, {
    Object? body,
    bool anonymous = false,
    Map<String, dynamic>? query,
    Map<String, dynamic>? headers,
  }) =>
      _guard(() async {
        final res = await _dio.post<dynamic>(
          path,
          data: body,
          queryParameters: query,
          options: Options(
            extra: {_Extra.anonymous: anonymous},
            headers: headers,
          ),
        );
        return _decode<T>(res);
      });

  Future<T> patch<T>(String path, {Object? body}) => _guard(() async {
    final res = await _dio.patch<dynamic>(
      path,
      data: body,
      options: Options(extra: {_Extra.anonymous: false}),
    );
    return _decode<T>(res);
  });

  Future<T> put<T>(String path, {Object? body}) => _guard(() async {
    final res = await _dio.put<dynamic>(
      path,
      data: body,
      options: Options(extra: {_Extra.anonymous: false}),
    );
    return _decode<T>(res);
  });

  Future<T> delete<T>(String path) => _guard(() async {
    final res = await _dio.delete<dynamic>(
      path,
      options: Options(extra: {_Extra.anonymous: false}),
    );
    return _decode<T>(res);
  });
}