import { fetchData, isFulfilled } from './utils/async.js';
import { makeAttribute, makeUuid, type Uuid } from './utils/uuid.js';

/**
 * Represents a source of CSS styles, such as a `<style>` or `<link>` tag, or
 * `style` attribute.
 */
export interface CssSource {
  /** The element the styles come from */
  element: HTMLElement;
  /** A unique identifier for these styles */
  uuid: Uuid;
  /** The CSS text of the styles */
  css: string;
  /** The URL of the stylesheet */
  url?: URL;
  /** Whether the CSS is dirty and needs to be synced back to the DOM. */
  dirty?: boolean;
}

/** Attribute that links an element with inline styles to its CssSource. */
export const INLINE_STYLES_ATTRIBUTE = makeAttribute('inline-styles');

/** Fetch all style sources for the given selector. */
export async function readCssSources(
  selector = 'style,link,[style]',
): Promise<CssSource[]> {
  const sources = await Promise.allSettled(
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

/** Writes the given CSS sources back to the DOM if they are dirty. */
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
    css: `[${INLINE_STYLES_ATTRIBUTE}="${uuid}"] { ${styles} }`,
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
  element.setAttribute(INLINE_STYLES_ATTRIBUTE, source.uuid);
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
