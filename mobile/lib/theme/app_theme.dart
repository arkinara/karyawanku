import 'package:flutter/material.dart';

import 'tokens.dart';

/// Material 3 theme built on the web app's ProMax tokens, so the mobile app
/// reads as the same product: same teal, same amber "needs your decision"
/// accent, same surface ramp, same radii, same 120/200/280 ms motion rhythm.
///
/// Both brightnesses come from the web's own light and dark token sets — the
/// dark values are designed, not derived.
ThemeData buildAppTheme({Brightness brightness = Brightness.light}) {
  final dark = brightness == Brightness.dark;
  final scheme = dark ? _darkScheme : _lightScheme;
  final status = dark ? StatusColors.dark : StatusColors.light;
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);

  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    splashFactory: InkSparkle.splashFactory,
    extensions: [status],
    textTheme: _textTheme(base.textTheme, scheme),
    pageTransitionsTheme: const PageTransitionsTheme(
      // Forward navigation slides and fades in one direction, back reverses
      // it — the spatial continuity the web gets from `--ease-emphasized`.
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
      },
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      toolbarHeight: 64,
      titleTextStyle: TextStyle(
        fontFamily: _fontFamily,
        fontSize: 22,
        fontWeight: FontWeight.w500,
        letterSpacing: -.22,
        color: scheme.onSurface,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: Insets.bottomNavHeight,
      backgroundColor: dark ? status.surface3 : scheme.surfaceContainerHigh,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      indicatorColor: scheme.primaryContainer,
      indicatorShape: const StadiumBorder(),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color: states.contains(WidgetState.selected)
              ? scheme.onPrimaryContainer
              : scheme.onSurfaceVariant,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontFamily: _fontFamily,
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w400,
          color: states.contains(WidgetState.selected)
              ? scheme.onSurface
              : scheme.onSurfaceVariant,
        ),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style:
          FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(56),
            shape: Shape.pill,
            animationDuration: Motion.fast,
            textStyle: const TextStyle(
              fontFamily: _fontFamily,
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: .1,
            ),
          ).copyWith(
            // The web's `--primary-hover` / `--primary-press` as M3 state layers.
            backgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.disabled)) {
                return scheme.onSurface.withValues(alpha: .12);
              }
              if (states.contains(WidgetState.pressed)) {
                return status.primaryPress;
              }
              if (states.contains(WidgetState.hovered)) {
                return status.primaryHover;
              }
              return scheme.primary;
            }),
          ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: Shape.pill,
        foregroundColor: scheme.primary,
        side: BorderSide(color: scheme.outline),
        animationDuration: Motion.fast,
        textStyle: const TextStyle(
          fontFamily: _fontFamily,
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: scheme.primary,
        // Keeps the label's tap area at the 48 dp minimum without visually
        // inflating the control.
        minimumSize: const Size(Insets.minTapTarget, Insets.minTapTarget),
        tapTargetSize: MaterialTapTargetSize.padded,
        animationDuration: Motion.fast,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(Insets.minTapTarget, Insets.minTapTarget),
        foregroundColor: scheme.onSurface,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: _fieldBorder(scheme.outline),
      enabledBorder: _fieldBorder(scheme.outline),
      focusedBorder: _fieldBorder(scheme.primary, width: 2),
      errorBorder: _fieldBorder(scheme.error),
      focusedErrorBorder: _fieldBorder(scheme.error, width: 2),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: TextStyle(fontSize: 14, color: scheme.onSurfaceVariant),
      floatingLabelStyle: TextStyle(fontSize: 12, color: scheme.primary),
      helperStyle: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: scheme.primaryContainer,
      foregroundColor: scheme.onPrimaryContainer,
      elevation: 3,
      shape: const RoundedRectangleBorder(borderRadius: Shape.rLg),
      extendedTextStyle: const TextStyle(
        fontFamily: _fontFamily,
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant,
      thickness: 1,
      space: 1,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: scheme.inverseSurface,
      contentTextStyle: TextStyle(
        fontFamily: _fontFamily,
        color: scheme.onInverseSurface,
      ),
      shape: const RoundedRectangleBorder(borderRadius: Shape.rMd),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Shape.xl)),
      ),
      // The web's scrim at 55% — strong enough to isolate the sheet in both
      // themes without blacking the page out.
      modalBarrierColor: (dark ? Palette.darkScrim : Palette.scrim).withValues(
        alpha: .55,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(borderRadius: Shape.rXl),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: scheme.primary,
      linearTrackColor: scheme.outlineVariant,
    ),
    tooltipTheme: TooltipThemeData(
      waitDuration: Motion.slow,
      decoration: BoxDecoration(
        color: scheme.inverseSurface,
        borderRadius: Shape.rXs,
      ),
      textStyle: TextStyle(
        fontFamily: _fontFamily,
        fontSize: 12,
        color: scheme.onInverseSurface,
      ),
    ),
  );
}

/// Inter, bundled as a variable font — the same typeface the web app loads.
const _fontFamily = 'Inter';

OutlineInputBorder _fieldBorder(Color color, {double width = 1}) {
  return OutlineInputBorder(
    borderRadius: Shape.rXs,
    borderSide: BorderSide(color: color, width: width),
  );
}

/// The web's typography roles (`.t-display` … `.t-over`) expressed as M3 roles.
///
/// Sizes are the mobile ramp, not the web's: 15 px body is right for a
/// 1440 px desktop column and wrong for a phone, where 16 px is the floor that
/// keeps iOS from auto-zooming. Weights, tracking and the tabular-figure rule
/// come straight from the web.
TextTheme _textTheme(TextTheme base, ColorScheme scheme) {
  TextStyle role(
    double size, {
    double weight = 400,
    double? height,
    double tracking = 0,
  }) {
    return TextStyle(
      fontFamily: _fontFamily,
      fontSize: size,
      height: height,
      letterSpacing: tracking,
      fontWeight: _nearestWeight(weight),
      // Inter is variable, so the web's in-between weights (550/620/650)
      // survive the port instead of snapping to 500 or 700.
      fontVariations: [FontVariation('wght', weight)],
    );
  }

  return base
      .copyWith(
        // Display — the wall clock and the on-shift timer.
        displayLarge: role(57, weight: 640, height: 1, tracking: -2),
        displayMedium: role(45, weight: 640, height: 1, tracking: -1),
        displaySmall: role(36, weight: 700, height: 1, tracking: -.72),
        // Headline — page titles and hero amounts.
        headlineLarge: role(32, weight: 650, height: 1.2, tracking: -.48),
        headlineMedium: role(28, weight: 650, height: 1.2, tracking: -.42),
        headlineSmall: role(24, weight: 620, height: 1.25, tracking: -.24),
        // Title — app bars, card headings, list titles.
        titleLarge: role(22, weight: 500, height: 1.25, tracking: -.22),
        titleMedium: role(16, weight: 620, height: 1.3),
        titleSmall: role(14, weight: 620, height: 1.3),
        // Body — the web's 1.55 line-height, which is what makes its long
        // Bahasa Indonesia strings readable.
        bodyLarge: role(16, height: 1.5),
        bodyMedium: role(14, height: 1.55),
        bodySmall: role(13, height: 1.5),
        // Label — buttons, chips, nav, and the `.t-over` overline.
        labelLarge: role(14, weight: 550),
        labelMedium: role(12, weight: 500),
        labelSmall: role(11, weight: 650, tracking: .77),
      )
      .apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
}

/// Closest standard weight, so platforms without variable-axis support still
/// render a sensible approximation of the requested weight.
FontWeight _nearestWeight(double w) {
  const steps = FontWeight.values;
  return steps[((w / 100).round() - 1).clamp(0, steps.length - 1)];
}

const _lightScheme = ColorScheme(
  brightness: Brightness.light,
  primary: Palette.primary,
  onPrimary: Palette.onPrimary,
  primaryContainer: Palette.primaryContainer,
  onPrimaryContainer: Palette.onPrimaryContainer,
  // The web's second accent — amber, for "needs your decision".
  secondary: Palette.accent,
  onSecondary: Palette.onPrimary,
  secondaryContainer: Palette.accentContainer,
  onSecondaryContainer: Palette.onAccentContainer,
  tertiary: Palette.info,
  onTertiary: Palette.onPrimary,
  tertiaryContainer: Palette.infoContainer,
  onTertiaryContainer: Palette.onInfoContainer,
  error: Palette.danger,
  onError: Palette.onPrimary,
  errorContainer: Palette.dangerContainer,
  onErrorContainer: Palette.onDangerContainer,
  // `surface1` is the page; `surface` is the card that sits on it.
  surface: Palette.surface1,
  onSurface: Palette.onSurface,
  onSurfaceVariant: Palette.onSurfaceVariant,
  surfaceContainerLowest: Palette.surface,
  surfaceContainerLow: Palette.surface1,
  surfaceContainer: Palette.surface2,
  surfaceContainerHigh: Palette.surface2,
  surfaceContainerHighest: Palette.surface3,
  inverseSurface: Palette.onSurface,
  onInverseSurface: Palette.surface,
  outline: Palette.outline,
  outlineVariant: Palette.outlineVariant,
  shadow: Palette.shadow,
  scrim: Palette.scrim,
);

const _darkScheme = ColorScheme(
  brightness: Brightness.dark,
  primary: Palette.darkPrimary,
  onPrimary: Palette.darkOnPrimary,
  primaryContainer: Palette.darkPrimaryContainer,
  onPrimaryContainer: Palette.darkOnPrimaryContainer,
  secondary: Palette.darkAccent,
  onSecondary: Palette.darkAccentContainer,
  secondaryContainer: Palette.darkAccentContainer,
  onSecondaryContainer: Palette.darkOnAccentContainer,
  tertiary: Palette.darkInfo,
  onTertiary: Palette.darkInfoContainer,
  tertiaryContainer: Palette.darkInfoContainer,
  onTertiaryContainer: Palette.darkOnInfoContainer,
  error: Palette.darkDanger,
  onError: Palette.darkDangerContainer,
  errorContainer: Palette.darkDangerContainer,
  onErrorContainer: Palette.darkOnDangerContainer,
  surface: Palette.darkSurface1,
  onSurface: Palette.darkOnSurface,
  onSurfaceVariant: Palette.darkOnSurfaceVariant,
  surfaceContainerLowest: Palette.darkSurface2,
  surfaceContainerLow: Palette.darkSurface1,
  surfaceContainer: Palette.darkSurface2,
  surfaceContainerHigh: Palette.darkSurface3,
  surfaceContainerHighest: Palette.darkSurface4,
  inverseSurface: Palette.darkOnSurface,
  onInverseSurface: Palette.darkSurface,
  outline: Palette.darkOutline,
  outlineVariant: Palette.darkOutlineVariant,
  shadow: Palette.darkShadow,
  scrim: Palette.darkScrim,
);
