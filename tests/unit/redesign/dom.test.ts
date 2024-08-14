import {
  Dom,
  type PseudoElement,
  type Selector,
} from '../../../src/redesign/dom.js';
import { preprocessSources } from '../../../src/redesign/preprocess.js';
import { makeUuid, type Uuid } from '../../../src/redesign/utils/uuid.js';
import { createCssSource } from './helpers.js';

describe('Dom', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();

    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  describe('getAllPolyfilledElements', () => {
    it('should get elements with polyfilled properties', async () => {
      const css = `
        #polyfilled {
          anchor-name: --anchor;
        }
      `;
      document.body.innerHTML = `
        <div id="polyfilled"></div>
        <div id="not-polyfilled"></div>
      `;
      const source = createCssSource(css);
      const { selectorsByUuid } = preprocessSources([source]);
      const dom = new Dom(selectorsByUuid);
      dom.createFakePseudoElements();
      const polyfilledEl = document.querySelector('#polyfilled');
      expect([...(await dom.getAllPolyfilledElements()).values()]).toEqual([
        [polyfilledEl],
      ]);
    });

    it('should get fake pseudo-elements with polyfilled properties', async () => {
      // Mock getComputedStyle which is used to copy styles from the real
      // pseudo-element to the fake one.
      vi.stubGlobal(
        'getComputedStyle',
        vi.fn(() => ({
          [Symbol.iterator]: function* () {},
          getPropertyValue: vi.fn(() => ''),
        })),
      );

      const css = `
        #polyfilled::before, #polyfilled::after {
          anchor-name: --anchor;
        }
        div#polyfilled::before {
          anchor-name: --anchor;
        }
      `;
      document.body.innerHTML = `
        <div id="polyfilled"></div>
        <div id="not-polyfilled"></div>
      `;
      const source = createCssSource(css);
      const { selectorsByUuid } = preprocessSources([source]);
      const dom = new Dom(selectorsByUuid);
      dom.createFakePseudoElements();
      const beforeEl = document.querySelector('#polyfilled > :nth-child(1)');
      const afterEl = document.querySelector('#polyfilled > :nth-child(2)');
      expect(beforeEl).toBeTruthy();
      expect(afterEl).toBeTruthy();
    });
  });

  describe('matchesSelector', () => {
    it('should compare element with element selector', () => {
      document.body.innerHTML = `
        <div class="match"></div>
        <div class="nomatch"></div>
      `;
      const uuid = makeUuid();
      const selector: Selector = {
        uuid,
        elementPart: 'body .match',
        full: 'body .match',
      };
      const dom = new Dom(new Map<Uuid, Selector>([[uuid, selector]]));
      const matchEl = document.querySelector<HTMLElement>('.match')!;
      const noMatchEl = document.querySelector<HTMLElement>('.nomatch')!;
      expect(dom.matchesSelector(matchEl, selector)).toBe(true);
      expect(dom.matchesSelector(noMatchEl, selector)).toBe(false);
    });

    it('should compare element with pseudo-element selector', () => {
      document.body.innerHTML = `<div class="nomatch"></div>`;
      const uuid = makeUuid();
      const selector: Selector = {
        uuid,
        elementPart: '.nomatch',
        full: '.nomatch::before',
        pseudoPart: '::before',
      };
      const dom = new Dom(new Map<Uuid, Selector>([[uuid, selector]]));
      const noMatchEl = document.querySelector<HTMLElement>('.nomatch')!;
      expect(dom.matchesSelector(noMatchEl, selector)).toBe(false);
    });

    it('should compare pseudo-element with element selector', () => {
      document.body.innerHTML = `<div class="nomatch"></div>`;
      const uuid = makeUuid();
      const selector: Selector = {
        uuid,
        elementPart: '.nomatch',
        full: '.nomatch',
      };
      const dom = new Dom(new Map<Uuid, Selector>([[uuid, selector]]));
      const noMatchEl = document.querySelector<HTMLElement>('.nomatch')!;
      const noMatchElBefore: PseudoElement = {
        pseudoPart: '::before',
        contextElement: noMatchEl,
        fakePseudoElement: null!,
        computedStyle: null!,
        getBoundingClientRect: null!,
      };
      expect(dom.matchesSelector(noMatchElBefore, selector)).toBe(false);
    });

    it('should compare pseudo-element with pseudo-element selector', () => {
      document.body.innerHTML = `
        <div class="match"></div>
        <div class="nomatch"></div>
      `;
      const uuid = makeUuid();
      const selector: Selector = {
        uuid,
        elementPart: 'div.match',
        full: 'div.match::before',
        pseudoPart: '::before',
      };
      const dom = new Dom(new Map<Uuid, Selector>([[uuid, selector]]));
      const matchEl = document.querySelector<HTMLElement>('.match')!;
      const noMatchEl = document.querySelector<HTMLElement>('.nomatch')!;
      const matchElBefore: PseudoElement = {
        pseudoPart: '::before',
        contextElement: matchEl,
        fakePseudoElement: null!,
        computedStyle: null!,
        getBoundingClientRect: null!,
      };
      const matchElAfter: PseudoElement = {
        pseudoPart: '::after',
        contextElement: matchEl,
        fakePseudoElement: null!,
        computedStyle: null!,
        getBoundingClientRect: null!,
      };
      const noMatchElBefore: PseudoElement = {
        pseudoPart: '::before',
        contextElement: noMatchEl,
        fakePseudoElement: null!,
        computedStyle: null!,
        getBoundingClientRect: null!,
      };
      expect(dom.matchesSelector(matchElBefore, selector)).toBe(true);
      expect(dom.matchesSelector(matchElAfter, selector)).toBe(false);
      expect(dom.matchesSelector(noMatchElBefore, selector)).toBe(false);
    });
  });
});
