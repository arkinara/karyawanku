import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import 'shift_provider.dart';

/// The shift schedule: week strip for orientation, a tonal detail card for the
/// selected day, and a month grid for the wider picture. Every shift comes
/// from the employee's published roster via [shiftProvider] — the device clock
/// decides "today", never a fixture. The reminder line is a static string: the
/// BE roster has no per-shift reminder setting.
class JadwalScreen extends ConsumerStatefulWidget {
  const JadwalScreen({super.key});

  @override
  ConsumerState<JadwalScreen> createState() => _JadwalScreenState();
}

class _JadwalScreenState extends ConsumerState<JadwalScreen> {
  static const _reminderLine = 'Pengingat 30 menit sebelum shift — aktif';

  late DateTime _selected = DateTime.now();
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  bool _monthView = false;

  /// Monday-to-Sunday week containing [_selected].
  List<DateTime> get _week {
    final monday = _selected.subtract(Duration(days: _selected.weekday - 1));
    return [for (var i = 0; i < 7; i++) monday.add(Duration(days: i))];
  }

  DateTime _key(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  void initState() {
    super.initState();
    // Fetch the visible week + month and the leave blocks after first build,
    // so the widget tree exists before the notifier writes state.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final notifier = ref.read(shiftProvider.notifier);
      notifier.loadWeek(_week.first);
      notifier.loadMonth(_month);
      notifier.loadLeaveBlocks();
    });
  }

  void _reload() {
    final notifier = ref.read(shiftProvider.notifier);
    notifier.loadWeek(_week.first);
    notifier.loadMonth(_month);
  }

  void _shiftMonth(int delta) {
    setState(() => _month = DateTime(_month.year, _month.month + delta));
    ref.read(shiftProvider.notifier).loadMonth(_month);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shiftProvider);

    // A failed range fetch surfaces as a snackbar with retry; the screen keeps
    // whatever it already rendered (a stale range never blanks the calendar).
    ref.listen<ShiftState>(shiftProvider, (prev, next) {
      if (next.error != null && next.error != prev?.error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error!),
            action: SnackBarAction(label: 'Coba lagi', onPressed: _reload),
          ),
        );
      }
    });

    final selectedAssignment = state.assignmentsByDate[_key(_selected)];
    final upcoming = state.assignmentsByDate.entries
        .where((e) => e.key.isAfter(_key(_selected)))
        .toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    final upcomingAssignments = upcoming.take(4).map((e) => e.value).toList();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: const Text('Jadwal'),
        actions: [
          IconButton(
            onPressed: () => setState(() => _monthView = !_monthView),
            icon: const Icon(LucideIcons.calendar),
            tooltip: _monthView ? 'Tampilan minggu' : 'Tampilan bulan',
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          if (_monthView)
            _MonthGrid(
              month: _month,
              assignmentOn: _assignmentOn,
              leaveBlockedOn: _leaveBlockedOn,
              selected: _selected,
              onSelect: (day) => setState(() => _selected = day),
              onPrev: () => _shiftMonth(-1),
              onNext: () => _shiftMonth(1),
            )
          else
            _weekStrip(),
          if (selectedAssignment != null)
            _TodayCard(
              assignment: selectedAssignment,
              leaveBlocked: _leaveBlockedOn(_selected),
              isToday: _isToday(_selected),
            )
          else
            _RestDay(day: _selected, leaveBlocked: _leaveBlockedOn(_selected)),
          const SectionLabel('Berikutnya'),
          if (upcomingAssignments.isEmpty)
            Padding(
              padding: Insets.page,
              child: Text(
                'Belum ada jadwal berikutnya.',
                style: context.texts.bodyMedium?.copyWith(
                  color: context.colors.onSurfaceVariant,
                ),
              ),
            )
          else
            ListCard(
              children: [
                for (final assignment in upcomingAssignments)
                  _UpcomingRow(
                    assignment: assignment,
                    leaveBlocked: _leaveBlockedOn(assignment.tanggal),
                  ),
              ],
            ),
        ],
      ),
    );
  }

  ShiftAssignment? _assignmentOn(DateTime day) =>
      ref.watch(shiftProvider).assignmentsByDate[_key(day)];

  bool _leaveBlockedOn(DateTime day) =>
      ref.watch(shiftProvider).leaveBlockedDates.contains(_key(day));

  bool _isSelected(DateTime day) =>
      day.year == _selected.year &&
      day.month == _selected.month &&
      day.day == _selected.day;

  bool _isToday(DateTime day) {
    final now = DateTime.now();
    return day.year == now.year && day.month == now.month && day.day == now.day;
  }

  Widget _weekStrip() {
    return Padding(
      padding: Insets.page,
      child: Row(
        children: [
          for (final day in _week) ...[
            if (day != _week.first) const SizedBox(width: 8),
            Expanded(
              child: _DayCell(
                day: day,
                selected: _isSelected(day),
                today: _isToday(day),
                assignment: _assignmentOn(day),
                leaveBlocked: _leaveBlockedOn(day),
                onTap: () => setState(() => _selected = day),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.selected,
    required this.today,
    required this.assignment,
    required this.leaveBlocked,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final bool today;
  final ShiftAssignment? assignment;
  final bool leaveBlocked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasShift = assignment != null;

    final background = selected
        ? colors.primary
        : leaveBlocked
        ? context.accentContainer
        : hasShift
        ? colors.surfaceContainerHigh
        : Colors.transparent;
    final foreground = selected
        ? colors.onPrimary
        : hasShift
        ? colors.onSurface
        : context.colors.onSurfaceVariant;

    return Semantics(
      button: true,
      selected: selected,
      label:
          '${Fmt.dayNames[day.weekday - 1]} ${day.day}, '
          '${leaveBlocked ? 'cuti' : (assignment?.shift?.label ?? 'libur')}',
      excludeSemantics: true,
      child: Material(
        color: background,
        borderRadius: Shape.rMd,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: Insets.minTapTarget),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    Fmt.dayShort[day.weekday - 1],
                    style: context.texts.labelSmall?.copyWith(
                      color: selected
                          ? colors.onPrimary.withValues(alpha: .85)
                          : hasShift || leaveBlocked
                          ? colors.onSurfaceVariant
                          : context.colors.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    Fmt.day2(day),
                    style: context.texts.titleMedium?.copyWith(
                      fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
                      color: foreground,
                      fontFeatures: Fmt.tabular,
                    ),
                  ),
                  // Today gets a dot so the current day reads without a label.
                  if (today && !selected)
                    Container(
                      width: 4,
                      height: 4,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: hasShift || leaveBlocked
                            ? colors.primary
                            : colors.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Selected day's shift: name, times and leave status from the server (the BE
/// roster carries no role or branch, so the line stops at the schedule).
class _TodayCard extends StatelessWidget {
  const _TodayCard({
    required this.assignment,
    required this.leaveBlocked,
    required this.isToday,
  });

  final ShiftAssignment assignment;
  final bool leaveBlocked;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;
    final shift = assignment.shift;
    final date = assignment.tanggal;
    final month = Fmt.monthNames[date.month - 1].substring(0, 3);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        borderRadius: Shape.rXl,
        boxShadow: status.elevation(1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                '${isToday ? 'HARI INI' : 'JADWAL'} · '
                '${Fmt.dayShort[date.weekday - 1]} ${date.day} $month',
                style: context.texts.bodySmall?.copyWith(
                  fontWeight: FontWeight.w500,
                  letterSpacing: .4,
                  color: status.onPrimaryContainerMuted(colors),
                ),
              ),
              if (isToday)
                StatusPill(
                  label: 'Aktif',
                  background: status.successContainer,
                  foreground: status.onSuccessContainer,
                ),
              if (leaveBlocked)
                StatusPill(
                  label: 'Cuti',
                  background: context.accentContainer,
                  foreground: context.onAccentContainer,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            shift?.label ?? 'Libur',
            style: context.texts.headlineSmall?.copyWith(
              color: colors.onPrimaryContainer,
            ),
          ),
          if (shift != null) ...[
            const SizedBox(height: 4),
            Text(
              shift.range,
              style: context.texts.bodyLarge?.copyWith(
                color: status.onPrimaryContainerMuted(colors),
                fontFeatures: Fmt.tabular,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: status.containerOverlay,
              borderRadius: Shape.rMd,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  LucideIcons.bell,
                  size: 20,
                  color: colors.onPrimaryContainer,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _JadwalScreenState._reminderLine,
                    style: context.texts.bodySmall?.copyWith(
                      color: colors.onPrimaryContainer,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Empty state for a selected day with no shift (or a leave-covered day).
class _RestDay extends StatelessWidget {
  const _RestDay({required this.day, required this.leaveBlocked});

  final DateTime day;
  final bool leaveBlocked;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHigh,
        borderRadius: Shape.rXl,
      ),
      child: Row(
        children: [
          Icon(
            leaveBlocked ? LucideIcons.calendar : LucideIcons.sun,
            size: 22,
            color: leaveBlocked
                ? context.accent
                : context.colors.onSurfaceVariant,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  leaveBlocked ? 'Cuti' : 'Libur',
                  style: context.texts.titleMedium,
                ),
                Text(
                  leaveBlocked
                      ? 'Cuti pada ${Fmt.longDate(day)}'
                      : 'Tidak ada shift pada ${Fmt.longDate(day)}',
                  style: context.texts.bodyMedium?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Upcoming shift row on the schedule screen (below the detail card).
class _UpcomingRow extends StatelessWidget {
  const _UpcomingRow({required this.assignment, required this.leaveBlocked});

  final ShiftAssignment assignment;
  final bool leaveBlocked;

  @override
  Widget build(BuildContext context) {
    final date = assignment.tanggal;
    final shift = assignment.shift;

    return CardRow(
      leading: leaveBlocked
          ? RoundToken(
              icon: LucideIcons.calendar,
              background: context.accentContainer,
              foreground: context.onAccentContainer,
            )
          : RoundToken(
              label: Fmt.day2(date),
              background: shift != null &&
                      shiftKindOf(shift.namaShift) == ShiftKind.siang
                  ? context.status.infoContainer
                  : context.colors.primaryContainer,
              foreground: shift != null &&
                      shiftKindOf(shift.namaShift) == ShiftKind.siang
                  ? context.status.onInfoContainer
                  : context.colors.onPrimaryContainer,
            ),
      title: leaveBlocked ? 'Cuti' : (shift?.label ?? 'Libur'),
      subtitle: leaveBlocked
          ? '${Fmt.dayNames[date.weekday - 1]} · Cuti'
          : '${Fmt.dayNames[date.weekday - 1]} · ${shift?.range ?? ''}',
    );
  }
}

/// Month calendar with a coloured dot per shift kind and amber for leave —
/// the iOS variant of the roster, kept as an in-place toggle. Navigates any
/// month; the header always reflects the month being rendered, so paging fast
/// never leaves a stale month's grid under a new month's title.
class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.assignmentOn,
    required this.leaveBlockedOn,
    required this.selected,
    required this.onSelect,
    required this.onPrev,
    required this.onNext,
  });

  final DateTime month;
  final ShiftAssignment? Function(DateTime) assignmentOn;
  final bool Function(DateTime) leaveBlockedOn;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leadingBlanks = first.weekday - 1;
    final status = context.status;

    return Container(
      margin: Insets.page,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerLowest,
        borderRadius: Shape.rXl,
        border: Border.all(color: context.colors.outlineVariant),
        boxShadow: status.elevation(1),
      ),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: onPrev,
                tooltip: 'Bulan sebelumnya',
                icon: const Icon(LucideIcons.chevronLeft),
              ),
              Expanded(
                child: Text(
                  '${Fmt.monthNames[month.month - 1]} ${month.year}',
                  textAlign: TextAlign.center,
                  style: context.texts.titleMedium,
                ),
              ),
              IconButton(
                onPressed: onNext,
                tooltip: 'Bulan berikutnya',
                icon: const Icon(LucideIcons.chevronRight),
              ),
            ],
          ),
          Row(
            children: [
              for (final label in Fmt.dayShort)
                Expanded(
                  child: ExcludeSemantics(
                    child: Text(
                      label.substring(0, 1),
                      textAlign: TextAlign.center,
                      style: context.texts.labelSmall?.copyWith(
                        color: context.colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: leadingBlanks + daysInMonth,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              childAspectRatio: 1.15,
            ),
            itemBuilder: (context, index) {
              if (index < leadingBlanks) return const SizedBox.shrink();

              final day = DateTime(
                month.year,
                month.month,
                index - leadingBlanks + 1,
              );
              return _MonthCell(
                day: day,
                assignment: assignmentOn(day),
                leaveBlocked: leaveBlockedOn(day),
                selected: day.year == selected.year &&
                    day.month == selected.month &&
                    day.day == selected.day,
                onTap: () => onSelect(day),
              );
            },
          ),
          const SizedBox(height: 14),
          const Divider(),
          const SizedBox(height: 12),
          Wrap(
            spacing: 14,
            runSpacing: 6,
            children: [
              _Legend(color: context.colors.primary, label: 'Pagi'),
              _Legend(color: status.info, label: 'Siang'),
              _Legend(color: context.accent, label: 'Cuti'),
            ],
          ),
        ],
      ),
    );
  }
}

class _MonthCell extends StatelessWidget {
  const _MonthCell({
    required this.day,
    required this.assignment,
    required this.leaveBlocked,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final ShiftAssignment? assignment;
  final bool leaveBlocked;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;
    final now = DateTime.now();
    final isToday =
        day.year == now.year && day.month == now.month && day.day == now.day;
    final shift = assignment?.shift;
    final kind = shift == null ? ShiftKind.libur : shiftKindOf(shift.namaShift);

    final (background, dot) = switch ((assignment, leaveBlocked)) {
      (null, _) => (Colors.transparent, null),
      (final a, true) => (context.accentContainer, context.accent),
      (final a, false) when kind == ShiftKind.siang => (
        status.infoContainer,
        status.info,
      ),
      _ => (colors.primaryContainer, colors.primary),
    };

    return Semantics(
      button: true,
      selected: selected,
      label:
          '${day.day} ${Fmt.monthNames[day.month - 1]}, '
          '${leaveBlocked ? 'cuti' : (shift?.label ?? 'libur')}'
          '${isToday ? ', hari ini' : ''}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: Shape.rSm,
        child: Container(
          decoration: BoxDecoration(
            color: isToday
                ? colors.primary
                : selected
                ? colors.surfaceContainerHighest
                : background,
            borderRadius: Shape.rSm,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${day.day}',
                style: context.texts.bodyLarge?.copyWith(
                  fontSize: 15,
                  fontWeight: isToday ? FontWeight.w600 : FontWeight.w400,
                  color: isToday
                      ? colors.onPrimary
                      : assignment == null && !selected
                      ? colors.onSurfaceVariant
                      : colors.onSurface,
                  fontFeatures: Fmt.tabular,
                ),
              ),
              if (dot != null) ...[
                const SizedBox(height: 3),
                Container(
                  width: 4,
                  height: 4,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isToday ? colors.onPrimary : dot,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: context.texts.labelMedium?.copyWith(
            color: context.colors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}