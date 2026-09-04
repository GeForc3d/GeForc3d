/**
 * The directory the app is served from.
 *
 * This is what the bundled vision model and any pose photography are resolved
 * against, so getting it wrong means a 404 rather than a layout glitch. Three
 * things make it awkward:
 *
 *   - `document.baseURI` carries the current hash route, so appending an asset
 *     path to it produces a URL the server has never heard of.
 *   - The app is deployed under a subpath on project hosting such as GitHub
 *     Pages (`/GeForc3d/`), so the origin alone is not enough.
 *   - A URL without a trailing slash (`/GeForc3d` rather than `/GeForc3d/`) is
 *     ambiguous: the last segment could be a directory or a file.
 *
 * The built bundle's own URL settles all three, because Vite emits it as
 * `<base>/assets/index-<hash>.js`. Everything before `/assets/` is the base, no
 * matter what route the user is on or how they typed the address.
 */

const fromModuleUrl = (): string | null => {
  const here = typeof import.meta !== 'undefined' ? import.meta.url : '';
  const marker = here.lastIndexOf('/assets/');
  if (marker === -1) return null;
  return `${here.slice(0, marker)}/`;
};

const fromLocation = (): string => {
  const { origin, pathname } = window.location;
  const dir = pathname.endsWith('/') ? pathname : pathname.replace(/[^/]*$/, '');
  return `${origin}${dir}`;
};

export function appBasePath(): string {
  if (typeof window === 'undefined') return '';
  // In a production build this is exact. In dev the module lives under /src/,
  // so there is no /assets/ marker and we fall back to the location.
  return fromModuleUrl() ?? fromLocation();
}

/** Exported for testing; both strategies must agree at the site root. */
export const __internals = { fromLocation };
