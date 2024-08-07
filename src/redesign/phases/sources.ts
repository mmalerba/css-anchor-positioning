import { allSettled, fetchData, isFulfilled } from '../utils/async.js';
import { UUID_ATTRIBUTE } from '../utils/const.js';
import type { CssSource } from '../utils/types.js';
import { makeUuid } from '../utils/uuid.js';

/** Fetch all style sources for the given selector. */
export async function readCssSources(
  selector = 'style,link,[style]',
): Promise<CssSource[]> {
  const sources = await allSettled(
    [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
      if (element instanceof HTMLLinkElement) {
        return readLinkedCssSource(element);
      }
      if (element instanceof HTMLStyleElement) {
        return readStyleTagCssSource(element);
      }
      return readInlineCssSource(element);
    }),
  );
  return sources
    .filter(isFulfilled)
    .map(({ value }) => value)
    .filter((value) => value !== null);
}

export async function writeCssSources(sources: CssSource[]) {
  for (const source of sources) {
    const { element } = source;
    if (element instanceof HTMLStyleElement) {
      writeStyleTagCssSource(source);
    } else if (element instanceof HTMLLinkElement) {
      await writeLinkedCssSource(source);
    } else {
      writeInlineCssSource(source);
    }
  }
}

/**
 * Reads a CSS source for the inline styles in the `style` attribute of an
 * element.
 */
function readInlineCssSource(element: HTMLElement): CssSource | null {
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

/** Reads a CSS source for a `<style>` element. */
function readStyleTagCssSource(element: HTMLStyleElement): CssSource | null {
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

/** Reads a CSS source for a `<link>` element. */
async function readLinkedCssSource(
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

/** Writes a CSS source for inline styles back to the `style` attribute. */
function writeInlineCssSource(source: CssSource) {
  const { dirty, element, css } = source;
  if (!dirty) {
    return;
  }
  source.dirty = false;
  element.setAttribute(
    'style',
    css.slice(css.indexOf('{') + 1, css.lastIndexOf('}')).trim(),
  );
}

/** Writes a CSS source for a `<style>` element back to the DOM. */
function writeStyleTagCssSource(source: CssSource) {
  const { dirty, element, css } = source;
  if (!dirty) {
    return;
  }
  source.dirty = false;
  element.innerHTML = css;
}

/** Writes a CSS source for a `<link>` element back to the element's `href`. */
async function writeLinkedCssSource(source: CssSource) {
  const { dirty, element, css } = source;
  if (!dirty) {
    return;
  }
  source.dirty = false;

  // Create new link
  const blob = new Blob([css], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  const promise = new Promise((resolve) => {
    link.onload = resolve;
  });
  element.replaceWith(link);

  // Wait for new stylesheet to be loaded
  await promise;
  URL.revokeObjectURL(url);
  source.element = link;
}
