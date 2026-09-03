import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_provider.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';

/// Signed-in employee's profile: real `user.nama`, role and email from the
/// auth session, plus sign-out. Replaces the hardcoded `Mock.employee` reads
/// in the app bar / profile spots.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: const Text('Profil'),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                RoundToken(
                  label: user?.initials ?? '?',
                  background: colors.primaryContainer,
                  foreground: colors.onPrimaryContainer,
                  size: 72,
                ),
                const SizedBox(height: 16),
                Text(
                  user?.nama ?? '—',
                  textAlign: TextAlign.center,
                  style: context.texts.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  user?.roleLabel ?? '',
                  style: context.texts.bodyMedium?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          ListCard(
            children: [
              CardRow(
                leading: Icon(
                  LucideIcons.mail,
                  size: 20,
                  color: colors.onSurfaceVariant,
                ),
                title: 'Email',
                subtitle: user?.email ?? '—',
              ),
              CardRow(
                leading: Icon(
                  LucideIcons.userCheck,
                  size: 20,
                  color: colors.onSurfaceVariant,
                ),
                title: 'Status akun',
                subtitle: user?.status == 'aktif' ? 'Aktif' : 'Nonaktif',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Padding(
            padding: Insets.page,
            child: OutlinedButton.icon(
              onPressed: () => ref.read(authProvider.notifier).signOut(),
              icon: const Icon(LucideIcons.logOut, size: 20),
              label: const Text('Keluar'),
            ),
          ),
        ],
      ),
    );
  }
}