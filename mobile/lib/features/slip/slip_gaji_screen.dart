import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/mock_data.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import 'slip_detail_screen.dart';

/// Payslip list: the newest one as a tonal hero with earnings/deductions
/// split, then history including THR.
class SlipGajiScreen extends StatefulWidget {
  const SlipGajiScreen({super.key});

  @override
  State<SlipGajiScreen> createState() => _SlipGajiScreenState();
}

class _SlipGajiScreenState extends State<SlipGajiScreen> {
  static const _filters = ['Semua', '2026', '2025'];
  int _filter = 0;

  List<Payslip> get _history => Mock.payslipHistory
      .skip(1)
      .where(
        (p) => _filter == 0 || p.paidOn.year.toString() == _filters[_filter],
      )
      .toList();

  @override
  Widget build(BuildContext context) {
    final latest = Mock.latestPayslip;
    final history = _history;

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
                    '${Mock.employee.name} · ${Mock.employee.role}',
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
            ChipRow(
              labels: _filters,
              selectedIndex: _filter,
              onSelected: (i) => setState(() => _filter = i),
            ),
            const SizedBox(height: 20),
            _LatestCard(payslip: latest, onOpen: () => _open(latest)),
            const SectionLabel('Riwayat'),
            if (history.isEmpty)
              _EmptyHistory(year: _filters[_filter])
            else
              ListCard(
                children: [
                  for (final slip in history)
                    CardRow(
                      leading: RoundToken(
                        icon: slip.isThr
                            ? LucideIcons.banknote
                            : LucideIcons.fileText,
                        background: slip.isThr
                            ? context.status.warningContainer
                            : context.colors.surfaceContainerHigh,
                        foreground: slip.isThr
                            ? context.status.onWarningContainer
                            : context.colors.onSurfaceVariant,
                      ),
                      title: slip.period,
                      subtitle: Fmt.date(slip.paidOn),
                      trailing: Fmt.rupiah(slip.takeHome),
                      onTap: () => _open(slip),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  void _open(Payslip slip) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => SlipDetailScreen(payslip: slip)));
  }
}

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory({required this.year});

  final String year;

  @override
  Widget build(BuildContext context) {
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
            'Belum ada slip gaji untuk $year',
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
          'Slip gaji terbaru ${payslip.period}, '
          '${Fmt.rupiah(payslip.takeHome)}, dibayar '
          '${Fmt.date(payslip.paidOn)} ke ${payslip.account}',
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
                            'Terbaru · ${payslip.period}',
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
                            'Dibayar ${Fmt.date(payslip.paidOn)} · '
                            '${payslip.account}',
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
                const SizedBox(height: 16),
                // Wrap, not Row: the two rupiah totals no longer fit side by
                // side once text is scaled up.
                _MiniStats(payslip: payslip),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MiniStats extends StatelessWidget {
  const _MiniStats({required this.payslip});

  final Payslip payslip;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      _MiniStat(
        label: 'Pendapatan',
        value: Fmt.rupiah(payslip.totalEarnings),
        color: context.status.onSuccessContainer,
      ),
      _MiniStat(
        label: 'Potongan',
        value: Fmt.rupiah(payslip.totalDeductions),
        color: context.status.onDangerContainer,
      ),
    ];

    if (context.isLargeText) {
      return Column(
        children: [tiles.first, const SizedBox(height: 8), tiles.last],
      );
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: tiles.first),
          const SizedBox(width: 8),
          Expanded(child: tiles.last),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: context.status.containerOverlay,
        borderRadius: Shape.rSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.texts.labelSmall?.copyWith(
              color: context.status.onPrimaryContainerMuted(context.colors),
            ),
          ),
          Text(
            value,
            style: context.texts.titleSmall?.copyWith(
              color: color,
              fontFeatures: Fmt.tabular,
            ),
          ),
        ],
      ),
    );
  }
}
