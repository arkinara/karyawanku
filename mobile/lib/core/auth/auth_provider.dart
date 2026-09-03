import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/models.dart';
import '../device/device_identity.dart';
import '../push/push_registration.dart';
import 'biometric_providers.dart';
import 'biometric_service.dart';
import 'authenticator.dart';
import 'device_credential_store.dart';
import 'secure_session_store.dart';

/// Backing store shared by the [ApiClient] interceptor (token attachment) and
/// the auth notifier (session persistence). Defaults to the platform singleton.
final secureSessionStoreProvider = Provider<SecureSessionStore>(
  (ref) => SecureSessionStore.instance,
);

/// The single [ApiClient] screens and providers talk to. Tests override this
/// with a client backed by a fake Dio + in-memory store.
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient.instance);

/// Auth state machine: signed-out, restoring (cold start or sign-in in
/// flight), signed-in, or signed-out with a "sesi berakhir" notice after a
/// failed refresh.
@immutable
class AuthState {
  const AuthState({
    this.user,
    this.session,
    this.loading = false,
    this.signingIn = false,
    this.notice,
  });

  const AuthState.signedOut() : this();

  const AuthState.restoring() : this(loading: true);

  /// Sign-in in flight — the form shows its own spinner; the router must NOT
  /// swap to the splash, only a cold-start restore does.
  const AuthState.signingIn() : this(loading: true, signingIn: true);

  AuthState.signedIn(Session session)
    : this(user: session.user, session: session);

  const AuthState.expired()
    : this(notice: 'Sesi telah berakhir. Silakan masuk kembali.');

  final User? user;
  final Session? session;

  /// True during cold-start restore or an in-flight sign-in.
  final bool loading;

  /// True specifically while `POST /auth/sign-in` is in flight.
  final bool signingIn;

  /// One-shot message the router surfaces as a snackbar, e.g. session expiry.
  final String? notice;

  bool get isSignedIn => session != null;
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

/// Owns the session lifecycle: sign-in stores the token pair + user in secure
/// storage, cold start restores and verifies it, sign-out revokes then clears
/// local state even if the network call fails.
class AuthNotifier extends Notifier<AuthState> {
  ApiClient get _api => ref.read(apiClientProvider);
  SecureSessionStore get _store => ref.read(secureSessionStoreProvider);
  DeviceCredentialStore get _credentialStore =>
      ref.read(deviceCredentialStoreProvider);
  BiometricService get _biometric => ref.read(biometricServiceProvider);

  /// True while an explicit sign-out is running so the interceptor's
  /// session-expiry handler cannot stamp a spurious notice on top of it.
  bool _manualSignOut = false;

  @override
  AuthState build() {
    // Any 401 that survives the refresh attempt lands here: clear state so
    // the router bounces to MasukScreen with the "sesi berakhir" notice.
    _api.onSessionExpired = _handleSessionExpired;
    return const AuthState.restoring();
  }

  void _handleSessionExpired() {
    if (_manualSignOut) return;
    state = const AuthState.expired();
  }

  /// Reads the per-install device identity, re-bootstrapping after a rotate().
  Future<DeviceIdentity> _currentIdentity() => DeviceIdentity.ensureInitialized(
    backend: ref.read(secureStorageBackendProvider),
  );

  /// Cold-start restore: read the secure store, verify against `GET /auth/me`,
  /// and only enter the shell when the session is still live. An offline device
  /// keeps its stored session; a revoked or corrupt one signs out.
  Future<void> restoreSession() async {
    state = const AuthState.restoring();
    final session = await _store.getSession();
    if (session == null) {
      state = const AuthState.signedOut();
      return;
    }
    try {
      final me = await _api.get<Map<String, dynamic>>('/auth/me');
      final user = User.fromJson(me['user'] as Map<String, dynamic>);
      // The interceptor may have refreshed the token pair during the call —
      // re-read the store so we persist the live tokens, not the stale ones
      // read before the request.
      final live = await _store.getSession();
      final verified = Session(
        accessToken: live?.accessToken ?? session.accessToken,
        refreshToken: live?.refreshToken ?? session.refreshToken,
        user: user,
      );
      await _store.saveSession(verified);
      state = AuthState.signedIn(verified);
    } on UnauthorizedException {
      // Refresh failed too — the interceptor cleared the store. Bounce with
      // the "sesi berakhir" notice rather than a bare sign-in screen.
      state = const AuthState.expired();
    } on NetworkException {
      // Offline: keep the stored session rather than bouncing the user.
      state = AuthState.signedIn(session);
    } on ApiException {
      // Some other failure while verifying — the session cannot be trusted.
      state = const AuthState.signedOut();
    }
  }

  /// `POST /auth/sign-in`. Stores the session and enters the shell only on
  /// success; rethrows the typed exception so the form can show the BE's
  /// message ("Email atau kata sandi salah", …). On success the device
  /// registers for push (permission → token → POST /api/devices) — fire and
  /// forget, so a push outage or denied permission never blocks sign-in.
  ///
  /// Ticket #72: when the BE also mints a device credential (the request
  /// carries `X-Device-Id`), it is persisted to the biometric-gated store and
  /// the user is asked — exactly once — whether to enrol for biometric
  /// sign-in. Declining keeps email+password as the only path.
  Future<void> signIn(String email, String password) async {
    state = const AuthState.signingIn();
    try {
      final identity = await _currentIdentity();
      final data = await _api.post<Map<String, dynamic>>(
        '/auth/sign-in',
        body: {'email': email, 'password': password},
        anonymous: true,
        headers: identity.id.isEmpty ? null : {'X-Device-Id': identity.id},
      );
      final response = SignInResponse.fromJson(data);
      await _store.saveSession(response.session);
      if (response.deviceRefreshToken != null) {
        await _persistDeviceCredential(identity, response);
        // Exactly-once enrolment ask, only when a credential was minted.
        if (await _biometric.promptEnrolDecision()) {
          await _biometric.markBiometricEnrolled();
        }
      }
      state = AuthState.signedIn(response.session);
      unawaited(ref.read(pushRegistrationProvider).register());
    } catch (e) {
      state = const AuthState.signedOut();
      rethrow;
    }
  }

  Future<void> _persistDeviceCredential(
    DeviceIdentity identity,
    SignInResponse response,
  ) async {
    final token = response.deviceRefreshToken;
    final biometricKey = response.deviceBiometricKey;
    final installId = response.deviceInstallId;
    final expiresAt = response.deviceRefreshExpiresAt;
    if (token == null ||
        biometricKey == null ||
        installId == null ||
        expiresAt == null) {
      // Partial device envelope — nothing to persist.
      return;
    }
    await _credentialStore.save(
      token,
      biometricKey: biometricKey,
      deviceInstallId: installId,
      issuedAt: DateTime.now(),
      expiresAt: expiresAt,
    );
    await identity.rememberPushToken(installId);
  }

  /// Biometric unlock from the MasukScreen button or the cold-start gate.
  /// Prompts once (inside `DeviceCredentialStore.read`), exchanges the device
  /// credential for a fresh session + rotated credential, and returns whether
  /// the user is signed in. A cancelled prompt, expired/revoked credential or
  /// BE rejection returns false and falls back to password — never loops.
  Future<bool> unlockWithBiometric() async {
    state = const AuthState.signingIn();
    try {
      final credential = await _credentialStore.read(enforceBiometric: true);
      if (credential == null) {
        state = const AuthState.signedOut();
        return false;
      }
      final identity = await _currentIdentity();
      if (identity.id.isEmpty) {
        state = const AuthState.signedOut();
        return false;
      }
      final proof = deviceBiometricProof(
        biometricKey: credential.biometricKey,
        deviceId: identity.id,
        deviceInstallId: credential.deviceInstallId,
      );
      final data = await _api.post<Map<String, dynamic>>(
        '/auth/device-refresh',
        body: {
          'device_id': identity.id,
          'device_install_id': credential.deviceInstallId,
          'device_refresh_token': credential.deviceRefreshToken,
          'biometric_proof': proof,
        },
        anonymous: true,
        headers: {'X-Device-Id': identity.id},
      );
      final response = DeviceRefreshResponse.fromJson(data);
      await _store.saveSession(response.session);
      await _credentialStore.save(
        response.deviceRefreshToken,
        biometricKey: response.deviceBiometricKey,
        deviceInstallId: response.deviceInstallId,
        issuedAt: DateTime.now(),
        expiresAt: response.deviceRefreshExpiresAt,
      );
      await identity.rememberPushToken(response.deviceInstallId);
      state = AuthState.signedIn(response.session);
      unawaited(ref.read(pushRegistrationProvider).register());
      return true;
    } on NetworkException {
      // Offline — keep the stored credential for a later attempt.
      state = const AuthState.signedOut();
      return false;
    } on ApiException {
      // BE rejected the credential (revoked / expired / cross-device) — it can
      // never unlock again; drop it and fall back to password.
      await _credentialStore.clear();
      state = const AuthState.signedOut();
      return false;
    } catch (_) {
      await _credentialStore.clear();
      state = const AuthState.signedOut();
      return false;
    }
  }

  /// Cold-start biometric gate (ticket #72). Cheap pre-checks (stored
  /// credential, enrolled + unchanged biometrics, enrolment marker) decide
  /// whether to attempt a silent unlock; any failure falls through to the
  /// sign-in screen. Never loops — the router calls it at most once.
  Future<void> tryBiometricUnlock() async {
    try {
      final credential = await _credentialStore.read(enforceBiometric: false);
      if (credential == null) return;
      if (await _biometric.availableKind() == BiometricKind.none) return;
      if (await _biometric.isEnrolledChanged()) return;
      if (!await _credentialStore.hasBiometricMarker()) return;
    } catch (_) {
      return;
    }
    await unlockWithBiometric();
  }

  /// `POST /auth/sign-out`, then clear local state even when the call fails.
  /// The session's push device is removed first so a signed-out device
  /// receives nothing (negative AC); unregister is best-effort. The current
  /// device credential (if any) is revoked server-side by sending its raw
  /// token, then cleared locally along with the biometric marker.
  Future<void> signOut() async {
    _manualSignOut = true;
    try {
      await ref.read(pushRegistrationProvider).unregister();
    } catch (_) {
      // Best-effort on mobile; local state must still be cleared.
    }
    try {
      final credential = await _credentialStore.read(enforceBiometric: false);
      await _api.post<Map<String, dynamic>>(
        '/auth/sign-out',
        body: credential == null
            ? null
            : {'device_refresh_token': credential.deviceRefreshToken},
      );
    } catch (_) {
      // Revoke is best-effort on mobile; local state must still be cleared.
    } finally {
      await _store.clear();
      await _credentialStore.clear();
      _manualSignOut = false;
      state = const AuthState.signedOut();
    }
  }

  /// `POST /auth/sign-out-all`, then clear local state. Revokes every device
  /// credential for the user server-side too.
  Future<void> signOutAll() async {
    _manualSignOut = true;
    try {
      await ref.read(pushRegistrationProvider).unregister();
    } catch (_) {
      // best-effort
    }
    try {
      await _api.post<Map<String, dynamic>>('/auth/sign-out-all');
    } catch (_) {
      // best-effort
    } finally {
      await _store.clear();
      await _credentialStore.clear();
      _manualSignOut = false;
      state = const AuthState.signedOut();
    }
  }

  /// Consume the one-shot notice after the router surfaced it.
  void acknowledgeNotice() {
    if (state.notice != null) state = const AuthState.signedOut();
  }
}
