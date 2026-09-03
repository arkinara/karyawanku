import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/theme/tokens.dart';

/// The mobile palette is a mirror of the web app's ProMax tokens. If someone
/// changes a colour on either side without changing the other, the two apps
/// start drifting apart — this test is what stops that happening quietly.
///
/// Reads `frontend/src/app/globals.css`, converts each `--token: H S% L%`
/// triplet to sRGB, and compares it to [Palette].
void main() {
  final css = File('../frontend/src/app/globals.css');

  // Web token name -> the Palette constants that must match it.
  const lightMap = <String, Color>{
    'primary': Palette.primary,
    'primary-hover': Palette.primaryHover,
    'primary-press': Palette.primaryPress,
    'on-primary': Palette.onPrimary,
    'primary-container': Palette.primaryContainer,
    'on-primary-container': Palette.onPrimaryContainer,
    'accent': Palette.accent,
    'accent-container': Palette.accentContainer,
    'on-accent-container': Palette.onAccentContainer,
    'surface': Palette.surface,
    'surface-1': Palette.surface1,
    'surface-2': Palette.surface2,
    'surface-3': Palette.surface3,
    'surface-4': Palette.surface4,
    'on-surface': Palette.onSurface,
    'on-surface-variant': Palette.onSurfaceVariant,
    'outline': Palette.outline,
    'outline-variant': Palette.outlineVariant,
    'success': Palette.success,
    'success-container': Palette.successContainer,
    'on-success-container': Palette.onSuccessContainer,
    'warning': Palette.warning,
    'warning-container': Palette.warningContainer,
    'on-warning-container': Palette.onWarningContainer,
    'danger': Palette.danger,
    'danger-container': Palette.dangerContainer,
    'on-danger-container': Palette.onDangerContainer,
    'info': Palette.info,
    'info-container': Palette.infoContainer,
    'on-info-container': Palette.onInfoContainer,
    'scrim': Palette.scrim,
  };

  const darkMap = <String, Color>{
    'primary': Palette.darkPrimary,
    'primary-hover': Palette.darkPrimaryHover,
    'primary-press': Palette.darkPrimaryPress,
    'on-primary': Palette.darkOnPrimary,
    'primary-container': Palette.darkPrimaryContainer,
    'on-primary-container': Palette.darkOnPrimaryContainer,
    'accent': Palette.darkAccent,
    'accent-container': Palette.darkAccentContainer,
    'on-accent-container': Palette.darkOnAccentContainer,
    'surface': Palette.darkSurface,
    'surface-1': Palette.darkSurface1,
    'surface-2': Palette.darkSurface2,
    'surface-3': Palette.darkSurface3,
    'surface-4': Palette.darkSurface4,
    'on-surface': Palette.darkOnSurface,
    'on-surface-variant': Palette.darkOnSurfaceVariant,
    'outline': Palette.darkOutline,
    'outline-variant': Palette.darkOutlineVariant,
    'success': Palette.darkSuccess,
    'success-container': Palette.darkSuccessContainer,
    'on-success-container': Palette.darkOnSuccessContainer,
    'warning': Palette.darkWarning,
    'warning-container': Palette.darkWarningContainer,
    'on-warning-container': Palette.darkOnWarningContainer,
    'danger': Palette.darkDanger,
    'danger-container': Palette.darkDangerContainer,
    'on-danger-container': Palette.darkOnDangerContainer,
    'info': Palette.darkInfo,
    'info-container': Palette.darkInfoContainer,
    'on-info-container': Palette.darkOnInfoContainer,
  };

  group('mobile tokens mirror the web app', () {
    late Map<String, Color> webLight;
    late Map<String, Color> webDark;

    setUpAll(() {
      if (!css.existsSync()) return;
      final source = css.readAsStringSync();
      webLight = _parseBlock(source, ':root');
      webDark = _parseBlock(source, '.dark');
    });

    test('globals.css is where this test expects it', () {
      expect(
        css.existsSync(),
        isTrue,
        reason: 'Expected the web tokens at ${css.path}',
      );
    });

    for (final (label, expected, isDark) in [
      ('light', lightMap, false),
      ('dark', darkMap, true),
    ]) {
      test('$label palette matches globals.css', () {
        if (!css.existsSync()) return;
        final web = isDark ? webDark : webLight;
        final drifted = <String>[];

        expected.forEach((token, mobile) {
          final fromWeb = web[token];
          if (fromWeb == null) {
            drifted.add('$token: missing from the web $label block');
          } else if (fromWeb.toARGB32() != mobile.toARGB32()) {
            drifted.add(
              '$token: web ${_hex(fromWeb)} vs mobile ${_hex(mobile)}',
            );
          }
        });

        expect(
          drifted,
          isEmpty,
          reason:
              'Mobile and web tokens have drifted apart. Re-sync '
              'lib/theme/tokens.dart with frontend/src/app/globals.css:\n'
              '${drifted.join('\n')}',
        );
      });
    }
  });
}

/// Pulls `--name: H S% L%` declarations out of one CSS block.
Map<String, Color> _parseBlock(String source, String selector) {
  final start = source.indexOf('$selector {');
  if (start < 0) return {};
  final end = source.indexOf('\n}', start);
  final block = source.substring(start, end < 0 ? source.length : end);

  final pattern = RegExp(
    r'--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;',
  );

  return {
    for (final m in pattern.allMatches(block))
      m.group(1)!: _fromHsl(
        double.parse(m.group(2)!),
        double.parse(m.group(3)!),
        double.parse(m.group(4)!),
      ),
  };
}

/// CSS `hsl()` to sRGB, rounded the same way the tokens were generated.
Color _fromHsl(double h, double s, double l) {
  s /= 100;
  l /= 100;
  final a = s * math.min(l, 1 - l);

  int channel(int n) {
    final k = (n + h / 30) % 12;
    final v = l - a * math.max(-1, math.min(k - 3, math.min(9 - k, 1)));
    return (v * 255).round();
  }

  return Color.fromARGB(255, channel(0), channel(8), channel(4));
}

String _hex(Color c) =>
    '#${c.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}';
