import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/app.dart';
import 'package:karyawanku_mobile/core/auth/secure_session_store.dart';
import 'package:karyawanku_mobile/features/shell/home_shell.dart';

import 'helpers.dart';

Map<String, dynamic> signInBody() => {
  'user': testUser.toJson(),
  'token': 'access-token-1',
  'refresh_token': 'refresh-token-1',
};

Future<void> pumpApp(WidgetTester tester, SecureSessionStore store,
    Future<ResponseBody> Function(RequestOptions options) handler) async {
  final client = buildTestClient(store, handler);
  await tester.pumpWidget(
    testScope(store, client, child: const KaryawanKuApp()),
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
    await pumpApp(tester, store, (o) async {
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
    await pumpApp(tester, store, (o) async {
      return jsonResponse({'user': testUser.toJson()});
    });
    await tester.pumpAndSettle();

    expect(find.byType(HomeShell), findsOneWidget);
  });

  testWidgets('submitting the form signs in and lands on the shell', (
    tester,
  ) async {
    await pumpApp(tester, store, (o) async {
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
    await pumpApp(tester, store, (o) async {
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
    await pumpApp(tester, store, (o) async {
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
    await pumpApp(tester, store, (o) async {
      throw Exception('connection refused');
    });
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'siti@usaha.com');
    await tester.enterText(find.byType(TextField).at(1), 'rahasia123');
    await tester.tap(find.widgetWithText(FilledButton, 'Masuk'));
    await tester.pumpAndSettle();

    expect(find.text('Tidak terhubung ke server'), findsOneWidget);
  });
}