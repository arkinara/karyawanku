import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/format.dart';
import '../../data/mock_data.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';

/// Payslip detail. Take-home sits above the fold; the compliance lines
/// (BPJS Kesehatan/JHT/JP, PPh 21) are spelled out rather than summed away.
class SlipDetailScreen extends ConsumerWidget {
  const SlipDetailScreen({super.key, required this.payslip});

  final Payslip payslip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final status = context.status;
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: const Text('Slip Gaji'),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(LucideIcons.download),
            tooltip: 'Unduh PDF',
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(payslip.period, style: context.texts.headlineLarge),
                const SizedBox(height: 4),
                Text(
                  'Digenerate ${Fmt.date(payslip.paidOn)} · '
                  '${user == null ? Mock.employee.name : user.nama}, '
                  '${user == null ? Mock.employee.role : user.roleLabel}',
                  style: context.texts.bodyMedium?.copyWith(
                    color: colors.onSurfaceVariant,
                    fontFeatures: Fmt.tabular,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Semantics(
            label:
                'Take-home ${Fmt.rupiah(payslip.takeHome)}, '
                'ditransfer ke ${payslip.account}',
            excludeSemantics: true,
            child: Container(
              margin: Insets.page,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: colors.primaryContainer,
                borderRadius: Shape.rXl,
                boxShadow: status.elevation(1),
              ),
              child: Column(
                children: [
                  Text(
                    'TAKE-HOME',
                    style: context.texts.bodySmall?.copyWith(
                      fontWeight: FontWeight.w500,
                      letterSpacing: .4,
                      color: colors.onPrimaryContainer,
                    ),
                  ),
                  const SizedBox(height: 6),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      Fmt.rupiah(payslip.takeHome),
                      style: context.texts.displaySmall?.copyWith(
                        color: colors.onPrimaryContainer,
                        fontFeatures: Fmt.tabular,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Ditransfer ke ${payslip.account}',
                    textAlign: TextAlign.center,
                    style: context.texts.bodySmall?.copyWith(
                      color: status.onPrimaryContainerMuted(colors),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _LineSection(
            title: 'Pendapatan · ${Fmt.rupiah(payslip.totalEarnings)}',
            color: status.onSuccessContainer,
            lines: payslip.earnings,
          ),
          if (payslip.deductions.isNotEmpty)
            _LineSection(
              title: 'Potongan · ${Fmt.rupiah(payslip.totalDeductions)}',
              color: status.onDangerContainer,
              lines: payslip.deductions,
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Text(
              Mock.payslipDisclaimer,
              style: context.texts.labelMedium?.copyWith(
                height: 1.4,
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LineSection extends StatelessWidget {
  const _LineSection({
    required this.title,
    required this.color,
    required this.lines,
  });

  final String title;
  final Color color;
  final List<PayslipLine> lines;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 10),
          child: Text(
            title,
            style: context.texts.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: .3,
              color: color,
            ),
          ),
        ),
        ListCard(
          children: [
            for (final line in lines)
              CardRow(
                minHeight: 52,
                title: line.label,
                trailing: Fmt.rupiah(line.amount),
              ),
          ],
        ),
      ],
    );
  }
}
