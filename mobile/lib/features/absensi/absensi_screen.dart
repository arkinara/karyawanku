import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/mock_data.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';

/// Attendance — clock-in direction A ("geofence card") from the design doc:
/// big clock, location chip, selfie slot, one primary pill button.
class AbsensiScreen extends StatelessWidget {
  const AbsensiScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final status = context.status;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () {},
          tooltip: 'Menu',
          icon: const Icon(LucideIcons.menu),
        ),
        title: const Text('Absensi'),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          if (Mock.isOffline)
            ToneBanner(
              icon: LucideIcons.wifiOff,
              background: status.warningContainer,
              foreground: status.onWarningContainer,
              action: 'LIHAT',
              live: true,
              onAction: () => _showQueue(context),
              child: Text(
                'Offline — ${Mock.queuedEntries} entri menunggu kirim',
              ),
            ),
          const _ClockCard(),
          const SectionLabel('Hari ini', top: 8),
          ListCard(
            children: [
              for (final entry in Mock.todayEntries)
                CardRow(
                  minHeight: 64,
                  leading: _StateDot(entry.state),
                  title: entry.label,
                  subtitle: entry.note,
                  subtitleColor: entry.state == AttendanceState.pendingSync
                      ? status.onWarningContainer
                      : null,
                  // Time is a value, not a control — spoken with the row.
                  semanticLabel: _entryLabel(entry),
                  trailingWidget: Text(
                    entry.time,
                    textAlign: TextAlign.end,
                    style: context.texts.bodyLarge?.copyWith(
                      color: context.colors.onSurfaceVariant,
                      fontFeatures: Fmt.tabular,
                    ),
                  ),
                ),
            ],
          ),
          const SectionLabel('Bulan ini'),
          Padding(
            padding: Insets.page,
            child: Row(
              children: [
                Expanded(
                  child: StatTile(
                    value: '${Mock.monthHadir}',
                    label: 'Hadir',
                    background: status.successContainer,
                    foreground: status.onSuccessContainer,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: StatTile(
                    value: '${Mock.monthTelat}',
                    label: 'Telat',
                    background: status.warningContainer,
                    foreground: status.onWarningContainer,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: StatTile(
                    value: '${Mock.monthIzin}',
                    label: 'Izin',
                    background: status.infoContainer,
                    foreground: status.onInfoContainer,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _entryLabel(AttendanceEntry entry) {
    final time = entry.state == AttendanceState.empty
        ? 'belum tercatat'
        : entry.time;
    return [entry.label, entry.note, time].whereType<String>().join(', ');
  }

  void _showQueue(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Antrean offline', style: sheetContext.texts.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Entri tersimpan di perangkat dan terkirim otomatis saat sinyal kembali.',
              style: sheetContext.texts.bodyMedium?.copyWith(
                color: sheetContext.colors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            ListCard(
              margin: EdgeInsets.zero,
              children: [
                CardRow(
                  minHeight: 64,
                  leading: const _StateDot(AttendanceState.pendingSync),
                  title: 'Kembali',
                  subtitle: 'Menunggu sinkronisasi',
                  subtitleColor: sheetContext.status.onWarningContainer,
                  trailingWidget: TextButton(
                    onPressed: () {},
                    child: const Text('Coba lagi'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Wall clock, geofence chip, selfie slot and the single primary action.
class _ClockCard extends StatelessWidget {
  const _ClockCard();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;
    final inside = Mock.insideGeofence;

    final geofence = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: inside ? status.successContainer : status.warningContainer,
        borderRadius: Shape.rMd,
      ),
      child: Row(
        children: [
          Icon(
            LucideIcons.mapPin,
            size: 20,
            color: inside
                ? status.onSuccessContainer
                : status.onWarningContainer,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  inside ? 'Di dalam area' : 'Di luar area',
                  style: context.texts.bodySmall?.copyWith(
                    fontWeight: FontWeight.w500,
                    color: inside
                        ? status.onSuccessContainer
                        : status.onWarningContainer,
                  ),
                ),
                Text(
                  '${Mock.employee.branch} · ${Mock.geofenceDistance}',
                  style: context.texts.labelMedium?.copyWith(
                    color: inside
                        ? status.onSuccessContainer
                        : status.onWarningContainer,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: colors.surfaceContainerLowest,
        borderRadius: Shape.rXl,
        border: Border.all(color: colors.outlineVariant),
        boxShadow: status.elevation(1),
      ),
      child: Column(
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              Mock.wallClock,
              style: context.texts.displayLarge?.copyWith(
                fontFeatures: Fmt.tabular,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${Mock.timezone} · ${Fmt.longDate(Mock.today)}',
            textAlign: TextAlign.center,
            style: context.texts.bodyMedium?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 20),
          // Side by side normally; stacked once the location line wraps.
          if (context.isLargeText) ...[
            geofence,
            const SizedBox(height: 8),
            const SizedBox(height: 96, child: _SelfieSlot()),
          ] else
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: geofence),
                  const SizedBox(width: 8),
                  const SizedBox(width: 72, child: _SelfieSlot()),
                ],
              ),
            ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () {},
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(64),
              textStyle: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                letterSpacing: .1,
              ),
            ),
            icon: const Icon(LucideIcons.clock, size: 24),
            label: const Text('Clock Out'),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Lokasi & foto dikirim bersama absensi',
              style: context.texts.labelMedium?.copyWith(
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dashed slot that holds the verification selfie once taken.
class _SelfieSlot extends StatelessWidget {
  const _SelfieSlot();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Ambil selfie verifikasi',
      excludeSemantics: true,
      child: DashedBorder(
        child: Container(
          decoration: BoxDecoration(
            color: context.colors.surfaceContainerHigh,
            borderRadius: Shape.rMd,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                LucideIcons.camera,
                size: 20,
                color: context.colors.onSurfaceVariant,
              ),
              const SizedBox(height: 2),
              Text(
                'Selfie',
                style: context.texts.labelSmall?.copyWith(
                  fontSize: 10,
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

/// Timeline bullet: green for synced, amber for queued, grey for not yet.
/// Decorative — the row's semantic label carries the state in words.
class _StateDot extends StatelessWidget {
  const _StateDot(this.state);

  final AttendanceState state;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: switch (state) {
            AttendanceState.done => context.status.success,
            AttendanceState.pendingSync => context.status.warning,
            AttendanceState.empty => context.colors.outlineVariant,
          },
        ),
      ),
    );
  }
}
