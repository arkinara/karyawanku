import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/biometric_providers.dart';
import '../../core/widget/widget_bridge.dart';
import '../../core/widget/widget_entry.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';

const _offlineNotice =
    'Absensi tetap tercatat tanpa sinyal — data terkirim otomatis saat kembali online.';

/// Sign-in. M3 outlined fields with floating labels, pill buttons, and the
/// offline reassurance note that sets expectations before the first shift.
/// Submits to `POST /auth/sign-in`; the router swaps to the shell only once
/// [AuthNotifier.signIn] succeeds.
class MasukScreen extends ConsumerStatefulWidget {
  const MasukScreen({super.key});

  @override
  ConsumerState<MasukScreen> createState() => _MasukScreenState();
}

class _MasukScreenState extends ConsumerState<MasukScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty || password.isEmpty) {
      _showError('Email dan kata sandi wajib diisi');
      return;
    }

    FocusScope.of(context).unfocus();
    // Capture before the async gap so no BuildContext crosses it.
    final container = ProviderScope.containerOf(context);
    try {
      await ref.read(authProvider.notifier).signIn(email, password);
      // Ticket #74 — a home-screen widget clock action deferred while signed
      // out runs now that the session is live. The root router's auth
      // listener checks the same holder, so this is at most one run.
      await handlePendingWidgetAction(
        container,
        bridge: ref.read(widgetBridgeProvider),
      );
      // Success — the root router observes the signed-in state and swaps to
      // the shell. Nothing to navigate by hand.
    } on NetworkException catch (e) {
      if (mounted) _showError(e.message);
    } on ApiException catch (e) {
      if (mounted) _showError(e.message);
    } catch (_) {
      if (mounted) _showError('Terjadi kesalahan. Silakan coba lagi.');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  /// Biometric unlock (ticket #72). The prompt + device-refresh live in the
  /// notifier; a success flips [authProvider] and the router swaps to the
  /// shell. A cancelled prompt or a rejected credential stays on the password
  /// form with a gentle note.
  Future<void> _unlockWithBiometric() async {
    FocusScope.of(context).unfocus();
    final ok = await ref.read(authProvider.notifier).unlockWithBiometric();
    if (!ok && mounted) {
      _showError(
        'Tidak dapat membuka dengan sidik jari. Silakan masuk dengan kata sandi.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final colors = context.colors;
    final loading = auth.signingIn;

    // Ticket #72 — the biometric button is HIDDEN (not shown) unless a stored
    // device credential exists, biometrics are enrolled + unchanged, and the
    // enrolment marker was accepted.
    final biometricUnlock = ref.watch(biometricUnlockProvider);
    final biometricAvailable = biometricUnlock.value ?? false;

    // Surface the "sesi berakhir" notice left by a failed refresh exactly once.
    final notice = auth.notice;
    if (notice != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showError(notice);
        ref.read(authProvider.notifier).acknowledgeNotice();
      });
    }

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
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
                  const SizedBox(width: 12),
                  Flexible(
                    child: Text(
                      'KaryawanKu',
                      overflow: TextOverflow.ellipsis,
                      style: context.texts.titleLarge?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
              Text('Masuk', style: context.texts.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'Masuk untuk melanjutkan.',
                style: context.texts.bodyMedium?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 28),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.username],
                textInputAction: TextInputAction.next,
                enabled: !loading,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _password,
                obscureText: _obscure,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                enabled: !loading,
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'Kata sandi',
                  suffixIcon: IconButton(
                    tooltip: _obscure
                        ? 'Tampilkan kata sandi'
                        : 'Sembunyikan kata sandi',
                    icon: Icon(
                      _obscure ? LucideIcons.eye : LucideIcons.eyeOff,
                      size: 21,
                      color: colors.onSurfaceVariant,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {},
                  child: const Text('Lupa password?'),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: loading ? null : _submit,
                child: loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    : const Text('Masuk'),
              ),
              const SizedBox(height: 12),
              if (biometricAvailable) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: loading ? null : _unlockWithBiometric,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(LucideIcons.fingerprint, size: 20),
                      const SizedBox(width: 10),
                      // Flexible so the label wraps rather than splitting the
                      // button at a large text scale.
                      const Flexible(
                        child: Text(
                          'Masuk dengan sidik jari',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Center(
                child: Text.rich(
                  TextSpan(
                    text: 'Belum punya akun? ',
                    children: [
                      TextSpan(
                        text: 'Daftar',
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          color: colors.primary,
                        ),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                  style: context.texts.bodyMedium?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(height: 40),
              ToneBanner(
                icon: LucideIcons.info,
                background: context.status.infoContainer,
                foreground: context.status.onInfoContainer,
                margin: EdgeInsets.zero,
                child: const Text(_offlineNotice),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
