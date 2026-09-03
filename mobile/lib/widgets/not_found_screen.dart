import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/tokens.dart';

/// Generic not-found page for deep links that do not resolve (wrong scheme,
/// unknown id, or a cross-employee target the guard rejected). Never leaks
/// another employee's data — this is the terminal state for a bad link.
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: const Text('Tidak Ditemukan'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                LucideIcons.searchX,
                size: 48,
                color: context.colors.onSurfaceVariant,
              ),
              const SizedBox(height: 16),
              Text(
                'Halaman tidak ditemukan',
                textAlign: TextAlign.center,
                style: context.texts.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Tautan yang Anda buka tidak tersedia atau tidak lagi valid.',
                textAlign: TextAlign.center,
                style: context.texts.bodyMedium?.copyWith(
                  color: context.colors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}