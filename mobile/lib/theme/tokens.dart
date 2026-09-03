import 'package:flutter/material.dart';

/// KaryawanKu ProMax tokens, mirrored from the web app.
///
/// Source of truth: `frontend/src/app/globals.css` (which itself mirrors
/// `frontend/prototype-promax/assets/kk.css`). Every value below is the same
/// HSL triplet converted to sRGB, so the mobile app and the web app cannot
/// drift apart. When a token changes on the web, change it here — do not
/// invent mobile-only colours.
///
/// Screens never read this class. They go through `context.colors` (the M3
/// [ColorScheme]), `context.status` (the ramps M3 has no slot for),
/// `context.texts`, `Shape`, `Motion` and `Elevate`.
abstract final class Palette {
  // ── Light ────────────────────────────────────────────────────────────────
  // accent — deep teal, carried over from the production design system
  static const primary = Color(0xFF0F756D); // hsl(175 77% 26%)
  static const primaryHover = Color(0xFF0C5F58); // hsl(175 77% 21%)
  static const primaryPress = Color(0xFF094843); // hsl(175 77% 16%)
  static const onPrimary = Color(0xFFFFFFFF);
  static const primaryContainer = Color(0xFFDCF4F2); // hsl(175 52% 91%)
  static const onPrimaryContainer = Color(0xFF073C37); // hsl(175 80% 13%)

  // accent 2 — amber, reserved for "needs your decision" affordances
  static const accent = Color(0xFFC26C0A); // hsl(32 90% 40%)
  static const accentContainer = Color(0xFFFDF1D8); // hsl(40 92% 92%)
  static const onAccentContainer = Color(0xFF5E3008); // hsl(28 85% 20%)

  // surfaces — M3 tonal elevation. `surface` is the card, `surface1` the page.
  static const surface = Color(0xFFFCFDFD); // hsl(180 20% 99%)
  static const surface1 = Color(0xFFF6F9F9); // hsl(180 22% 97%)
  static const surface2 = Color(0xFFF0F5F5); // hsl(180 20% 95%)
  static const surface3 = Color(0xFFE7EEEE); // hsl(180 18% 92%)
  static const surface4 = Color(0xFFDEE7E7); // hsl(180 16% 89%)
  static const onSurface = Color(0xFF192124); // hsl(195 18% 12%)
  static const onSurfaceVariant = Color(0xFF546469); // hsl(195 11% 37%)

  static const outline = Color(0xFF7E959A); // hsl(190 12% 55%)
  static const outlineVariant = Color(0xFFD9E1E2); // hsl(190 14% 87%)

  // status
  static const success = Color(0xFF0B835B); // hsl(160 84% 28%)
  static const successContainer = Color(0xFFDFF6EE); // hsl(160 55% 92%)
  static const onSuccessContainer = Color(0xFF054834); // hsl(162 88% 15%)
  static const warning = Color(0xFFBA6A08); // hsl(33 92% 38%)
  static const warningContainer = Color(0xFFFDF1D3); // hsl(42 93% 91%)
  static const onWarningContainer = Color(0xFF552B07); // hsl(28 85% 18%)
  static const danger = Color(0xFFC71A3F); // hsl(347 77% 44%)
  static const dangerContainer = Color(0xFFFDE7EB); // hsl(350 88% 95%)
  static const onDangerContainer = Color(0xFF650B1F); // hsl(347 80% 22%)
  static const info = Color(0xFF135ED8); // hsl(217 84% 46%)
  static const infoContainer = Color(0xFFE1EEFE); // hsl(214 95% 94%)
  static const onInfoContainer = Color(0xFF0F276C); // hsl(224 76% 24%)

  static const shadow = Color(0xFF172A2E); // hsl(190 25% 12%)
  static const scrim = Color(0xFF0E171B); // hsl(195 30% 8%)

  /// Wash that lifts a nested tile out of a tonal container.
  static const containerOverlay = Color(0x99FFFFFF);

  // ── Dark ─────────────────────────────────────────────────────────────────
  static const darkPrimary = Color(0xFF66D6CB); // hsl(174 58% 62%)
  static const darkPrimaryHover = Color(0xFF86DFD6); // hsl(174 58% 70%)
  static const darkPrimaryPress = Color(0xFF9EE5DE); // hsl(174 58% 76%)
  static const darkOnPrimary = Color(0xFF053330); // hsl(176 82% 11%)
  static const darkPrimaryContainer = Color(0xFF21504D); // hsl(176 42% 22%)
  static const darkOnPrimaryContainer = Color(0xFFCAF2EE); // hsl(174 60% 87%)

  static const darkAccent = Color(0xFFF3B549); // hsl(38 88% 62%)
  static const darkAccentContainer = Color(0xFF48331E); // hsl(30 42% 20%)
  static const darkOnAccentContainer = Color(0xFFFBE6BB); // hsl(40 90% 86%)

  static const darkSurface = Color(0xFF101719); // hsl(197 24% 8%)
  static const darkSurface1 = Color(0xFF161F22); // hsl(197 21% 11%)
  static const darkSurface2 = Color(0xFF1D272A); // hsl(197 19% 14%)
  static const darkSurface3 = Color(0xFF242F33); // hsl(197 17% 17%)
  static const darkSurface4 = Color(0xFF2D393E); // hsl(197 16% 21%)
  static const darkOnSurface = Color(0xFFEEF2F2); // hsl(180 14% 94%)
  static const darkOnSurfaceVariant = Color(0xFFB3BFC2); // hsl(190 11% 73%)

  static const darkOutline = Color(0xFF718084); // hsl(192 8% 48%)
  static const darkOutlineVariant = Color(0xFF364145); // hsl(196 12% 24%)

  static const darkSuccess = Color(0xFF4ACF9E); // hsl(158 58% 55%)
  static const darkSuccessContainer = Color(0xFF1A3D31); // hsl(160 40% 17%)
  static const darkOnSuccessContainer = Color(0xFFBDEFDD); // hsl(158 62% 84%)
  static const darkWarning = Color(0xFFF3BB49); // hsl(40 88% 62%)
  static const darkWarningContainer = Color(0xFF432F19); // hsl(32 45% 18%)
  static const darkOnWarningContainer = Color(0xFFFAE5B2); // hsl(42 88% 84%)
  static const darkDanger = Color(0xFFEF6C82); // hsl(350 80% 68%)
  static const darkDangerContainer = Color(0xFF4C1F28); // hsl(348 42% 21%)
  static const darkOnDangerContainer = Color(0xFFFCCAD2); // hsl(350 88% 89%)
  static const darkInfo = Color(0xFF71AAF4); // hsl(214 86% 70%)
  static const darkInfoContainer = Color(0xFF1F3051); // hsl(220 44% 22%)
  static const darkOnInfoContainer = Color(0xFFC9E0FD); // hsl(214 92% 89%)

  static const darkShadow = Color(0xFF010508); // hsl(200 60% 2%)
  static const darkScrim = Color(0xFF020608);

  static const darkContainerOverlay = Color(0x1FFFFFFF);
}

/// Corner radii — the web's `--r-*` scale, no ad-hoc values.
abstract final class Shape {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const full = 999.0;

  static const rXs = BorderRadius.all(Radius.circular(xs));
  static const rSm = BorderRadius.all(Radius.circular(sm));
  static const rMd = BorderRadius.all(Radius.circular(md));
  static const rLg = BorderRadius.all(Radius.circular(lg));
  static const rXl = BorderRadius.all(Radius.circular(xl));
  static const pill = StadiumBorder();
}

/// One motion rhythm for the whole product — the web's `--d-*` / `--ease-*`.
abstract final class Motion {
  static const fast = Duration(milliseconds: 120);
  static const base = Duration(milliseconds: 200);
  static const slow = Duration(milliseconds: 280);

  static const standard = Cubic(.2, 0, 0, 1);
  static const emphasized = Cubic(.05, .7, .1, 1);
  static const exit = Cubic(.3, 0, .8, .15);
}

/// Layout constants.
abstract final class Insets {
  static const page = EdgeInsets.symmetric(horizontal: 16);

  /// Minimum interactive area — Material's 48 dp, which also clears Apple's
  /// 44 pt. Small controls are padded out to this rather than shrunk.
  static const minTapTarget = 48.0;

  static const appBarHeight = 60.0;
  static const bottomNavHeight = 80.0;
}

/// Status ramps, elevation and container-relative colours that Material's
/// [ColorScheme] has no slot for.
@immutable
class StatusColors extends ThemeExtension<StatusColors> {
  const StatusColors({
    required this.primaryHover,
    required this.primaryPress,
    required this.containerOverlay,
    required this.surface3,
    required this.surface4,
    required this.success,
    required this.successContainer,
    required this.onSuccessContainer,
    required this.warning,
    required this.warningContainer,
    required this.onWarningContainer,
    required this.info,
    required this.infoContainer,
    required this.onInfoContainer,
    required this.danger,
    required this.dangerContainer,
    required this.onDangerContainer,
    required this.shadow,
  });

  final Color primaryHover;
  final Color primaryPress;

  /// Supporting text inside a teal container. The web has no separate token —
  /// it leans on size and weight — but on a phone the second line needs to
  /// recede, so this is `onPrimaryContainer` held back rather than a new hue.
  Color onPrimaryContainerMuted(ColorScheme colors) => Color.alphaBlend(
    colors.onPrimaryContainer.withValues(alpha: .78),
    colors.primaryContainer,
  );

  final Color containerOverlay;
  final Color surface3;
  final Color surface4;
  final Color success;
  final Color successContainer;
  final Color onSuccessContainer;
  final Color warning;
  final Color warningContainer;
  final Color onWarningContainer;
  final Color info;
  final Color infoContainer;
  final Color onInfoContainer;
  final Color danger;
  final Color dangerContainer;
  final Color onDangerContainer;
  final Color shadow;

  static const light = StatusColors(
    primaryHover: Palette.primaryHover,
    primaryPress: Palette.primaryPress,
    containerOverlay: Palette.containerOverlay,
    surface3: Palette.surface3,
    surface4: Palette.surface4,
    success: Palette.success,
    successContainer: Palette.successContainer,
    onSuccessContainer: Palette.onSuccessContainer,
    warning: Palette.warning,
    warningContainer: Palette.warningContainer,
    onWarningContainer: Palette.onWarningContainer,
    info: Palette.info,
    infoContainer: Palette.infoContainer,
    onInfoContainer: Palette.onInfoContainer,
    danger: Palette.danger,
    dangerContainer: Palette.dangerContainer,
    onDangerContainer: Palette.onDangerContainer,
    shadow: Palette.shadow,
  );

  static const dark = StatusColors(
    primaryHover: Palette.darkPrimaryHover,
    primaryPress: Palette.darkPrimaryPress,
    containerOverlay: Palette.darkContainerOverlay,
    surface3: Palette.darkSurface3,
    surface4: Palette.darkSurface4,
    success: Palette.darkSuccess,
    successContainer: Palette.darkSuccessContainer,
    onSuccessContainer: Palette.darkOnSuccessContainer,
    warning: Palette.darkWarning,
    warningContainer: Palette.darkWarningContainer,
    onWarningContainer: Palette.darkOnWarningContainer,
    info: Palette.darkInfo,
    infoContainer: Palette.darkInfoContainer,
    onInfoContainer: Palette.darkOnInfoContainer,
    danger: Palette.darkDanger,
    dangerContainer: Palette.darkDangerContainer,
    onDangerContainer: Palette.darkOnDangerContainer,
    shadow: Palette.darkShadow,
  );

  /// The web's `--e1`..`--e4`. Cards carry e1; anything that floats over the
  /// page carries e2 or higher.
  List<BoxShadow> elevation(int level) {
    final strong = shadow.computeLuminance() < .02; // dark theme shadows
    double a(double light, double dark) => strong ? dark : light;

    return switch (level) {
      1 => [
        BoxShadow(
          color: shadow.withValues(alpha: a(.06, .50)),
          offset: const Offset(0, 1),
          blurRadius: 2,
        ),
        BoxShadow(
          color: shadow.withValues(alpha: a(.05, .35)),
          offset: const Offset(0, 1),
          blurRadius: 3,
          spreadRadius: 1,
        ),
      ],
      2 => [
        BoxShadow(
          color: shadow.withValues(alpha: a(.08, .55)),
          offset: const Offset(0, 1),
          blurRadius: 2,
        ),
        BoxShadow(
          color: shadow.withValues(alpha: a(.06, .40)),
          offset: const Offset(0, 2),
          blurRadius: 6,
          spreadRadius: 2,
        ),
      ],
      3 => [
        BoxShadow(
          color: shadow.withValues(alpha: a(.08, .45)),
          offset: const Offset(0, 4),
          blurRadius: 8,
          spreadRadius: 3,
        ),
        BoxShadow(
          color: shadow.withValues(alpha: a(.10, .55)),
          offset: const Offset(0, 1),
          blurRadius: 3,
        ),
      ],
      _ => [
        BoxShadow(
          color: shadow.withValues(alpha: a(.10, .50)),
          offset: const Offset(0, 8),
          blurRadius: 16,
          spreadRadius: 4,
        ),
        BoxShadow(
          color: shadow.withValues(alpha: a(.10, .55)),
          offset: const Offset(0, 2),
          blurRadius: 4,
        ),
      ],
    };
  }

  @override
  StatusColors copyWith({
    Color? primaryHover,
    Color? primaryPress,
    Color? containerOverlay,
    Color? surface3,
    Color? surface4,
    Color? success,
    Color? successContainer,
    Color? onSuccessContainer,
    Color? warning,
    Color? warningContainer,
    Color? onWarningContainer,
    Color? info,
    Color? infoContainer,
    Color? onInfoContainer,
    Color? danger,
    Color? dangerContainer,
    Color? onDangerContainer,
    Color? shadow,
  }) {
    return StatusColors(
      primaryHover: primaryHover ?? this.primaryHover,
      primaryPress: primaryPress ?? this.primaryPress,
      containerOverlay: containerOverlay ?? this.containerOverlay,
      surface3: surface3 ?? this.surface3,
      surface4: surface4 ?? this.surface4,
      success: success ?? this.success,
      successContainer: successContainer ?? this.successContainer,
      onSuccessContainer: onSuccessContainer ?? this.onSuccessContainer,
      warning: warning ?? this.warning,
      warningContainer: warningContainer ?? this.warningContainer,
      onWarningContainer: onWarningContainer ?? this.onWarningContainer,
      info: info ?? this.info,
      infoContainer: infoContainer ?? this.infoContainer,
      onInfoContainer: onInfoContainer ?? this.onInfoContainer,
      danger: danger ?? this.danger,
      dangerContainer: dangerContainer ?? this.dangerContainer,
      onDangerContainer: onDangerContainer ?? this.onDangerContainer,
      shadow: shadow ?? this.shadow,
    );
  }

  @override
  StatusColors lerp(StatusColors? other, double t) {
    if (other == null) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return StatusColors(
      primaryHover: mix(primaryHover, other.primaryHover),
      primaryPress: mix(primaryPress, other.primaryPress),
      containerOverlay: mix(containerOverlay, other.containerOverlay),
      surface3: mix(surface3, other.surface3),
      surface4: mix(surface4, other.surface4),
      success: mix(success, other.success),
      successContainer: mix(successContainer, other.successContainer),
      onSuccessContainer: mix(onSuccessContainer, other.onSuccessContainer),
      warning: mix(warning, other.warning),
      warningContainer: mix(warningContainer, other.warningContainer),
      onWarningContainer: mix(onWarningContainer, other.onWarningContainer),
      info: mix(info, other.info),
      infoContainer: mix(infoContainer, other.infoContainer),
      onInfoContainer: mix(onInfoContainer, other.onInfoContainer),
      danger: mix(danger, other.danger),
      dangerContainer: mix(dangerContainer, other.dangerContainer),
      onDangerContainer: mix(onDangerContainer, other.onDangerContainer),
      shadow: mix(shadow, other.shadow),
    );
  }
}

extension ThemeShortcuts on BuildContext {
  ColorScheme get colors => Theme.of(this).colorScheme;
  TextTheme get texts => Theme.of(this).textTheme;

  /// Falls back to the ramp matching the ambient brightness so a screen still
  /// renders under a theme that did not register the extension.
  StatusColors get status {
    final theme = Theme.of(this);
    return theme.extension<StatusColors>() ??
        (theme.brightness == Brightness.dark
            ? StatusColors.dark
            : StatusColors.light);
  }

  /// The web's second accent — amber, reserved for things that are waiting on
  /// a decision. Distinct from `status.warning`, which means something is
  /// wrong. Carried on the M3 secondary slot.
  Color get accent => colors.secondary;
  Color get accentContainer => colors.secondaryContainer;
  Color get onAccentContainer => colors.onSecondaryContainer;

  /// True once the user has scaled text up enough that side-by-side rows stop
  /// fitting — screens switch to a stacked layout past this point.
  bool get isLargeText => MediaQuery.textScalerOf(this).scale(16) > 21;
}
