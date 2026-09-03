import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:karyawanku_mobile/core/widget/widget_state.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  WidgetSnapshot sample() => WidgetSnapshot(
    businessId: 'b-1',
    shiftLabel: 'Shift Pagi',
    shiftRange: '07:00 – 15:00',
    clockedInAt: DateTime.utc(2026, 9, 3, 0, 58),
    cachedAt: DateTime.now(),
  );

  test('roundtrip — save then read restores every field', () async {
    await WidgetStore.saveSnapshot(sample());

    final read = await WidgetStore.readSnapshot();
    expect(read.signedOut, isFalse);
    expect(read.businessId, 'b-1');
    expect(read.shiftLabel, 'Shift Pagi');
    expect(read.shiftRange, '07:00 – 15:00');
    expect(read.clockedInAt, DateTime.utc(2026, 9, 3, 0, 58));
    expect(read.clockedOutAt, isNull);
  });

  test('missing snapshot reads back signed out', () async {
    final read = await WidgetStore.readSnapshot();
    expect(read.signedOut, isTrue);
  });

  test('snapshot without a businessId reads back signed out', () async {
    await WidgetStore.saveSnapshot(WidgetSnapshot(cachedAt: DateTime.now()));
    expect((await WidgetStore.readSnapshot()).signedOut, isTrue);
  });

  test('stale snapshot (> 30 min) reads back signed out', () async {
    await WidgetStore.saveSnapshot(
      WidgetSnapshot(
        businessId: 'b-1',
        cachedAt: DateTime.now().subtract(const Duration(minutes: 31)),
      ),
    );
    expect((await WidgetStore.readSnapshot()).signedOut, isTrue);
  });

  test('a fresh snapshot within 30 min stays live', () async {
    await WidgetStore.saveSnapshot(
      WidgetSnapshot(
        businessId: 'b-1',
        cachedAt: DateTime.now().subtract(const Duration(minutes: 29)),
      ),
    );
    expect((await WidgetStore.readSnapshot()).signedOut, isFalse);
  });

  test('etag counter increments on every write', () async {
    expect(await WidgetStore.readEtag(), 0);
    await WidgetStore.saveSnapshot(sample());
    expect(await WidgetStore.readEtag(), 1);
    await WidgetStore.saveSnapshot(sample());
    expect(await WidgetStore.readEtag(), 2);
    await WidgetStore.markSignedOut();
    expect(await WidgetStore.readEtag(), 3);
  });

  test('markSignedOut wipes to the signed-out state', () async {
    await WidgetStore.saveSnapshot(sample());
    await WidgetStore.markSignedOut();

    final read = await WidgetStore.readSnapshot();
    expect(read.signedOut, isTrue);
    expect(read.businessId, isNull);
    expect(read.shiftLabel, isNull);
  });
}
