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
/// A blockable app chosen by the user: an opaque platform [id] (Android package
/// name, or an iOS Screen-Time token) and a human-friendly [label].
typedef AppChoice = ({String id, String label});

/// Raised when usage can be measured on this device but the user has not granted
/// the OS-level access yet.
class ScreenTimePermissionException implements Exception {
  const ScreenTimePermissionException();

  @override
  String toString() => 'Usage access has not been granted.';
}

class ScreenTimeNative {
  const ScreenTimeNative();

  static const MethodChannel _channel = MethodChannel('smartlife/screentime');

  /// Common apps offered as a fallback picker when the native module is not
  /// wired up (so the flow stays demoable). Ids are real Android package names.
  static const List<AppChoice> commonApps = [
    (id: 'com.instagram.android', label: 'Instagram'),
    (id: 'com.zhiliaoapp.musically', label: 'TikTok'),
    (id: 'com.google.android.youtube', label: 'YouTube'),
    (id: 'com.whatsapp', label: 'WhatsApp'),
    (id: 'com.twitter.android', label: 'X (Twitter)'),
    (id: 'com.facebook.katana', label: 'Facebook'),
    (id: 'com.snapchat.android', label: 'Snapchat'),
  ];

  /// Opens the native app picker and returns the chosen app, or null if the user
  /// cancels OR the native module is not available on this platform/build.
  ///
  ///   - **Android:** an installed-apps picker (needs `QUERY_ALL_PACKAGES`).
  ///   - **iOS:** the system `FamilyActivityPicker` (Screen Time API), which
  ///     returns an opaque token and needs the Family Controls entitlement.
  ///
  /// When null is returned, the UI falls back to [commonApps].
  Future<AppChoice?> pickApp() async {
    try {
      final raw = await _channel.invokeMapMethod<String, dynamic>('pickApp');
      final id = raw?['id'] as String?;
      if (id == null || id.isEmpty) return null;
      return (id: id, label: (raw?['label'] as String?) ?? id);
    } on MissingPluginException {
      return null; // native picker not wired on this build/platform
    } on PlatformException catch (e) {
      debugPrint('ScreenTimeNative.pickApp failed: ${e.code} ${e.message}');
      return null;
    }
  }

  /// Whether the OS has granted the access needed to measure usage.
  ///
  /// On Android this is the PACKAGE_USAGE_STATS app-op, which the user must
  /// toggle in Settings — see [openUsageAccessSettings]. Platforms with no native
  /// module report false.
  Future<bool> hasUsageAccess() async {
    try {
      return await _channel.invokeMethod<bool>('hasUsageAccess') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException catch (e) {
      debugPrint('ScreenTimeNative.hasUsageAccess failed: ${e.code} ${e.message}');
      return false;
    }
  }

  /// Opens the OS screen where usage access is granted. Returns false when the
  /// platform cannot show it, so the caller can explain instead of failing silently.
  Future<bool> openUsageAccessSettings() async {
    try {
      return await _channel.invokeMethod<bool>('openUsageAccessSettings') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException catch (e) {
      debugPrint('ScreenTimeNative.openUsageAccess failed: ${e.code} ${e.message}');
      return false;
    }
  }

  /// Returns today's used minutes per app/site id, keyed by the same ids passed in.
  ///
  /// Throws [ScreenTimePermissionException] when the OS can measure usage but the
  /// user has not granted access — that is a fixable state the UI should surface,
  /// not a reason to fall back to fake data.
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
      if (e.code == 'PERMISSION_DENIED') throw const ScreenTimePermissionException();
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
