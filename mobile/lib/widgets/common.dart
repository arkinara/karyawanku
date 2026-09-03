import 'package:flutter/material.dart';

import '../core/format.dart';
import '../theme/tokens.dart';

/// Section label that precedes every grouped list (`Jadwal 3 hari ke depan`,
/// `Hari ini`, `Riwayat`), optionally with a trailing text action.
class SectionLabel extends StatelessWidget {
  const SectionLabel(
    this.text, {
    super.key,
    this.top = 26,
    this.action,
    this.onAction,
  });

  final String text;
  final double top;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final label = Text(
      text,
      style: context.texts.titleSmall?.copyWith(
        color: context.colors.onSurfaceVariant,
      ),
    );

    if (action == null) {
      return Padding(
        padding: EdgeInsets.fromLTRB(16, top, 16, 10),
        child: label,
      );
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(16, top, 4, 10),
      child: Row(
        children: [
          Expanded(child: label),
          // Flexible so a scaled-up action label shrinks instead of overflowing.
          Flexible(
            child: TextButton(
              onPressed: onAction,
              child: Text(action!, overflow: TextOverflow.ellipsis),
            ),
          ),
        ],
      ),
    );
  }
}

/// Outlined surface card holding a divided list of rows — the M3 grammar used
/// for schedules, attendance timelines and payslip history.
class ListCard extends StatelessWidget {
  const ListCard({super.key, required this.children, this.margin});

  final List<Widget> children;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) rows.add(const Divider(height: 1));
      rows.add(children[i]);
    }

    return Container(
      margin: margin ?? Insets.page,
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerLowest,
        borderRadius: Shape.rXl,
        border: Border.all(color: context.colors.outlineVariant),
        // The web pairs every card with `shadow-e1`; without it the hairline
        // alone carries the boundary, which is far too weak in dark mode.
        boxShadow: context.status.elevation(1),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: rows),
    );
  }
}

/// A row inside [ListCard]: leading token, title, supporting line and an
/// optional trailing value. Past [ThemeShortcuts.isLargeText] the trailing
/// value moves under the title so nothing is clipped.
class CardRow extends StatelessWidget {
  const CardRow({
    super.key,
    this.leading,
    required this.title,
    this.subtitle,
    this.subtitleColor,
    this.trailing,
    this.trailingWidget,
    this.onTap,
    this.minHeight = 72,
    this.semanticLabel,
  });

  final Widget? leading;
  final String title;
  final String? subtitle;
  final Color? subtitleColor;
  final String? trailing;
  final Widget? trailingWidget;
  final VoidCallback? onTap;
  final double minHeight;

  /// Overrides the row's spoken label; defaults to title + subtitle + value.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final stack = context.isLargeText;

    final texts = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(title, style: context.texts.bodyLarge),
        if (subtitle != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              subtitle!,
              style: context.texts.bodyMedium?.copyWith(
                color: subtitleColor ?? context.colors.onSurfaceVariant,
                fontFeatures: Fmt.tabular,
              ),
            ),
          ),
      ],
    );

    final value =
        trailingWidget ??
        (trailing == null
            ? null
            : Text(
                trailing!,
                textAlign: stack ? TextAlign.start : TextAlign.end,
                style: context.texts.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w500,
                  fontFeatures: Fmt.tabular,
                ),
              ));

    final body = stack
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              texts,
              if (value != null)
                Padding(padding: const EdgeInsets.only(top: 6), child: value),
            ],
          )
        : Row(
            children: [
              Expanded(child: texts),
              // Flexible, not a bare child: long rupiah values at a large text
              // scale would otherwise push the row past the card.
              if (value != null)
                Flexible(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 12),
                    child: value,
                  ),
                ),
            ],
          );

    return Semantics(
      button: onTap != null,
      label:
          semanticLabel ??
          [title, subtitle, trailing].whereType<String>().join(', '),
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: minHeight),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 16)],
              Expanded(child: body),
            ],
          ),
        ),
      ),
    );
  }
}

/// Circular avatar-style leading token: a day number or an icon. Decorative —
/// the surrounding [CardRow] carries the spoken label.
class RoundToken extends StatelessWidget {
  const RoundToken({
    super.key,
    this.label,
    this.icon,
    required this.background,
    required this.foreground,
    this.size = 44,
  });

  final String? label;
  final IconData? icon;
  final Color background;
  final Color foreground;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: background, shape: BoxShape.circle),
        child: icon != null
            ? Icon(icon, size: size * .45, color: foreground)
            : Text(
                label ?? '',
                style: context.texts.labelLarge?.copyWith(
                  color: foreground,
                  fontFeatures: Fmt.tabular,
                ),
              ),
      ),
    );
  }
}

/// Tonal banner used for the offline warning, the leave-conflict hint and the
/// sign-in reassurance note.
class ToneBanner extends StatelessWidget {
  const ToneBanner({
    super.key,
    required this.icon,
    required this.background,
    required this.foreground,
    required this.child,
    this.action,
    this.onAction,
    this.margin = Insets.page,
    this.live = false,
  });

  final IconData icon;
  final Color background;
  final Color foreground;
  final Widget child;
  final String? action;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry margin;

  /// Announce the banner to screen readers when it appears — used for the
  /// offline / queued-entry notice.
  final bool live;

  @override
  Widget build(BuildContext context) {
    final banner = Container(
      margin: margin,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: background, borderRadius: Shape.rMd),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(child: Icon(icon, size: 20, color: foreground)),
          const SizedBox(width: 12),
          Expanded(
            child: DefaultTextStyle.merge(
              style: context.texts.bodyMedium!.copyWith(color: foreground),
              child: child,
            ),
          ),
          if (action != null)
            // A real TextButton rather than a tappable Text: the 48 dp
            // minimum tap target comes from the theme.
            TextButton(onPressed: onAction, child: Text(action!)),
        ],
      ),
    );

    return live ? Semantics(liveRegion: true, child: banner) : banner;
  }
}

/// M3 filter-chip look used for leave types, status filters and payslip years.
/// The visual pill stays 32 dp; the tap area is padded out to 48 dp.
class ToneChip extends StatelessWidget {
  const ToneChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: Shape.rSm,
        child: Padding(
          // Vertical padding lifts the 32 dp pill to a 48 dp touch target
          // without changing how it looks.
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Container(
            constraints: const BoxConstraints(minHeight: 32),
            padding: EdgeInsets.only(left: selected ? 10 : 14, right: 14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? colors.primary : Colors.transparent,
              borderRadius: Shape.rSm,
              border: selected ? null : Border.all(color: colors.outline),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (selected) ...[
                  Icon(Icons.check, size: 16, color: colors.onPrimary),
                  const SizedBox(width: 6),
                ],
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: context.texts.labelLarge?.copyWith(
                      fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
                      color: selected ? colors.onPrimary : colors.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Row of [ToneChip]s that wraps instead of clipping — chip labels grow with
/// the system text size and three of them no longer fit on one line.
class ChipRow extends StatelessWidget {
  const ChipRow({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Insets.page,
      child: Wrap(
        spacing: 8,
        children: [
          for (var i = 0; i < labels.length; i++)
            ToneChip(
              label: labels[i],
              selected: selectedIndex == i,
              onTap: () => onSelected(i),
            ),
        ],
      ),
    );
  }
}

/// Small pill carrying a status word (`Aktif`, `Menunggu`, `Disetujui`).
class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: background, borderRadius: Shape.rSm),
      child: Text(
        label,
        style: context.texts.labelMedium?.copyWith(
          fontWeight: FontWeight.w500,
          color: foreground,
        ),
      ),
    );
  }
}

/// Tonal stat tile — three across for the monthly attendance summary.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.value,
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String value;
  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$value $label',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: background, borderRadius: Shape.rLg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: context.texts.headlineMedium?.copyWith(
                height: 1,
                color: foreground,
                fontFeatures: Fmt.tabular,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: context.texts.bodySmall?.copyWith(color: foreground),
            ),
          ],
        ),
      ),
    );
  }
}

/// M3 outlined text field rendered read-only — the prototype shows values, not
/// live input, so taps open a picker instead of a keyboard.
class DisplayField extends StatelessWidget {
  const DisplayField({
    super.key,
    required this.label,
    required this.value,
    this.trailing,
    this.minHeight = 56,
    this.onTap,
  });

  final String label;
  final String value;
  final Widget? trailing;
  final double minHeight;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      label: '$label: $value',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            suffixIcon: trailing,
            constraints: BoxConstraints(minHeight: minHeight),
          ),
          child: Text(
            value,
            style: context.texts.bodyLarge?.copyWith(fontFeatures: Fmt.tabular),
          ),
        ),
      ),
    );
  }
}

/// Flutter has no dashed-border primitive; the design uses one on the empty
/// selfie slot and the leave-attachment drop zone.
class DashedBorder extends StatelessWidget {
  const DashedBorder({
    super.key,
    required this.child,
    this.radius = 12,
    this.color,
  });

  final Widget child;
  final double radius;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedBorderPainter(
        radius: radius,
        color: color ?? context.colors.outline,
      ),
      child: child,
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.radius, required this.color});

  final double radius;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)),
      );

    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 4), paint);
        distance += 8;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter oldDelegate) =>
      oldDelegate.radius != radius || oldDelegate.color != color;
}
