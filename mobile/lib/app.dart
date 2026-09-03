import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_provider.dart';
import 'features/auth/masuk_screen.dart';
import 'features/shell/home_shell.dart';
import 'theme/app_theme.dart';
import 'theme/tokens.dart';

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
  @override
  void initState() {
    super.initState();
    // Fire once at startup; the provider holds the `restoring` state so the
    // router shows the splash while it runs.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).restoreSession();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    if (auth.isSignedIn) return const HomeShell();
    if (auth.loading && !auth.signingIn) return const _Splash();
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