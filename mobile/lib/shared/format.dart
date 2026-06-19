import 'package:intl/intl.dart';

/// Currency + date formatting helpers. All money in SMART LIFE is integer RWF.
class Format {
  const Format._();

  static final NumberFormat _rwf = NumberFormat.decimalPattern('en_US');
  static final DateFormat _date = DateFormat('d MMM yyyy');
  static final DateFormat _dateTime = DateFormat('d MMM yyyy, HH:mm');

  /// Formats an integer RWF amount as e.g. `RWF 12,345`.
  static String rwf(int amount) => 'RWF ${_rwf.format(amount)}';

  static String date(DateTime d) => _date.format(d.toLocal());

  static String dateTime(DateTime d) => _dateTime.format(d.toLocal());

  /// Formats a minute count as e.g. `1h 30m` or `45m`.
  static String minutes(int min) {
    if (min < 60) return '${min}m';
    final h = min ~/ 60;
    final m = min % 60;
    return m == 0 ? '${h}h' : '${h}h ${m}m';
  }
}
