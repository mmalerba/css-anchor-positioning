import { Dom, PseudoElement, Selector } from '../../../src/redesign/dom.js';
import { parseAnchorFunctions } from '../../../src/redesign/parse.js';
import { ValueMetadata } from '../../../src/redesign/preprocess.js';
import { resolveAnchorProperties } from '../../../src/redesign/resolve.js';
import { makeUuid } from '../../../src/redesign/utils/uuid.js';

describe('resolveAnchorProperties', () => {
  let dom: Dom, el1: HTMLElement, el2: HTMLElement, selector: Selector;

  function mockGetCssPropertyValue(
    data: Map<
      HTMLElement | PseudoElement,
      { [prop: string]: { value: string; metadata: ValueMetadata } }
    >,
  ) {
    return vi
      .spyOn(dom, 'getCssPropertyValue')
      .mockImplementation(
        (element: HTMLElement | PseudoElement, property: string) => {
          return data.get(element)?.[property] ?? { value: '' };
        },
      );
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="el1"></div>
      <div id="el2"></div>
    `;
    [el1, el2] = document.querySelectorAll('div');
    dom = new Dom(new Map());
    selector = {
      full: '*',
      elementPart: '*',
      uuid: makeUuid(),
    };
    const getAllPolyfilledElements = vi.spyOn(dom, 'getAllPolyfilledElements');
    getAllPolyfilledElements.mockReturnValue(new Map([[selector, [el1, el2]]]));
  });

  afterEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
  });

  it('should resolve static anchor-name', () => {
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            'anchor-name': {
              value: '--anchor',
              metadata: { selector: selector.uuid },
            },
          },
        ],
        [
          el2,
          {
            'anchor-name': {
              value: 'none',
              metadata: { selector: selector.uuid },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([['anchor-name' as const, [selector]]]);
    const { elementsByAnchorName } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      new Map(),
    );
    expect(elementsByAnchorName.get('--anchor')).toEqual([el1]);
    expect(elementsByAnchorName.get('none')).toBeUndefined();
  });

  it('should resolve static anchor-scope', () => {
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            'anchor-scope': {
              value: 'all',
              metadata: { selector: selector.uuid },
            },
          },
        ],
        [
          el2,
          {
            'anchor-scope': {
              value: 'none',
              metadata: { selector: selector.uuid },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([
      ['anchor-scope' as const, [selector]],
    ]);
    const { elementsByAnchorScope } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      new Map(),
    );
    expect(elementsByAnchorScope.get('all')).toEqual([el1]);
    expect(elementsByAnchorScope.get('none')).toBeUndefined();
  });

  it('should resolve static position-anchor', () => {
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            'position-anchor': {
              value: '--default',
              metadata: { selector: selector.uuid },
            },
          },
        ],
        [
          el2,
          {
            'position-anchor': {
              value: 'auto',
              metadata: { selector: selector.uuid },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([
      ['position-anchor' as const, [selector]],
    ]);
    const { elementsByPositionAnchor } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      new Map(),
    );
    expect(elementsByPositionAnchor.get('--default')).toEqual([el1]);
    expect(elementsByPositionAnchor.get('auto')).toBeUndefined();
  });

  it('should resolve static anchor functions', () => {
    const anchorFunction = 'anchor(--anchor top)';
    const anchor = parseAnchorFunctions('anchor(--anchor top)', 'anchor')!;
    const anchorValuesByUuid = new Map([[anchor.uuid, anchor]]);
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            left: {
              value: anchorFunction,
              metadata: { selector: selector.uuid, parsed: anchor.uuid },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([['left' as const, [selector]]]);
    const { anchorsByElementAndProperty } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      anchorValuesByUuid,
    );
    expect(anchorsByElementAndProperty.get(el1)).toBeDefined();
    expect(anchorsByElementAndProperty.get(el1)!.get('left')).toEqual(anchor);
  });

  it('should resolve dynamic anchor-name', () => {
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            'anchor-name': {
              value: '--anchor',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
        [
          el2,
          {
            'anchor-name': {
              value: 'invalid',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([['anchor-name' as const, [selector]]]);
    const { elementsByAnchorName } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      new Map(),
    );
    expect(elementsByAnchorName.get('--anchor')).toEqual([el1]);
    expect(elementsByAnchorName.get('invalid' as any)).toBeUndefined();
  });

  it('should resolve dynamic anchor-scope', () => {
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            'anchor-scope': {
              value: 'all',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
        [
          el2,
          {
            'anchor-scope': {
              value: 'invalid',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([
      ['anchor-scope' as const, [selector]],
    ]);
    const { elementsByAnchorScope } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      new Map(),
    );
    expect(elementsByAnchorScope.get('all')).toEqual([el1]);
    expect(elementsByAnchorScope.get('invalid' as any)).toBeUndefined();
  });

  it('should resolve dynamic position-anchor', () => {
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            'position-anchor': {
              value: '--default',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
        [
          el2,
          {
            'position-anchor': {
              value: 'invalid',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([
      ['position-anchor' as const, [selector]],
    ]);
    const { elementsByPositionAnchor } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      new Map(),
    );
    expect(elementsByPositionAnchor.get('--default')).toEqual([el1]);
    expect(elementsByPositionAnchor.get('invalid' as any)).toBeUndefined();
  });

  it('should resolve dynamic anchor functions', () => {
    mockGetCssPropertyValue(
      new Map([
        [
          el1,
          {
            left: {
              value: 'anchor(--anchor top)',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
        [
          el2,
          {
            left: {
              value: 'anchor-size(--anchor width)',
              metadata: { selector: selector.uuid, dynamic: true },
            },
          },
        ],
      ]),
    );
    const selectorsByProperty = new Map([['left' as const, [selector]]]);
    const { anchorsByElementAndProperty } = resolveAnchorProperties(
      dom,
      selectorsByProperty,
      new Map(),
    );
    expect(anchorsByElementAndProperty.get(el1)).toBeDefined();
    expect(anchorsByElementAndProperty.get(el1)!.get('left')).toEqual({
      uuid: expect.any(String),
      polyfilledValue: expect.stringMatching(/var\(.*\)/),
      anchorFunctions: [
        {
          functionName: 'anchor',
          anchorSpecifier: '--anchor',
          customProperty: expect.stringMatching(/--.*/),
          side: 'top',
        },
      ],
    });
    expect(anchorsByElementAndProperty.get(el2)).toBeUndefined();
  });
});
