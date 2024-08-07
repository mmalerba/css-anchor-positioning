import { expect, Page, test } from '@playwright/test';
import { preprocessSources } from '../../../src/redesign/phases/preprocess.js';
import { Dom } from '../../../src/redesign/utils/dom.js';
import type { Selector } from '../../../src/redesign/utils/types.js';
import { Uuid } from '../../../src/redesign/utils/uuid.js';
import { createCssSource } from '../../unit/redesign/helpers.js';

interface LocalWindow extends Window {
  Dom: typeof Dom;
  preprocessSources: typeof preprocessSources;
}

let page: Page;

async function setupPage(page: Page, css: string, html: string) {
  const source = createCssSource(css);
  const selectors = preprocessSources([source]).selectors;
  await page.setContent(
    `
      <style>${source.css}</style>
      ${html}
    `,
    { waitUntil: 'load' },
  );
  return selectors;
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('/');
  await page.addScriptTag({
    type: 'module',
    content: `
      import { Dom } from '../../../src/redesign/utils/dom.ts';
      window.Dom = Dom;
    `,
  });

  let loading = true;
  while (loading) {
    loading = await page.evaluate(() => {
      document.getSelection();
      return (window as unknown as LocalWindow).Dom === undefined;
    });
  }
});

test.afterAll(async ({ browser }) => {
  await browser.close();
});

// Note: These are implemented as e2e tests rather than unit tests, because we
// need the browser's real CSS property inheritance logic.
test.describe('getCssPropertyValue', () => {
  let selectors: Map<Uuid, Selector>;

  async function readProperty(selector: string, property: string) {
    return page.evaluate(
      async ([entries, selector, property]) => {
        const selectors = new Map(entries);
        const dom = new Dom(selectors);
        const element = document.querySelector<HTMLElement>(selector)!;
        return dom.getCssPopertyValue(element, property);
      },
      [[...selectors], selector, property] as const,
    );
  }

  test.beforeEach(async () => {
    selectors = await setupPage(
      page,
      `
        #dom-test-parent {
          display: block;
          position-anchor: --anchor;
          anchor-scope: all;
        }
      `,
      `
        <div id="dom-test-parent">
          <div id="dom-test-child"></div>
        </div>
      `,
    );
  });

  test('should get computed value for polyfilled property', async () => {
    const anchorScope = await readProperty('#dom-test-parent', 'anchor-scope');
    expect(anchorScope).toBe('all');
  });

  test('should get computed value for non polyfilled property', async () => {
    const display = await readProperty('#dom-test-parent', 'display');
    expect(display).toBe('block');
  });

  test('should allow inherited polyfilled properties to inherit', async () => {
    const positionAnchor = await readProperty(
      '#dom-test-child',
      'position-anchor',
    );
    expect(positionAnchor).toBe('--anchor');
  });

  test('should not allow non-inherited polyfilled properties to inherit', async () => {
    const anchorScope = await readProperty('#dom-test-child', 'anchor-scope');
    expect(anchorScope).toBeNull();
  });
});

// Note: These are implemented as e2e tests rather than unit tests, because we
// need to use getComputedStyle to create the fake pseudo elements.
test.describe('getAllPolyfilledElements', () => {
  async function getPolyfilledElementIds(selectors: Map<Uuid, Selector>) {
    return page.evaluate(
      ([selectors]) => {
        const dom = new Dom(new Map(selectors));
        dom.createFakePseudoElements();
        return [...dom.getAllPolyfilledElements().values()]
          .flat()
          .map((el) =>
            el instanceof HTMLElement
              ? el.id
              : `${el.contextElement.id}${el.pseudoPart} (${el.fakePseudoElement.id})`,
          );
      },
      [[...selectors]],
    );
  }

  test('should get elements with polyfilled properties', async () => {
    const selectors = await setupPage(
      page,
      `
        #polyfilled {
          anchor-name: --anchor;
        }
      `,
      `
        <div id="polyfilled"></div>
        <div id="not-polyfilled"></div>
      `,
    );
    expect(await getPolyfilledElementIds(selectors)).toEqual(['polyfilled']);
  });

  test('should get fake pseudo-elements with polyfilled properties', async () => {
    const selectors = await setupPage(
      page,
      `
        #polyfilled::before, #polyfilled::after {
          anchor-name: --anchor;
        }
        div#polyfilled::before {
          anchor-name: --anchor;
        }
      `,
      `
        <div id="polyfilled"></div>
        <div id="not-polyfilled"></div>
      `,
    );
    const ids = await getPolyfilledElementIds(selectors);
    expect(ids).toEqual([
      expect.stringMatching('polyfilled::before'),
      expect.stringMatching('polyfilled::after'),
      expect.stringMatching('polyfilled::before'),
    ]);
    // The full id, including the fake pseudo-element id, should be the same,
    // because the selectors refer to the same fake pseudo-element.
    expect(ids[0]).toEqual(ids[2]);
  });
});
