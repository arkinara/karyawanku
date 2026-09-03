import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../data/mock_data.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import '../shell/home_shell.dart';

/// Sign-in. M3 outlined fields with floating labels, pill buttons, and the
/// offline reassurance note that sets expectations before the first shift.
class MasukScreen extends StatefulWidget {
  const MasukScreen({super.key});

  @override
  State<MasukScreen> createState() => _MasukScreenState();
}

class _MasukScreenState extends State<MasukScreen> {
  final _email = TextEditingController(text: 'nama@usaha.com');
  final _password = TextEditingController(text: 'rahasia123');
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _enter() {
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const HomeShell()));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

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
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _password,
                obscureText: _obscure,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _enter(),
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
              FilledButton(onPressed: _enter, child: const Text('Masuk')),
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: _enter,
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
                child: const Text(Mock.offlineNotice),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
