import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import 'ajukan_cuti_screen.dart';
import 'leave_provider.dart';

/// Leave. Balances first (the number staff actually came to check), then the
/// request history filtered by status. Both come from the BE for the
/// signed-in employee — the server resolves the employee from the JWT.
class CutiScreen extends ConsumerStatefulWidget {
  const CutiScreen({super.key});

  @override
  ConsumerState<CutiScreen> createState() => _CutiScreenState();
}

class _CutiScreenState extends ConsumerState<CutiScreen> {
  static const _filters = ['Semua', 'Menunggu', 'Selesai'];
  int _filter = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(leaveProvider.notifier).loadAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final leave = ref.watch(leaveProvider);

    final visible = switch (_filter) {
      1 => leave.requests
          .where((r) => r.status == LeaveStatus.menunggu)
          .toList(),
      2 => leave.requests
          .where((r) => r.status != LeaveStatus.menunggu)
          .toList(),
      _ => leave.requests,
    };

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () {},
          tooltip: 'Menu',
          icon: const Icon(LucideIcons.menu),
        ),
        title: const Text('Cuti'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openForm,
        icon: const Icon(LucideIcons.plus),
        label: const Text('Ajukan'),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          if (leave.error != null)
            _ErrorState(
              message: leave.error!,
              onRetry: () => ref.read(leaveProvider.notifier).loadAll(),
            ),
          if (leave.loading && leave.balances.isEmpty && leave.requests.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            _Balances(balances: leave.balances),
            const SizedBox(height: 20),
            ChipRow(
              labels: _filters,
              selectedIndex: _filter,
              onSelected: (i) => setState(() => _filter = i),
            ),
            const SizedBox(height: 16),
            if (visible.isEmpty)
              _EmptyState(filter: _filters[_filter])
            else
              for (final request in visible)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                  child: _RequestCard(request),
                ),
          ],
        ],
      ),
    );
  }

  void _openForm() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const AjukanCutiScreen()));
  }
}

/// Full-screen load-failure state: retry, never zero balances presented as
/// fact.
class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 32, 32, 8),
      child: Column(
        children: [
          Icon(
            LucideIcons.circleAlert,
            size: 40,
            color: context.colors.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: context.texts.bodyMedium,
          ),
          const SizedBox(height: 16),
          FilledButton.tonal(
            onPressed: onRetry,
            child: const Text('Coba lagi'),
          ),
        ],
      ),
    );
  }
}

/// Balance tiles from the server. The annual (Tahunan) tile is highlighted —
/// it is the one the Ajukan Cuti form's preview draws from. The tiles fall to
/// a column once the labels no longer fit side by side.
class _Balances extends StatelessWidget {
  const _Balances({required this.balances});

  final List<LeaveBalance> balances;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      for (final balance in balances)
        _BalanceTile(
          balance: balance,
          highlight: balance.label.toLowerCase().contains('tahunan'),
        ),
    ];

    return Padding(
      padding: Insets.page,
      child: context.isLargeText
          ? Column(
              children: [
                for (final tile in tiles)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: tile,
                  ),
              ],
            )
          : IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < tiles.length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(child: tiles[i]),
                  ],
                ],
              ),
            ),
    );
  }
}

class _BalanceTile extends StatelessWidget {
  const _BalanceTile({required this.balance, required this.highlight});

  final LeaveBalance balance;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;

    final label = highlight
        ? status.onPrimaryContainerMuted(colors)
        : colors.onSurfaceVariant;

    return Semantics(
      label:
          'Cuti ${balance.label}: sisa ${balance.remaining} '
          'dari ${balance.total} hari',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: highlight
              ? colors.primaryContainer
              : colors.surfaceContainerLowest,
          borderRadius: Shape.rLg,
          border: highlight ? null : Border.all(color: colors.outlineVariant),
          boxShadow: status.elevation(1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              balance.label,
              style: context.texts.labelMedium?.copyWith(color: label),
            ),
            const SizedBox(height: 4),
            Text(
              '${balance.remaining}',
              style: context.texts.headlineSmall?.copyWith(
                fontSize: 26,
                height: 1,
                color: highlight ? colors.onPrimaryContainer : colors.onSurface,
                fontFeatures: Fmt.tabular,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'dari ${balance.total} hari',
              style: context.texts.labelSmall?.copyWith(color: label),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});

  final String filter;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 32, 32, 16),
      child: Column(
        children: [
          Icon(
            LucideIcons.calendar,
            size: 40,
            color: context.colors.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'Belum ada pengajuan "$filter"',
            textAlign: TextAlign.center,
            style: context.texts.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            'Pengajuan cuti yang cocok dengan filter ini akan muncul di sini.',
            textAlign: TextAlign.center,
            style: context.texts.bodyMedium?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard(this.request);

  final LeaveRequest request;

  ({Color background, Color foreground, Color accent}) _tone(
    BuildContext context,
  ) {
    final status = context.status;
    return switch (request.status) {
      LeaveStatus.menunggu => (
        background: context.accentContainer,
        foreground: context.onAccentContainer,
        accent: context.accent,
      ),
      LeaveStatus.disetujui => (
        background: status.successContainer,
        foreground: status.onSuccessContainer,
        accent: status.success,
      ),
      LeaveStatus.ditolak => (
        background: status.dangerContainer,
        foreground: status.onDangerContainer,
        accent: status.danger,
      ),
    };
  }

  String get _range => request.days == 1
      ? '${Fmt.date(request.start)} · 1 hari'
      : '${Fmt.date(request.start)} – ${Fmt.date(request.end)} · ${request.days} hari';

  @override
  Widget build(BuildContext context) {
    final tone = _tone(context);

    return Semantics(
      label: [
        request.kindLabel,
        request.statusLabel,
        _range,
        request.reason,
        request.decisionNote,
        request.meta,
      ].whereType<String>().join('. '),
      excludeSemantics: true,
      child: Container(
        decoration: BoxDecoration(
          color: context.colors.surfaceContainerLowest,
          borderRadius: Shape.rXl,
          border: Border.all(color: context.colors.outlineVariant),
          boxShadow: context.status.elevation(1),
        ),
        clipBehavior: Clip.antiAlias,
        // A 3 dp status rail replaces the web card's left border; Flutter will
        // not paint a rounded box whose sides differ in colour, so the rail is
        // a sibling rather than a BorderSide.
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: tone.accent),
              Expanded(child: _body(context, tone)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    ({Color background, Color foreground, Color accent}) tone,
  ) {
    final muted = context.colors.onSurfaceVariant;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Wrap, not Row: the status pill drops below the title instead of
          // squeezing it when text is scaled up.
          Wrap(
            spacing: 10,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                request.kindLabel,
                style: context.texts.titleMedium?.copyWith(fontSize: 17),
              ),
              StatusPill(
                label: request.statusLabel,
                background: tone.background,
                foreground: tone.foreground,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _range,
            style: context.texts.bodyLarge?.copyWith(
              fontSize: 15,
              color: muted,
              fontFeatures: Fmt.tabular,
            ),
          ),
          const SizedBox(height: 8),
          if (request.reason != null)
            Text(
              request.reason!,
              style: context.texts.bodyMedium?.copyWith(color: muted),
            ),
          if (request.decisionNote != null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: tone.background,
                borderRadius: Shape.rSm,
              ),
              child: Text(
                request.decisionNote!,
                style: context.texts.bodySmall?.copyWith(
                  color: tone.foreground,
                ),
              ),
            ),
          ],
          if (request.meta != null) ...[
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(LucideIcons.clock, size: 15, color: muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    request.meta!,
                    style: context.texts.bodySmall?.copyWith(color: muted),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}