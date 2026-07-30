import type { ScreenTargetKind } from '@prisma/client';
import { badRequest } from '../../lib/http-error.js';

/**
 * Normalises a website target to a bare host. Accepts either a domain
 * (`instagram.com`) or a full URL (`https://instagram.com/feed`) and returns the
 * lower-cased host with any leading `www.` stripped. Throws on anything that is
 * not a plausible domain.
 */
export function normalizeWebTarget(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw badRequest('Enter a website domain or URL');

  let host: string;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
    host = new URL(hasScheme ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    throw badRequest('That is not a valid website domain or URL');
  }

  host = host.replace(/^www\./, '');
  // labels separated by dots, ending in a 2+ letter TLD.
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) {
    throw badRequest('That is not a valid website domain or URL');
  }
  return host;
}

export interface NormalizedTarget {
  appOrSite: string;
  kind: ScreenTargetKind;
  label: string;
}

/**
 * Validates and normalises a screen-time target.
 *  - `url`: normalised to a host (see [normalizeWebTarget]).
 *  - `app`: an opaque platform identifier (Android package name, or an iOS
 *    Screen-Time token) - kept as-is beyond trimming/length checks.
 */
export function normalizeTarget(
  kind: ScreenTargetKind,
  appOrSite: string,
  label?: string,
): NormalizedTarget {
  if (kind === 'url') {
    const host = normalizeWebTarget(appOrSite);
    return { appOrSite: host, kind, label: label?.trim() || host };
  }

  const id = appOrSite.trim();
  if (!id) throw badRequest('Choose an app to block');
  if (id.length > 200) throw badRequest('App identifier is too long');
  return { appOrSite: id, kind, label: label?.trim() || id };
}
