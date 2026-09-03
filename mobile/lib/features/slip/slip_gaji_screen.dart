import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/format.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import 'payslip_provider.dart';
import 'slip_detail_screen.dart';

/// Payslip list. The newest payslip is promoted to a tonal hero card, then the
/// rest render as history. Year filter chips are derived from the years
/// actually present in the server data — never a hardcoded 2026/2025 pair.
/// THR rows are flagged from the server (`is_thr` / `category`), not a fixture.
class SlipGajiScreen extends ConsumerStatefulWidget {
  const SlipGajiScreen({super.key});

  @override
  ConsumerState<SlipGajiScreen> createState() => _SlipGajiScreenState();
}

class _SlipGajiScreenState extends ConsumerState<SlipGajiScreen> {
  static const _allYears = 'Semua';

  /// Selected year chip index. `0` = all years; rebuilt lazily from the data.
  int _filter = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(payslipProvider.notifier).loadList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final payslips = ref.watch(payslipProvider);
    final user = ref.watch(authProvider).user;

    // Years present in the data, newest first — drives the chips.
    final years = <int>[];
    for (final p in payslips.payslips) {
      if (!years.contains(p.year)) years.add(p.year);
    }
    final labels = [for (final y in years) '$y'];
    if (_filter >= labels.length + 1) _filter = 0;

    final latest = payslips.payslips.isNotEmpty
        ? payslips.payslips.first
        : null;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user == null
                        ? 'Karyawan'
                        : '${user.nama} · ${user.roleLabel}',
                    style: context.texts.bodyMedium?.copyWith(
                      color: context.colors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('Slip Gaji', style: context.texts.headlineLarge),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (payslips.loading && payslips.payslips.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (payslips.error != null && payslips.payslips.isEmpty)
              _ErrorState(
                message: payslips.error!,
                onRetry: () => ref.read(payslipProvider.notifier).loadList(),
              )
            else if (payslips.payslips.isEmpty)
              const _EmptyState()
            else ...[
              ChipRow(
                labels: [_allYears, ...labels],
                selectedIndex: _filter,
                onSelected: (i) => setState(() => _filter = i),
              ),
              const SizedBox(height: 20),
              if (latest != null)
                _LatestCard(payslip: latest, onOpen: () => _open(latest)),
              const SectionLabel('Riwayat'),
              _HistoryList(
                payslips: _filteredHistory(payslips.payslips, latest, labels),
                year: _filter == 0 ? null : labels[_filter - 1],
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Payslip> _filteredHistory(
    List<Payslip> all,
    Payslip? latest,
    List<String> labels,
  ) {
    final selectedYear = _filter == 0 ? null : labels[_filter - 1];
    final wanted = selectedYear == null ? null : int.parse(selectedYear);
    final out = <Payslip>[];
    for (final p in all) {
      if (latest != null && p.id == latest.id) continue;
      if (wanted != null && p.year != wanted) continue;
      out.add(p);
    }
    return out;
  }

  void _open(Payslip slip) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => SlipDetailScreen(payslip: slip)));
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.payslips, required this.year});

  final List<Payslip> payslips;
  final String? year;

  static String? _historySubtitle(Payslip slip) {
    final parts = <String>[];
    if (slip.isThr) parts.add('THR');
    final created = slip.createdAt;
    if (created != null) parts.add('Digenerate ${Fmt.date(created)}');
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    if (payslips.isEmpty) {
      return _EmptyHistory(year: year);
    }
    return ListCard(
      children: [
        for (final slip in payslips)
          CardRow(
            leading: RoundToken(
              icon: slip.isThr ? LucideIcons.banknote : LucideIcons.fileText,
              background: slip.isThr
                  ? context.status.warningContainer
                  : context.colors.surfaceContainerHigh,
              foreground: slip.isThr
                  ? context.status.onWarningContainer
                  : context.colors.onSurfaceVariant,
            ),
            title: slip.periodLabel,
            subtitle: _historySubtitle(slip),
            trailing: Fmt.rupiah(slip.takeHome),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SlipDetailScreen(payslip: slip),
              ),
            ),
          ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 48, 32, 48),
      child: Column(
        children: [
          Icon(
            LucideIcons.fileText,
            size: 40,
            color: context.colors.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'Belum ada slip gaji tersedia',
            textAlign: TextAlign.center,
            style: context.texts.titleMedium,
          ),
          const SizedBox(height: 4),
          Text(
            'Slip gaji akan muncul di sini setelah payroll periode berjalan disetujui.',
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

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Insets.page,
      child: Column(
        children: [
          Icon(
            LucideIcons.alertCircle,
            size: 40,
            color: context.status.onDangerContainer,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: context.texts.bodyMedium,
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(LucideIcons.rotateCcw, size: 18),
            label: const Text('Coba lagi'),
          ),
        ],
      ),
    );
  }
}

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory({this.year});

  final String? year;

  @override
  Widget build(BuildContext context) {
    final label = year == null ? 'tahun ini' : 'tahun $year';
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 16, 32, 16),
      child: Column(
        children: [
          Icon(
            LucideIcons.fileText,
            size: 40,
            color: context.colors.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'Belum ada slip gaji lain untuk $label',
            textAlign: TextAlign.center,
            style: context.texts.titleMedium,
          ),
        ],
      ),
    );
  }
}

class _LatestCard extends StatelessWidget {
  const _LatestCard({required this.payslip, required this.onOpen});

  final Payslip payslip;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;

    return Semantics(
      button: true,
      label:
          'Slip gaji terbaru ${payslip.periodLabel}, '
          '${Fmt.rupiah(payslip.takeHome)}, '
          'digenerate ${payslip.createdAt == null ? '' : Fmt.date(payslip.createdAt!)}',
      excludeSemantics: true,
      child: Container(
        margin: Insets.page,
        decoration: BoxDecoration(
          color: colors.primaryContainer,
          borderRadius: Shape.rXl,
          boxShadow: status.elevation(1),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onOpen,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Terbaru · ${payslip.periodLabel}',
                            style: context.texts.bodySmall?.copyWith(
                              color: status.onPrimaryContainerMuted(colors),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            Fmt.rupiah(payslip.takeHome),
                            style: context.texts.headlineMedium?.copyWith(
                              color: colors.onPrimaryContainer,
                              fontFeatures: Fmt.tabular,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            payslip.createdAt == null
                                ? ''
                                : 'Digenerate ${Fmt.date(payslip.createdAt!)}',
                            style: context.texts.bodySmall?.copyWith(
                              color: status.onPrimaryContainerMuted(colors),
                              fontFeatures: Fmt.tabular,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: status.containerOverlay,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        LucideIcons.download,
                        size: 20,
                        color: colors.onPrimaryContainer,
                      ),
                    ),
                  ],
                ),
                if (payslip.isThr) ...[const SizedBox(height: 12), _ThrBadge()],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ThrBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: context.status.warningContainer,
        borderRadius: Shape.rSm,
      ),
      child: Text(
        'THR',
        style: context.texts.labelMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: context.status.onWarningContainer,
        ),
      ),
    );
  }
}
