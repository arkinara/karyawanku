import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/app.dart';
import 'package:karyawanku_mobile/core/auth/authenticator.dart';
import 'package:karyawanku_mobile/core/auth/biometric_providers.dart';
import 'package:karyawanku_mobile/core/auth/device_credential_store.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/core/device/device_identity.dart';
import 'package:karyawanku_mobile/features/shell/home_shell.dart';

import 'helpers.dart';

Map<String, dynamic> signInBody() => {
  'user': testUser.toJson(),
  'token': 'access-token-1',
  'refresh_token': 'refresh-token-1',
};

Future<void> pumpApp(WidgetTester tester, InMemoryBackend backend,
    SecureSessionStore store,
    Future<ResponseBody> Function(RequestOptions options) handler) async {
  final client = buildTestClient(store, handler);
  await tester.pumpWidget(
    testScope(
      store,
      client,
      extra: [secureStorageBackendProvider.overrideWithValue(backend)],
      child: const KaryawanKuApp(),
    ),
  );
}

/// Pump the app with a shared in-memory backend + fake authenticator so the
/// biometric flows run headlessly (ticket #72).
Future<void> pumpBiometricApp(
  WidgetTester tester, {
  required InMemoryBackend backend,
  required SecureSessionStore store,
  required FakeAuthenticator authenticator,
  required Future<ResponseBody> Function(RequestOptions options) handler,
}) async {
  final client = buildTestClientWithDeviceId(backend, store, handler);
  await tester.pumpWidget(
    testScope(
      store,
      client,
      extra: [
        secureStorageBackendProvider.overrideWithValue(backend),
        authenticatorProvider.overrideWithValue(authenticator),
      ],
      child: const KaryawanKuApp(),
    ),
  );
}

void main() {
  late InMemoryBackend backend;
  late SecureSessionStore store;

  setUp(() {
    backend = InMemoryBackend();
    store = SecureSessionStore(backend: backend);
  });

  testWidgets('cold start with no session lands on MasukScreen', (tester) async {
    await pumpApp(tester, backend, store, (o) async {
      return jsonErrorResponse('nope', status: 404);
    });
    await tester.pumpAndSettle();

    expect(find.text('Masuk untuk melanjutkan.'), findsOneWidget);
    expect(find.byType(HomeShell), findsNothing);
  });

  testWidgets('restored session skips sign-in straight to the shell', (
    tester,
  ) async {
    await store.saveSession(testSession);
    await pumpApp(tester, backend, store, (o) async {
      return jsonResponse({'user': testUser.toJson()});
    });
    await tester.pumpAndSettle();

    expect(find.byType(HomeShell), findsOneWidget);
  });

  testWidgets('submitting the form signs in and lands on the shell', (
    tester,
  ) async {
    await pumpApp(tester, backend, store, (o) async {
      if (o.path == '/auth/sign-in') return jsonResponse(signInBody());
      return jsonErrorResponse('nope', status: 404);
    });
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'siti@usaha.com');
    await tester.enterText(find.byType(TextField).at(1), 'rahasia123');
    await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));
    await tester.pumpAndSettle();

    expect(find.byType(HomeShell), findsOneWidget);
    expect(find.text('Selamat pagi, Siti'), findsOneWidget);
    expect(await store.getAccessToken(), 'access-token-1');
  });

  testWidgets('shows a spinner while sign-in is in flight', (tester) async {
    final completer = Completer<ResponseBody>();
    await pumpApp(tester, backend, store, (o) async {
      if (o.path == '/auth/sign-in') return completer.future;
      return jsonErrorResponse('nope', status: 404);
    });
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'siti@usaha.com');
    await tester.enterText(find.byType(TextField).at(1), 'rahasia123');
    await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));
    await tester.pump();

    // Button disabled + spinner, and the form is still visible (not splash).
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Masuk untuk melanjutkan.'), findsOneWidget);

    completer.complete(jsonResponse(signInBody()));
    await tester.pumpAndSettle();
    expect(find.byType(HomeShell), findsOneWidget);
  });

  testWidgets('wrong credentials show the BE message as a snackbar', (
    tester,
  ) async {
    await pumpApp(tester, backend, store, (o) async {
      return jsonErrorResponse('Email atau kata sandi salah', status: 401);
    });
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'siti@usaha.com');
    await tester.enterText(find.byType(TextField).at(1), 'salah');
    await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));
    await tester.pumpAndSettle();

    expect(find.text('Email atau kata sandi salah'), findsOneWidget);
    expect(find.byType(HomeShell), findsNothing);
    expect(await store.getSession(), isNull);
  });

  testWidgets('offline sign-in shows the connection error, not a validation one', (
    tester,
  ) async {
    await pumpApp(tester, backend, store, (o) async {
      throw Exception('connection refused');
    });
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'siti@usaha.com');
    await tester.enterText(find.byType(TextField).at(1), 'rahasia123');
    await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));
    await tester.pumpAndSettle();

    expect(find.text('Tidak terhubung ke server'), findsOneWidget);
  });

  group('biometric button (ticket #72)', () {
    late InMemoryBackend backend;
    late SecureSessionStore store;

    setUp(() {
      backend = InMemoryBackend();
      store = SecureSessionStore(backend: backend);
    });

    testWidgets('is HIDDEN when no biometric is enrolled', (tester) async {
      await seedDeviceCredential(backend);
      await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
      // Biometrics enrolled? No — the fake reports none.
      final auth = FakeAuthenticator();

      await pumpBiometricApp(
        tester,
        backend: backend,
        store: store,
        authenticator: auth,
        handler: (o) async => jsonErrorResponse('nope', status: 404),
      );
      await tester.pumpAndSettle();

      expect(find.text('Masuk dengan sidik jari'), findsNothing);
    });

    testWidgets('is HIDDEN when no credential is stored', (tester) async {
      await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
      final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint]);

      await pumpBiometricApp(
        tester,
        backend: backend,
        store: store,
        authenticator: auth,
        handler: (o) async => jsonErrorResponse('nope', status: 404),
      );
      await tester.pumpAndSettle();

      expect(find.text('Masuk dengan sidik jari'), findsNothing);
    });

    testWidgets('is VISIBLE with enrolled biometrics + stored credential', (
      tester,
    ) async {
      await seedDeviceCredential(backend);
      await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
      final auth = FakeAuthenticator(
        kinds: [BiometricKind.fingerprint],
        willSucceed: false,
      );

      await pumpBiometricApp(
        tester,
        backend: backend,
        store: store,
        authenticator: auth,
        handler: (o) async => jsonErrorResponse('nope', status: 404),
      );
      await tester.pumpAndSettle();

      expect(find.text('Masuk dengan sidik jari'), findsOneWidget);
    });

    testWidgets('tap → unlockWithBiometric success navigates to the shell', (
      tester,
    ) async {
      await seedDeviceCredential(backend);
      await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
      // The cold-start gate runs first; make its prompt fail so the screen
      // stays signed out, then arm the fake and tap the button.
      final auth = FakeAuthenticator(
        kinds: [BiometricKind.fingerprint],
        willSucceed: false,
      );

      await pumpBiometricApp(
        tester,
        backend: backend,
        store: store,
        authenticator: auth,
        handler: (o) async {
          if (o.path == '/auth/device-refresh') {
            return jsonResponse(deviceRefreshBody());
          }
          return jsonErrorResponse('nope', status: 404);
        },
      );
      await tester.pumpAndSettle();
      expect(find.text('Masuk dengan sidik jari'), findsOneWidget);

      auth.willSucceed = true;
      await tester.tap(find.text('Masuk dengan sidik jari'));
      await tester.pumpAndSettle();

      expect(find.byType(HomeShell), findsOneWidget);
      expect(await store.getAccessToken(), 'access-token-2');
    });

    testWidgets('cancelled prompt returns to the password screen', (tester) async {
      await seedDeviceCredential(backend);
      await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
      final auth = FakeAuthenticator(
        kinds: [BiometricKind.fingerprint],
        willSucceed: false,
      );

      await pumpBiometricApp(
        tester,
        backend: backend,
        store: store,
        authenticator: auth,
        handler: (o) async {
          if (o.path == '/auth/device-refresh') {
            return jsonResponse(deviceRefreshBody());
          }
          return jsonErrorResponse('nope', status: 404);
        },
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Masuk dengan sidik jari'));
      await tester.pumpAndSettle();

      expect(find.byType(HomeShell), findsNothing);
      expect(find.text('Masuk untuk melanjutkan.'), findsOneWidget);
      expect(await store.getSession(), isNull);
    });

    testWidgets('cold start silently unlocks and skips the sign-in screen', (
      tester,
    ) async {
      await seedDeviceCredential(backend);
      await backend.write(DeviceIdentity.deviceIdKey, 'device-1');
      final auth = FakeAuthenticator(
        kinds: [BiometricKind.fingerprint],
        willSucceed: true,
      );

      await pumpBiometricApp(
        tester,
        backend: backend,
        store: store,
        authenticator: auth,
        handler: (o) async {
          if (o.path == '/auth/device-refresh') {
            return jsonResponse(deviceRefreshBody());
          }
          return jsonErrorResponse('nope', status: 404);
        },
      );
      await tester.pumpAndSettle();

      expect(find.byType(HomeShell), findsOneWidget);
      expect(find.text('Masuk untuk melanjutkan.'), findsNothing);
    });

    testWidgets('first password sign-in asks to enrol; Aktifkan writes the marker', (
      tester,
    ) async {
      final auth = FakeAuthenticator(kinds: [BiometricKind.fingerprint]);

      await pumpBiometricApp(
        tester,
        backend: backend,
        store: store,
        authenticator: auth,
        handler: (o) async {
          if (o.path == '/auth/sign-in') return jsonResponse(signInBodyWithDevice());
          return jsonErrorResponse('nope', status: 404);
        },
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).at(0), 'siti@usaha.com');
      await tester.enterText(find.byType(TextField).at(1), 'rahasia123');
      await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));
      // Sign-in is awaited while the enrol dialog is up, so the form spinner
      // animates the whole time — pump a few frames instead of settling.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Masuk dengan sidik jari?'), findsOneWidget);
      await tester.tap(find.text('Aktifkan'));
      await tester.pumpAndSettle();

      expect(find.byType(HomeShell), findsOneWidget);
      expect(await backend.read(DeviceCredentialStore.credentialKey), isNotNull);
      expect(await backend.read(DeviceCredentialStore.markerKey), isNotNull);
    });
  });
}