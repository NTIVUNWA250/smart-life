import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// OS screen-time integration boundary (FR5).
///
/// Real per-app usage comes from native code over a [MethodChannel]:
///   - **Android:** `UsageStatsManager` for per-app foreground time, plus an
///     accessibility service / device-admin policy to block apps over their limit.
///   - **iOS:** the `FamilyControls` + `ManagedSettings` (Screen Time) APIs.
///
/// Those native modules require platform permissions and are added per-platform
/// under `android/` and `ios/`. Until they are wired up, [usageFor] falls back to
/// synthesised usage **in debug builds only** so the flow is demoable; release
/// builds report nothing rather than fake data. Either way the backend
/// (`POST /screentime/usage`) owns the limit/blocking decisions, so swapping in
/// the native source later only changes this one class.
class ScreenTimeNative {
  const ScreenTimeNative();

  static const MethodChannel _channel = MethodChannel('smartlife/screentime');

  /// Returns today's used minutes per app/site id, keyed by the same ids passed in.
  Future<Map<String, int>> usageFor(List<String> appsOrSites) async {
    if (appsOrSites.isEmpty) return const {};
    try {
      final raw = await _channel.invokeMapMethod<String, dynamic>(
        'usageFor',
        {'apps': appsOrSites},
      );
      if (raw == null) return const {};
      return {
        for (final a in appsOrSites)
          if (raw[a] != null) a: (raw[a] as num).round(),
      };
    } on MissingPluginException {
      // Native module not installed on this platform/build.
      return _fallback(appsOrSites);
    } on PlatformException catch (e) {
      debugPrint('ScreenTimeNative.usageFor failed: ${e.code} ${e.message}');
      return _fallback(appsOrSites);
    }
  }

  /// Debug-only synthetic usage so the UI is demoable without native modules.
  /// Derived from the ids so values are stable within a session (no wall-clock
  /// randomness). Release builds report nothing.
  Map<String, int> _fallback(List<String> appsOrSites) {
    if (!kDebugMode) return const {};
    final rng = Random(appsOrSites.join('|').hashCode);
    return {for (final a in appsOrSites) a: rng.nextInt(120)};
  }
}
