import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/mock_data.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';

/// Shift roster. Week strip for orientation, today's shift as a tonal hero,
/// then what comes next — including a pending leave block.
class JadwalScreen extends StatefulWidget {
  const JadwalScreen({super.key});

  @override
  State<JadwalScreen> createState() => _JadwalScreenState();
}

class _JadwalScreenState extends State<JadwalScreen> {
  DateTime _selected = Mock.today;
  bool _monthView = false;

  /// Monday-to-Sunday week containing [_selected].
  List<DateTime> get _week {
    final monday = _selected.subtract(Duration(days: _selected.weekday - 1));
    return [for (var i = 0; i < 7; i++) monday.add(Duration(days: i))];
  }

  Shift? _shiftOn(DateTime day) {
    for (final shift in Mock.shifts) {
      if (shift.date.year == day.year &&
          shift.date.month == day.month &&
          shift.date.day == day.day) {
        return shift;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final selectedShift = _shiftOn(_selected);
    final upcoming = Mock.shifts
        .where((s) => s.date.isAfter(_selected))
        .take(4)
        .toList();

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
          if (_monthView) _MonthGrid(shiftOn: _shiftOn) else _weekStrip(),
          if (selectedShift != null)
            _TodayCard(shift: selectedShift)
          else
            _RestDay(day: _selected),
          const SectionLabel('Berikutnya'),
          ListCard(
            children: [
              for (final shift in upcoming)
                CardRow(
                  leading: shift.leaveRequested
                      ? RoundToken(
                          icon: LucideIcons.calendar,
                          background: context.accentContainer,
                          foreground: context.onAccentContainer,
                        )
                      : RoundToken(
                          label: Fmt.day2(shift.date),
                          background: shift.kind == ShiftKind.siang
                              ? context.status.infoContainer
                              : context.colors.primaryContainer,
                          foreground: shift.kind == ShiftKind.siang
                              ? context.status.onInfoContainer
                              : context.colors.onPrimaryContainer,
                        ),
                  title: shift.leaveRequested ? 'Cuti diajukan' : shift.label,
                  subtitle: shift.leaveRequested
                      ? '${shift.date.day} Sep · menunggu persetujuan'
                      : '${Fmt.dayNames[shift.date.weekday - 1]} · ${shift.range}',
                  subtitleColor: shift.leaveRequested
                      ? context.onAccentContainer
                      : null,
                ),
            ],
          ),
        ],
      ),
    );
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
                shift: _shiftOn(day),
                onTap: () => setState(() => _selected = day),
              ),
            ),
          ],
        ],
      ),
    );
  }

  bool _isSelected(DateTime day) =>
      day.year == _selected.year &&
      day.month == _selected.month &&
      day.day == _selected.day;
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.selected,
    required this.shift,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final Shift? shift;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasShift = shift != null;

    final background = selected
        ? colors.primary
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
          '${shift?.label ?? 'libur'}',
      excludeSemantics: true,
      child: Material(
        color: background,
        borderRadius: Shape.rMd,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          // 48 dp minimum even though the pill itself is shorter.
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
                          : hasShift
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
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Selected day: role, branch, hours, and whether the pre-shift reminder is
/// armed — the detail staff actually forget.
class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.shift});

  final Shift shift;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;
    final month = Fmt.monthNames[shift.date.month - 1].substring(0, 3);

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
                '${shift.isToday ? 'HARI INI' : 'JADWAL'} · '
                '${Fmt.dayShort[shift.date.weekday - 1]} ${shift.date.day} '
                '$month',
                style: context.texts.bodySmall?.copyWith(
                  fontWeight: FontWeight.w500,
                  letterSpacing: .4,
                  color: status.onPrimaryContainerMuted(colors),
                ),
              ),
              if (shift.isToday)
                StatusPill(
                  label: 'Aktif',
                  background: status.successContainer,
                  foreground: status.onSuccessContainer,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            shift.label,
            style: context.texts.headlineSmall?.copyWith(
              color: colors.onPrimaryContainer,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${shift.range} · ${shift.role} · ${Mock.employee.branch}',
            style: context.texts.bodyLarge?.copyWith(
              color: status.onPrimaryContainerMuted(colors),
              fontFeatures: Fmt.tabular,
            ),
          ),
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
                    Mock.shiftReminder,
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

/// Empty state for a selected day with no shift.
class _RestDay extends StatelessWidget {
  const _RestDay({required this.day});

  final DateTime day;

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
            LucideIcons.sun,
            size: 22,
            color: context.colors.onSurfaceVariant,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Libur', style: context.texts.titleMedium),
                Text(
                  'Tidak ada shift pada ${Fmt.longDate(day)}',
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

/// Month calendar with a coloured dot per shift kind — the iOS variant of the
/// roster, kept as an in-place toggle rather than a second screen.
class _MonthGrid extends StatelessWidget {
  const _MonthGrid({required this.shiftOn});

  final Shift? Function(DateTime) shiftOn;

  @override
  Widget build(BuildContext context) {
    final month = Mock.today;
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
        boxShadow: context.status.elevation(1),
      ),
      child: Column(
        children: [
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
              return _MonthCell(day: day, shift: shiftOn(day));
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
              _Legend(color: context.accent, label: 'Cuti diajukan'),
            ],
          ),
        ],
      ),
    );
  }
}

class _MonthCell extends StatelessWidget {
  const _MonthCell({required this.day, required this.shift});

  final DateTime day;
  final Shift? shift;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;
    final isToday = day.month == Mock.today.month && day.day == Mock.today.day;

    final (background, dot) = switch (shift) {
      null => (Colors.transparent, null),
      final s when s.leaveRequested => (
        context.accentContainer,
        context.accent,
      ),
      final s when s.kind == ShiftKind.siang => (
        status.infoContainer,
        status.info,
      ),
      _ => (colors.primaryContainer, colors.primary),
    };

    return Semantics(
      label:
          '${day.day} ${Fmt.monthNames[day.month - 1]}, '
          '${shift?.label ?? 'libur'}${isToday ? ', hari ini' : ''}',
      excludeSemantics: true,
      child: Container(
        decoration: BoxDecoration(
          color: isToday ? colors.primary : background,
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
                    : shift == null
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
