import { afterEach, describe, expect, it, vi } from 'vitest';
import { __internals } from './basePath';

/**
 * A wrong base means the vision model 404s on a real device, which is exactly
 * the kind of failure that only shows up after deployment.
 */
describe('base path from location', () => {
  const at = (href: string) => {
    const url = new URL(href);
    vi.stubGlobal('window', { location: { origin: url.origin, pathname: url.pathname } });
    return __internals.fromLocation();
  };

  afterEach(() => vi.unstubAllGlobals());

  it('resolves the site root', () => {
    expect(at('https://example.com/')).toBe('https://example.com/');
  });

  it('resolves a project subpath', () => {
    expect(at('https://user.github.io/repo/')).toBe('https://user.github.io/repo/');
  });

  it('ignores the hash route', () => {
    expect(at('https://user.github.io/repo/#/pose/look-back')).toBe(
      'https://user.github.io/repo/',
    );
  });

  it('strips an explicit index.html', () => {
    expect(at('https://user.github.io/repo/index.html')).toBe('https://user.github.io/repo/');
  });
});
