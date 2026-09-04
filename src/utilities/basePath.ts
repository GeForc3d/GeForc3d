/**
 * The directory the app is served from.
 *
 * Deliberately NOT `document.baseURI`: with hash routing that value carries the
 * current route (".../#/pose/look-back"), and appending an asset path to it
 * produces a URL the server has never heard of. Assets live next to index.html,
 * so the directory part of the pathname is the only correct base.
 */
export function appBasePath(): string {
  if (typeof window === 'undefined') return '';
  const explicit = document.querySelector('base')?.getAttribute('href');
  if (explicit) {
    const resolved = new URL(explicit, window.location.origin + window.location.pathname).href;
    return resolved.endsWith('/') ? resolved : `${resolved}/`;
  }
  const { origin, pathname } = window.location;
  const dir = pathname.endsWith('/') ? pathname : pathname.replace(/[^/]*$/, '');
  return `${origin}${dir}`;
}
