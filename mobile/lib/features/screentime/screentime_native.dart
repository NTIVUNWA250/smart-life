import 'dart:math';

/// OS screen-time integration boundary.
///
/// In production this is backed by platform channels into native code:
///   - **Android:** `UsageStatsManager` for per-app usage, plus an accessibility
///     service / device-admin policy to block apps over their limit.
///   - **iOS:** the `FamilyControls` + `ManagedSettings` (Screen Time) APIs.
///
/// Those require native modules and platform permissions, so for this build the
/// implementation is a documented stub that synthesises plausible usage. The app
/// reports whatever this returns to the backend (`POST /screentime/usage`), which
/// owns the limit/blocking decisions — so wiring in the real native source later
/// only changes this one class.
class ScreenTimeNative {
  const ScreenTimeNative();

  /// Returns today's used minutes per app/site id. Stub: derived from the id so
  /// the value is stable within a session without using wall-clock randomness.
  Future<Map<String, int>> usageFor(List<String> appsOrSites) async {
    final rng = Random(appsOrSites.join('|').hashCode);
    return {for (final a in appsOrSites) a: rng.nextInt(120)};
  }
}
