import { expect, Page, test } from '@playwright/test';
import { Dom, type Selector } from '../../../src/redesign/dom.js';
import { preprocessSources } from '../../../src/redesign/preprocess.js';
import { type Uuid } from '../../../src/redesign/utils/uuid.js';
import { createCssSource } from '../../unit/redesign/helpers.js';

interface LocalWindow extends Window {
  Dom: typeof Dom;
  preprocessSources: typeof preprocessSources;
}

test.afterAll(async ({ browser }) => {
  await browser.close();
});

test.describe('Dom', () => {
  let page: Page;

  async function setupPage(css: string, html: string) {
    const source = createCssSource(css);
    const selectors = preprocessSources([source]).selectorsByUuid;
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
        import { Dom } from '../../../src/redesign/dom.ts';
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

  // Note: These are implemented as e2e tests rather than unit tests, because we
  // want the browser's real CSS property inheritance behavior.
  test.describe('getCssPropertyValue', () => {
    let selectors: Map<Uuid, Selector>;

    async function readProperty(selector: string, property: string) {
      return page.evaluate(
        async ([entries, selector, property]) => {
          const selectors = new Map(entries);
          const dom = new Dom(selectors);
          const element = document.querySelector<HTMLElement>(selector)!;
          return dom.getCssPopertyValue(element, property).value;
        },
        [[...selectors], selector, property] as const,
      );
    }

    test.beforeEach(async () => {
      selectors = await setupPage(
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
      const anchorScope = await readProperty(
        '#dom-test-parent',
        'anchor-scope',
      );
      expect(anchorScope).toBe('all');
    });

    test('should get computed value for non-polyfilled property', async () => {
      const display = await readProperty('#dom-test-parent', 'display');
      expect(display).toBe('block');
    });

    test('should not allow polyfilled properties to inherit', async () => {
      const anchorScope = await readProperty('#dom-test-child', 'anchor-scope');
      expect(anchorScope).toBe('');
    });
  });
});
