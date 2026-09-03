import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/mock_data.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import '../jadwal/jadwal_screen.dart';
import '../shell/home_shell.dart';

/// Home. The shift hero answers "am I on the clock and for how much longer",
/// then three tonal shortcuts, then the two things staff check most often.
class BerandaScreen extends StatelessWidget {
  const BerandaScreen({super.key, required this.onOpenTab});

  /// Switches the surrounding [HomeShell] tab — used by the shortcut row.
  final ValueChanged<int> onOpenTab;

  @override
  Widget build(BuildContext context) {
    final upcoming = Mock.shifts.where((s) => !s.isToday).take(3).toList();
    final latest = Mock.latestPayslip;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            const _Header(),
            const _ShiftHero(),
            const SizedBox(height: 16),
            _Shortcuts(onOpenTab: onOpenTab),
            SectionLabel(
              'Jadwal 3 hari ke depan',
              action: 'Lihat semua',
              onAction: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const JadwalScreen())),
            ),
            ListCard(
              children: [
                for (final shift in upcoming)
                  CardRow(
                    leading: RoundToken(
                      label: Fmt.day2(shift.date),
                      background: shift.kind == ShiftKind.siang
                          ? context.status.infoContainer
                          : context.colors.primaryContainer,
                      foreground: shift.kind == ShiftKind.siang
                          ? context.status.onInfoContainer
                          : context.colors.onPrimaryContainer,
                    ),
                    title: shift.label,
                    subtitle:
                        '${Fmt.dayNames[shift.date.weekday - 1]} · ${shift.range}',
                  ),
              ],
            ),
            const SectionLabel('Slip gaji terakhir'),
            ListCard(
              children: [
                CardRow(
                  title: latest.period,
                  subtitle: 'Dibayar ${Fmt.date(latest.paidOn)}',
                  trailingWidget: Text(
                    Fmt.rupiah(latest.takeHome),
                    textAlign: TextAlign.end,
                    style: context.texts.titleMedium?.copyWith(
                      fontSize: 18,
                      color: context.colors.primary,
                      fontFeatures: Fmt.tabular,
                    ),
                  ),
                  semanticLabel:
                      'Slip gaji ${latest.period}, dibayar '
                      '${Fmt.date(latest.paidOn)}, ${Fmt.rupiah(latest.takeHome)}',
                  onTap: () => onOpenTab(3),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Padding(
      // Was a fixed 64 dp box; two lines of scaled-up text overflowed it.
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(Mock.greeting, style: context.texts.titleMedium),
                  Text(
                    '${Mock.employee.company} · '
                    '${Mock.employee.branch.replaceFirst('Cabang ', '')}',
                    style: context.texts.labelMedium?.copyWith(
                      color: context.colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () {},
              tooltip: 'Notifikasi',
              icon: Badge(
                label: const Text('${Mock.notificationCount}'),
                child: const Icon(LucideIcons.bell, size: 24),
              ),
            ),
            const SizedBox(width: 4),
            Semantics(
              label: 'Profil ${Mock.employee.name}',
              button: true,
              child: const EmployeeAvatar(),
            ),
          ],
        ),
      ),
    );
  }
}

/// Teal hero card: status, elapsed time, and shift progress.
class _ShiftHero extends StatelessWidget {
  const _ShiftHero();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final onHero = colors.onPrimary;

    return Semantics(
      label:
          'Sedang bekerja, ${Mock.currentShiftLabel}. '
          'Sudah ${Fmt.duration(Mock.workedMinutes)}. '
          'Masuk ${Mock.clockedInAt}, pulang ${Mock.shiftEndsAt}.',
      excludeSemantics: true,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: colors.primary,
          borderRadius: Shape.rXl,
          boxShadow: context.status.elevation(2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Both halves were unbounded, so the row split at 412 dp once
                // the status pill grew.
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: onHero.withValues(alpha: .18),
                      borderRadius: Shape.rSm,
                    ),
                    child: Text(
                      'SEDANG BEKERJA',
                      overflow: TextOverflow.ellipsis,
                      style: context.texts.labelMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                        letterSpacing: .4,
                        color: onHero,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    Mock.currentShiftLabel,
                    textAlign: TextAlign.end,
                    overflow: TextOverflow.ellipsis,
                    style: context.texts.bodySmall?.copyWith(
                      color: onHero.withValues(alpha: .78),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                Fmt.duration(Mock.workedMinutes),
                style: context.texts.displayMedium?.copyWith(
                  color: onHero,
                  fontFeatures: Fmt.tabular,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Masuk ${Mock.clockedInAt} · pulang ${Mock.shiftEndsAt}',
              style: context.texts.bodySmall?.copyWith(
                color: onHero.withValues(alpha: .78),
                fontFeatures: Fmt.tabular,
              ),
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(Shape.full),
              child: LinearProgressIndicator(
                value: Mock.shiftProgress,
                minHeight: 4,
                backgroundColor: onHero.withValues(alpha: .24),
                valueColor: AlwaysStoppedAnimation(onHero),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Three tonal shortcuts. They sit side by side until the labels grow, then
/// stack so no label is clipped.
class _Shortcuts extends StatelessWidget {
  const _Shortcuts({required this.onOpenTab});

  final ValueChanged<int> onOpenTab;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final items = [
      (LucideIcons.clock, 'Clock Out', true, 1),
      (LucideIcons.calendar, 'Ajukan Cuti', false, 2),
      (LucideIcons.fileText, 'Slip Gaji', false, 3),
    ];

    final tiles = [
      for (final (icon, label, accent, tab) in items)
        _Shortcut(
          icon: icon,
          label: label,
          background: accent
              ? colors.primaryContainer
              : colors.surfaceContainerHigh,
          foreground: accent ? colors.onPrimaryContainer : colors.onSurface,
          onTap: () => onOpenTab(tab),
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
          : Row(
              children: [
                for (var i = 0; i < tiles.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(child: tiles[i]),
                ],
              ],
            ),
    );
  }
}

class _Shortcut extends StatelessWidget {
  const _Shortcut({
    required this.icon,
    required this.label,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: background,
        borderRadius: Shape.rXl,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 22, color: foreground),
                const SizedBox(height: 12),
                Text(
                  label,
                  style: context.texts.titleSmall?.copyWith(color: foreground),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
