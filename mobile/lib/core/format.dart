import 'dart:ui' show FontFeature;

import 'package:intl/intl.dart';

/// Indonesian-first formatting: Rp with dot thousands, DD/MM/YYYY dates,
/// Bahasa Indonesia day and month names.
abstract final class Fmt {
  static final _rupiah = NumberFormat.decimalPattern('id_ID');

  /// `4235000` -> `Rp 4.235.000`
  static String rupiah(int amount) => 'Rp ${_rupiah.format(amount)}';

  /// `4235000` -> `4.235.000` (no prefix, for tight columns)
  static String number(int value) => _rupiah.format(value);

  /// `DateTime(2026, 8, 31)` -> `31/08/2026`
  static String date(DateTime d) => '${_two(d.day)}/${_two(d.month)}/${d.year}';

  /// `DateTime(2026, 9, 2)` -> `Selasa, 2 September 2026`
  static String longDate(DateTime d) =>
      '${dayNames[d.weekday - 1]}, ${d.day} ${monthNames[d.month - 1]} ${d.year}';

  /// `DateTime(2026, 9, 2)` -> `Selasa, 2 September`
  static String dayAndMonth(DateTime d) =>
      '${dayNames[d.weekday - 1]}, ${d.day} ${monthNames[d.month - 1]}';

  /// `DateTime(2026, 9, 3)` -> `03` — the day number as a two-digit token.
  static String day2(DateTime d) => _two(d.day);

  /// `07:58`
  static String clock(DateTime d) => '${_two(d.hour)}:${_two(d.minute)}';

  /// `343` minutes -> `5j 43m`
  static String duration(int minutes) => '${minutes ~/ 60}j ${minutes % 60}m';

  static String _two(int n) => n.toString().padLeft(2, '0');

  static const dayNames = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu',
  ];

  /// Three-letter day labels used by the week strip and calendar.
  static const dayShort = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];

  static const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  /// Numbers must not jitter as they tick — apply to every clock, rupiah
  /// amount and date in the UI.
  static const tabular = [FontFeature.tabularFigures()];
}
