import 'package:flutter_test/flutter_test.dart';

import 'package:karyawanku_mobile/core/widget/widget_state.dart';

void main() {
  WidgetSnapshot snap({
    DateTime? inAt,
    DateTime? outAt,
    bool signedOut = false,
  }) => WidgetSnapshot(
    signedOut: signedOut,
    clockedInAt: inAt,
    clockedOutAt: outAt,
    cachedAt: DateTime.now(),
  );

  group('canClockIn / canClockOut derivation', () {
    test('no clock-in yet → can clock in, cannot clock out', () {
      final s = snap();
      expect(s.canClockIn, isTrue);
      expect(s.canClockOut, isFalse);
    });

    test('on shift → cannot clock in, can clock out', () {
      final s = snap(inAt: DateTime.utc(2026, 9, 3, 0, 58));
      expect(s.canClockIn, isFalse);
      expect(s.canClockOut, isTrue);
    });

    test('shift finished → neither action', () {
      final s = snap(
        inAt: DateTime.utc(2026, 9, 3, 0, 58),
        outAt: DateTime.utc(2026, 9, 3, 7, 0),
      );
      expect(s.canClockIn, isFalse);
      expect(s.canClockOut, isFalse);
    });

    test('signed out → never offers a clock action', () {
      final s = snap(signedOut: true);
      expect(s.canClockIn, isFalse);
      expect(s.canClockOut, isFalse);
    });
  });

  test('signedOut snapshot is signed out and offers nothing', () {
    final s = WidgetSnapshot.signedOut();
    expect(s.signedOut, isTrue);
    expect(s.businessId, isNull);
    expect(s.canClockIn, isFalse);
    expect(s.canClockOut, isFalse);
  });
}
