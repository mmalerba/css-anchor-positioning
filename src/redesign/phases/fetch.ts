import { allSettled, fetchData, isFulfilled } from '../utils/async.js';
import { UUID_ATTRIBUTE } from '../utils/const.js';
import type { CssSource } from '../utils/types.js';
import { makeUuid } from '../utils/uuid.js';

/** Fetch all style sources for the given selector. */
export async function fetchCssSources(
  selector = 'style,link,[style]',
): Promise<CssSource[]> {
  const sources = await allSettled(
    [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
      if (element instanceof HTMLLinkElement) {
        return fetchLinkedCssSource(element);
      }
      if (element instanceof HTMLStyleElement) {
        return fetchStyleTagCssSource(element);
      }
      return fetchInlineCssSource(element);
    }),
  );
  return sources
    .filter(isFulfilled)
    .map(({ value }) => value)
    .filter((value) => value !== null);
}

/**
 * Fetches a CSS source for the inline styles in the `style` attribute of an
 * element.
 */
function fetchInlineCssSource(element: HTMLElement): CssSource | null {
  const uuid = makeUuid();
  const styles = element.getAttribute('style') ?? '';
  if (!styles) {
    return null;
  }
  return {
    element,
    uuid,
    css: `[${UUID_ATTRIBUTE}="${uuid}"] { ${styles} }`,
  };
}

/** Fetches a CSS source for a `<style>` element. */
function fetchStyleTagCssSource(element: HTMLStyleElement): CssSource | null {
  const css = element.innerHTML;
  if (!css) {
    return null;
  }
  return {
    element,
    uuid: makeUuid(),
    css,
  };
}

/** Fetches a CSS source for a `<link>` element. */
async function fetchLinkedCssSource(
  element: HTMLLinkElement,
): Promise<CssSource | null> {
  if (!isLinkedStylesheet(element)) {
    return null;
  }
  const url = new URL(element.href, document.baseURI);
  if (url.origin !== location.origin) {
    return null;
  }
  return {
    element,
    uuid: makeUuid(),
    css: await fetchData(url),
    url,
  };
}

/** Checks whether a given `<link>` element represents a stylesheet. */
function isLinkedStylesheet(link: HTMLLinkElement) {
  return (link.type === 'text/css' || link.rel === 'stylesheet') && !!link.href;
}
