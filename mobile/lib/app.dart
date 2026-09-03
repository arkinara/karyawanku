import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_provider.dart';
import 'core/navigation.dart';
import 'core/push/deep_link_router.dart';
import 'core/push/push_bootstrap.dart';
import 'features/auth/masuk_screen.dart';
import 'features/cuti/leave_detail_screen.dart';
import 'features/cuti/leave_provider.dart';
import 'features/jadwal/jadwal_screen.dart';
import 'features/shell/home_shell.dart';
import 'theme/app_theme.dart';
import 'theme/tokens.dart';
import 'widgets/not_found_screen.dart';

class KaryawanKuApp extends StatelessWidget {
  const KaryawanKuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KaryawanKu',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      darkTheme: buildAppTheme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
      navigatorKey: rootNavigatorKey,
      home: const RootRouter(),
    );
  }
}

/// Auth-gated root. While the session restores it shows a splash; signed-out
/// users land on [MasukScreen]; a live session drops straight into the shell.
/// Because the router reacts to [authProvider], session expiry and sign-out
/// navigate automatically without a redirect loop.
class RootRouter extends ConsumerStatefulWidget {
  const RootRouter({super.key});

  @override
  ConsumerState<RootRouter> createState() => _RootRouterState();
}

class _RootRouterState extends ConsumerState<RootRouter> {
  StreamSubscription<DeepLinkTarget>? _deepLinkSub;
  DeepLinkTarget? _pendingTarget;

  /// Ticket #72 — the cold-start biometric gate runs at most once. A failed
  /// attempt falls through to MasukScreen and never retries (no loop).
  bool _biometricGateTried = false;

  @override
  void initState() {
    super.initState();
    // Fire once at startup; the provider holds the `restoring` state so the
    // router shows the splash while it runs.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).restoreSession();
    });
    // Ticket #71 — route push taps / deep links. Cold start waits for auth in
    // [build]'s auth listener below; background taps navigate immediately when
    // signed in.
    final router = ref.read(deepLinkRouterProvider);
    router.start();
    _deepLinkSub = router.targets.listen(_onDeepLink);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      router.handleColdStart();
    });
  }

  @override
  void dispose() {
    _deepLinkSub?.cancel();
    super.dispose();
  }

  void _onDeepLink(DeepLinkTarget target) {
    if (!mounted) return;
    if (ref.read(authProvider).isSignedIn) {
      _navigate(target);
    } else {
      // Signed out: wait for sign-in, then navigate (cold-start deep links
      // may need a session).
      _pendingTarget = target;
    }
  }

  Future<void> _navigate(DeepLinkTarget target) async {
    if (!mounted) return;
    final navigator = Navigator.of(context);
    if (target.kind == DeepLinkKind.shift) {
      navigator.push(MaterialPageRoute(builder: (_) => const JadwalScreen()));
      return;
    }
    // Cross-employee guard: a leave id that does not belong to the signed-in
    // user resolves to the not-found page, never to their data.
    final guard = DeepLinkGuard(leaveRepo: ref.read(leaveRepositoryProvider));
    final owned = await guard.owns(target);
    if (!mounted) return;
    navigator.push(
      MaterialPageRoute(
        builder: (_) => owned
            ? LeaveDetailScreen(requestId: target.id)
            : const NotFoundScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    // Cold-start deep link: navigate once auth resolves.
    ref.listen<AuthState>(authProvider, (prev, next) {
      final pending = _pendingTarget;
      if (next.isSignedIn && pending != null) {
        _pendingTarget = null;
        _navigate(pending);
      }
    });

    if (auth.isSignedIn) return const HomeShell();
    if (auth.loading && !auth.signingIn) return const _Splash();

    // Ticket #72 — cold-start biometric gate. After restoreSession settles
    // (signed out), attempt one silent unlock when a stored credential +
    // enrolled, unchanged biometrics + enrolment marker are present. Success
    // swaps to the shell; any failure stays on MasukScreen.
    if (!_biometricGateTried) {
      _biometricGateTried = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(authProvider.notifier).tryBiometricUnlock();
      });
    }
    return const MasukScreen();
  }
}

/// Brand splash shown while the stored session is being verified.
class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colors.primary,
                borderRadius: Shape.rLg,
              ),
              child: ExcludeSemantics(
                child: Text(
                  'K',
                  style: context.texts.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colors.onPrimary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ],
        ),
      ),
    );
  }
}
