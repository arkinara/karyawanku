import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';

import 'helpers.dart';

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  test('save → get roundtrip preserves the session', () async {
    await store.saveSession(testSession);

    final restored = await store.getSession();
    expect(restored, isNotNull);
    expect(restored!.accessToken, testSession.accessToken);
    expect(restored.refreshToken, testSession.refreshToken);
    expect(restored.user.nama, testUser.nama);
    expect(restored.user.role, testUser.role);
    expect(restored.user.email, testUser.email);
    expect(restored.user.initials, 'SN');
  });

  test('clear removes every key', () async {
    await store.saveSession(testSession);
    await store.clear();

    expect(await store.getSession(), isNull);
    expect(await store.getAccessToken(), isNull);
    expect(await store.getRefreshToken(), isNull);
    expect(backend.data, isEmpty);
  });

  test('setTokens updates the pair without touching the user', () async {
    await store.saveSession(testSession);
    await store.setTokens(accessToken: 'a2', refreshToken: 'r2');

    expect(await store.getAccessToken(), 'a2');
    expect(await store.getRefreshToken(), 'r2');
    final session = await store.getSession();
    expect(session!.user.nama, testUser.nama);
  });

  test('an empty store reads as signed out', () async {
    expect(await store.getSession(), isNull);
    expect(await store.getAccessToken(), isNull);
    expect(await store.getRefreshToken(), isNull);
  });

  test('corrupt stored user is treated as signed out, not a crash', () async {
    await backend.write('kk_access_token', 'a');
    await backend.write('kk_refresh_token', 'r');
    await backend.write('kk_user', 'not-json{{{');

    expect(await store.getSession(), isNull);
  });
}
