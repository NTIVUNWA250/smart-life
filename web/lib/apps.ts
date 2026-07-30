/**
 * Apps a screen-time limit can be set on, from the web.
 *
 * Ids are real Android package names, because that is what actually gets
 * measured: the phone reports usage via `UsageStatsManager`, which reports
 * per-app foreground time keyed by package name. It cannot see browser URLs, so
 * a limit on `youtube.com` would never accumulate a single minute — only
 * `com.google.android.youtube` does.
 *
 * Kept in sync with `ScreenTimeNative.commonApps` in
 * mobile/lib/features/screentime/screentime_native.dart. The phone's own picker
 * can offer any installed app; this list is the subset the web offers, since a
 * browser has no way to enumerate what is installed on your phone.
 */
export interface BlockableApp {
  id: string;
  label: string;
}

export const BLOCKABLE_APPS: BlockableApp[] = [
  { id: 'com.instagram.android', label: 'Instagram' },
  { id: 'com.zhiliaoapp.musically', label: 'TikTok' },
  { id: 'com.google.android.youtube', label: 'YouTube' },
  { id: 'com.whatsapp', label: 'WhatsApp' },
  { id: 'com.twitter.android', label: 'X (Twitter)' },
  { id: 'com.facebook.katana', label: 'Facebook' },
  { id: 'com.snapchat.android', label: 'Snapchat' },
];

/** The friendly name for a stored target, falling back to the raw identifier. */
export function appLabel(appOrSite: string, stored?: string | null): string {
  if (stored && stored.trim()) return stored;
  return BLOCKABLE_APPS.find((a) => a.id === appOrSite)?.label ?? appOrSite;
}
