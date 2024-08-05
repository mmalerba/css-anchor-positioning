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
let selectors: Map<Uuid, Selector>;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('/');
  await page.addScriptTag({
    type: 'module',

    content: `
      import { Dom } from '../../../src/redesign/utils/dom.ts';
      import {
        preprocessSources
      } from '../../../src/redesign/phases/preprocess.ts';

      window.Dom = Dom;
      window.preproccessSources = preprocessSources;
    `,
  });

  let loading = true;
  while (loading) {
    loading = await page.evaluate(() => {
      document.getSelection();
      return (window as unknown as LocalWindow).Dom === undefined;
    });
  }

  const css = `
  #dom-test-parent {
    display: block;
    position-anchor: --anchor;
    anchor-scope: all;
  }
`;
  const source = createCssSource(css);
  selectors = preprocessSources([source]).selectors;
  await page.setContent(
    `
    <style>${source.css}</style>
    <div id="dom-test-parent">
      <div id="dom-test-child"></div>
    </div>
  `,
    { waitUntil: 'load' },
  );
});

async function readProperty(selector: string, property: string) {
  return page.evaluate(
    async ([entries, selector, property]) => {
      const selectors = new Map(entries);
      const dom = new Dom(selectors);
      const element = document.querySelector<HTMLElement>(selector)!;
      return dom.getCssPopertyValue(element, property);
    },
    [[...selectors.entries()], selector, property] as const,
  );
}

test.afterAll(async ({ browser }) => {
  await browser.close();
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
