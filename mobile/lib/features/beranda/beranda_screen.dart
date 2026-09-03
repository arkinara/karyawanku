import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/format.dart';
import '../../data/mock_data.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import '../absensi/attendance_provider.dart';
import '../jadwal/jadwal_screen.dart';
import '../jadwal/shift_provider.dart';
import '../shell/home_shell.dart';
import '../slip/payslip_provider.dart';
import '../slip/slip_detail_screen.dart';

/// Home. The shift hero answers "am I on the clock and for how much longer",
/// then three tonal shortcuts, then the two things staff check most often.
class BerandaScreen extends ConsumerStatefulWidget {
  const BerandaScreen({super.key, required this.onOpenTab});

  /// Switches the surrounding [HomeShell] tab — used by the shortcut row.
  final ValueChanged<int> onOpenTab;

  @override
  ConsumerState<BerandaScreen> createState() => _BerandaScreenState();
}

class _BerandaScreenState extends ConsumerState<BerandaScreen> {
  @override
  void initState() {
    super.initState();
    // The upcoming list comes from the live roster — fetch it once on mount,
    // and the "Slip gaji terakhir" row from the payslip API.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(shiftProvider.notifier).loadUpcoming(days: 3);
      ref.read(payslipProvider.notifier).loadLatest();
    });
  }

  @override
  Widget build(BuildContext context) {
    final upcoming = ref.watch(shiftProvider).upcoming;
    final latest = ref.watch(payslipProvider).latest;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            const _Header(),
            _ShiftHero(onOpenTab: widget.onOpenTab),
            const SizedBox(height: 16),
            _Shortcuts(onOpenTab: widget.onOpenTab),
            SectionLabel(
              'Jadwal 3 hari ke depan',
              action: 'Lihat semua',
              onAction: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const JadwalScreen())),
            ),
            if (upcoming.isEmpty)
              Padding(
                padding: Insets.page,
                child: Text(
                  'Belum ada jadwal 3 hari ke depan.',
                  style: context.texts.bodyMedium?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                ),
              )
            else
              ListCard(
                children: [
                  for (final assignment in upcoming)
                    _UpcomingRow(assignment: assignment),
                ],
              ),
            const SectionLabel('Slip gaji terakhir'),
            ListCard(
              children: [
                if (latest == null)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                    child: Text('Belum ada slip gaji tersedia.'),
                  )
                else
                  CardRow(
                    title: latest.periodLabel,
                    subtitle: latest.createdAt == null
                        ? null
                        : 'Digenerate ${Fmt.date(latest.createdAt!)}',
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
                        'Slip gaji terakhir ${latest.periodLabel}, '
                        '${Fmt.rupiah(latest.takeHome)}',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => SlipDetailScreen(payslip: latest),
                      ),
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

/// One upcoming roster row: shift name + time, server-side, oldest first.
class _UpcomingRow extends StatelessWidget {
  const _UpcomingRow({required this.assignment});

  final ShiftAssignment assignment;

  @override
  Widget build(BuildContext context) {
    final date = assignment.tanggal;
    final shift = assignment.shift;
    final isSiang =
        shift != null && shiftKindOf(shift.namaShift) == ShiftKind.siang;

    return CardRow(
      leading: RoundToken(
        label: Fmt.day2(date),
        background: isSiang
            ? context.status.infoContainer
            : context.colors.primaryContainer,
        foreground: isSiang
            ? context.status.onInfoContainer
            : context.colors.onPrimaryContainer,
      ),
      title: shift?.label ?? 'Libur',
      subtitle:
          '${Fmt.dayNames[date.weekday - 1]} · ${shift?.range ?? ''}',
    );
  }
}

class _Header extends ConsumerWidget {
  const _Header();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final firstName = (user?.nama.trim().split(RegExp(r'\s+')).firstOrNull) ??
        'Siti';
    final greeting =
        user == null ? Mock.greeting : 'Selamat pagi, $firstName';

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
                  Text(greeting, style: context.texts.titleMedium),
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
            const EmployeeAvatar(),
          ],
        ),
      ),
    );
  }
}

/// Teal hero card: attendance state from the server, live elapsed time, and a
/// clock-in CTA for the not-yet-clocked-in state. The clock-in time is
/// server-authoritative; only the elapsed figure derives from the device
/// clock. There is deliberately no progress bar — the schedule is a separate
/// endpoint and a zero-length shift must never render a meaningless bar.
class _ShiftHero extends ConsumerStatefulWidget {
  const _ShiftHero({required this.onOpenTab});

  final ValueChanged<int> onOpenTab;

  @override
  ConsumerState<_ShiftHero> createState() => _ShiftHeroState();
}

class _ShiftHeroState extends ConsumerState<_ShiftHero> {
  late DateTime _now = DateTime.now();
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    // Ticks so the elapsed figure stays live while on shift.
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final attendance = ref.watch(attendanceProvider);
    final colors = context.colors;
    final onHero = colors.onPrimary;
    final record = attendance.today?.record;

    final hasClockIn = record?.clockIn != null;

    String pill;
    String headline;
    String detail;
    String semantics;
    Widget? cta;

    if (!hasClockIn) {
      // No record yet (or the load has not completed) — invite the action.
      pill = 'BELUM CLOCK IN';
      headline = 'Belum Clock In';
      detail = 'Mulai shift untuk mencatat kehadiran.';
      semantics = 'Belum Clock In. Mulai shift untuk mencatat kehadiran.';
      cta = FilledButton.icon(
        onPressed: () => widget.onOpenTab(1),
        style: FilledButton.styleFrom(
          backgroundColor: onHero,
          foregroundColor: colors.primary,
          minimumSize: const Size.fromHeight(52),
        ),
        icon: const Icon(LucideIcons.clock, size: 20),
        label: const Text('Clock In'),
      );
    } else {
      final rec = record!;
      if (rec.clockOut == null) {
        final minutes = _now.difference(rec.clockIn!.toLocal()).inMinutes;
        final masuk = Fmt.clock(rec.clockIn!.toLocal());
        pill = 'SEDANG BEKERJA';
        headline = Fmt.duration(minutes);
        detail = 'Masuk $masuk · Sudah Clock In';
        semantics = 'Sudah Clock In, ${Fmt.duration(minutes)}. Masuk $masuk.';
      } else {
        final masuk = Fmt.clock(rec.clockIn!.toLocal());
        final pulang = Fmt.clock(rec.clockOut!.toLocal());
        final minutes = rec.clockOut!
            .toLocal()
            .difference(rec.clockIn!.toLocal())
            .inMinutes;
        pill = 'SELESAI';
        headline = Fmt.duration(minutes);
        detail = 'Masuk $masuk · Pulang $pulang';
        semantics =
            'Sudah Clock Out, ${Fmt.duration(minutes)}. Masuk $masuk, pulang $pulang.';
      }
    }

    return Semantics(
      label: semantics,
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
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: onHero.withValues(alpha: .18),
                borderRadius: Shape.rSm,
              ),
              child: Text(
                pill,
                overflow: TextOverflow.ellipsis,
                style: context.texts.labelMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  letterSpacing: .4,
                  color: onHero,
                ),
              ),
            ),
            const SizedBox(height: 18),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                headline,
                style: context.texts.displayMedium?.copyWith(
                  color: onHero,
                  fontFeatures: Fmt.tabular,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              detail,
              style: context.texts.bodySmall?.copyWith(
                color: onHero.withValues(alpha: .78),
                fontFeatures: Fmt.tabular,
              ),
            ),
            if (cta != null) ...[
              const SizedBox(height: 20),
              cta,
            ],
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
