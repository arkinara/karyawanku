import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import 'payslip_provider.dart';

/// Payslip detail. The compliance lines (BPJS Kesehatan, JHT, JP, PPh 21, …)
/// and every total come from `GET /payslips/:id` and are rendered verbatim —
/// there is zero client-side arithmetic here. The download button fetches the
/// PDF bytes, saves them to the device and opens the share sheet.
class SlipDetailScreen extends ConsumerStatefulWidget {
  const SlipDetailScreen({super.key, required this.payslip});

  /// The summary row the list already has; the full breakdown is fetched on
  /// mount from the server.
  final Payslip payslip;

  @override
  ConsumerState<SlipDetailScreen> createState() => _SlipDetailScreenState();
}

class _SlipDetailScreenState extends ConsumerState<SlipDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(payslipProvider.notifier).select(widget.payslip.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final payslip = ref.watch(payslipProvider);
    final detail = payslip.selected;

    // Surface one-shot download success/failure as a snackbar, then clear it.
    ref.listen(payslipProvider.select((s) => s.message), (prev, next) {
      if (next == null) return;
      final messenger = ScaffoldMessenger.of(context);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(next)));
      ref.read(payslipProvider.notifier).clearMessage();
    });

    final downloading = payslip.downloading;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: Text(widget.payslip.periodLabel),
        actions: [
          IconButton(
            onPressed: downloading
                ? null
                : () => ref
                      .read(payslipProvider.notifier)
                      .download(
                        widget.payslip.id,
                        fileName: _fileName(widget.payslip),
                      ),
            tooltip: 'Unduh PDF',
            icon: downloading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(LucideIcons.download),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _DetailBody(
        detail: detail,
        loading: detail == null && payslip.detailError == null,
        error: payslip.detailError,
        onRetry: () =>
            ref.read(payslipProvider.notifier).select(widget.payslip.id),
        fallbackPeriod: widget.payslip.periodLabel,
      ),
    );
  }

  static String _fileName(Payslip payslip) {
    final slug = payslip.employeeName
        .toLowerCase()
        .replaceAll(RegExp(r'\s+'), '-')
        .replaceAll(RegExp(r'[^a-z0-9-]'), '');
    final name = slug.isEmpty ? 'karyawan' : slug;
    return 'slip-gaji-$name-${payslip.periode}.pdf';
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({
    required this.detail,
    required this.loading,
    required this.error,
    required this.onRetry,
    required this.fallbackPeriod,
  });

  final PayslipDetail? detail;
  final bool loading;
  final String? error;
  final VoidCallback onRetry;
  final String fallbackPeriod;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;

    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (detail == null) {
      return _ErrorState(message: error ?? 'Gagal memuat rincian', onRetry: onRetry);
    }

    final breakdown = detail!.breakdown;
    final totals = breakdown.totals;

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(detail!.periodLabel, style: context.texts.headlineLarge),
              const SizedBox(height: 4),
              Text(
                detail!.employeeName,
                style: context.texts.bodyMedium?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
              ),
              if (detail!.jabatan.isNotEmpty)
                Text(
                  detail!.jabatan,
                  style: context.texts.bodyMedium?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Semantics(
          label: 'Take-home ${Fmt.rupiah(totals.takeHome)}',
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
                    Fmt.rupiah(totals.takeHome),
                    style: context.texts.displaySmall?.copyWith(
                      color: colors.onPrimaryContainer,
                      fontFeatures: Fmt.tabular,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Take-home sesuai payroll run server',
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
          title: 'Pendapatan · ${Fmt.rupiah(totals.totalEarnings)}',
          color: status.onSuccessContainer,
          lines: breakdown.earnings,
        ),
        if (breakdown.deductions.isNotEmpty)
          _LineSection(
            title: 'Potongan · ${Fmt.rupiah(totals.totalDeductions)}',
            color: status.onDangerContainer,
            lines: breakdown.deductions,
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Text(
            _disclaimer,
            style: context.texts.labelMedium?.copyWith(
              height: 1.4,
              color: colors.onSurfaceVariant,
            ),
          ),
        ),
      ],
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
                title: line.namaKomponen,
                trailing: Fmt.rupiah(line.nominal),
              ),
          ],
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: Insets.page,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              LucideIcons.alertCircle,
              size: 40,
              color: context.status.onDangerContainer,
            ),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(LucideIcons.rotateCcw, size: 18),
              label: const Text('Coba lagi'),
            ),
          ],
        ),
      ),
    );
  }
}

const _disclaimer =
    'Slip gaji ini dihasilkan otomatis oleh sistem. Hubungi Owner untuk koreksi.';