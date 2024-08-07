import {
  Dom,
  type PseudoElement,
  type Selector,
} from '../../../src/redesign/dom.js';
import { makeUuid, type Uuid } from '../../../src/redesign/utils/uuid.js';

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
    document.body.innerHTML = `
      <div class="nomatch"></div>
    `;
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
    document.body.innerHTML = `
      <div class="nomatch"></div>
    `;
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
