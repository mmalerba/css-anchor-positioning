import { POLYFILLED_PROPERTIES } from '../../../src/redesign/definitions.js';
import {
  METADATA_DELIMETER,
  preprocessSources,
} from '../../../src/redesign/preprocess.js';
import { createCssSource } from './helpers.js';

const ANCHOR_NAME_PROP = POLYFILLED_PROPERTIES.get('anchor-name');
const ANCHOR_SCOPE_PROP = POLYFILLED_PROPERTIES.get('anchor-scope');
const POSITION_ANCHOR_PROP = POLYFILLED_PROPERTIES.get('position-anchor');

describe('preprocessSources', () => {
  it('should collect selectors that declare polyfilled properties', () => {
    const source = createCssSource(`
      .anchor1 {
        anchor-name: --test1;
        anchor-scope: --test1;
      }
      .anchor2 {
        anchor-name: --test2;
      }
    `);
    const { selectorsByProperty: polyfilledPropertySelectors } =
      preprocessSources([source]);
    expect(Object.fromEntries(polyfilledPropertySelectors.entries())).toEqual({
      'anchor-name': [
        {
          uuid: expect.any(String),
          full: '.anchor1',
          elementPart: '.anchor1',
        },
        {
          uuid: expect.any(String),
          full: '.anchor2',
          elementPart: '.anchor2',
        },
      ],
      'anchor-scope': [
        {
          uuid: expect.any(String),
          full: '.anchor1',
          elementPart: '.anchor1',
        },
      ],
    });
  });

  it('should not collect selectors that do not declare polyfilled properties', () => {
    const source = createCssSource(`
      .some-el {
        color: red;
      }
    `);
    const { selectorsByProperty: polyfilledPropertySelectors } =
      preprocessSources([source]);
    expect(polyfilledPropertySelectors.size).toBe(0);
  });

  it('should collect all parsed selectors by uuid', () => {
    const source = createCssSource(`
      .anchor1 {
        anchor-name: --test1;
      }
      .anchor2 {
        anchor-name: --test2;
      }
      .some-el {
        color: red;
      }
    `);
    const { selectorsByUuid: selectors } = preprocessSources([source]);
    expect([...selectors.values()]).toEqual([
      {
        uuid: expect.any(String),
        full: '.anchor1',
        elementPart: '.anchor1',
      },
      {
        uuid: expect.any(String),
        full: '.anchor2',
        elementPart: '.anchor2',
      },
    ]);
  });

  it('should parse complex selectors', () => {
    const source = createCssSource(`
      .el + button:focus::before, .other:not(#id [attr])::after {
        anchor-name: --test;
      }
    `);
    const { selectorsByUuid: selectors } = preprocessSources([source]);
    expect([...selectors.values()]).toEqual([
      {
        uuid: expect.any(String),
        full: '.el+button:focus::before',
        elementPart: '.el+button:focus',
        pseudoPart: '::before',
      },
      {
        uuid: expect.any(String),
        full: '.other:not(#id [attr])::after',
        elementPart: '.other:not(#id [attr])',
        pseudoPart: '::after',
      },
    ]);
  });

  it('should parse selectors insider at-rules', () => {
    const source = createCssSource(`
      @media print {
        .anchor {
          anchor-name: --test;
        }
      }
    `);
    const { selectorsByUuid: selectors } = preprocessSources([source]);
    expect([...selectors.values()]).toEqual([
      {
        uuid: expect.any(String),
        full: '.anchor',
        elementPart: '.anchor',
      },
    ]);
  });

  it('should parse selector with pseudo-element', () => {
    const source = createCssSource(`
      .anchor::before {
        anchor-name: --test;
      }
    `);
    const { selectorsByUuid: selectors } = preprocessSources([source]);
    expect([...selectors.values()]).toEqual([
      {
        uuid: expect.any(String),
        full: '.anchor::before',
        elementPart: '.anchor',
        pseudoPart: '::before',
      },
    ]);
  });

  it('should copy unsupported properties to custom properties', () => {
    const source = createCssSource(`
      .anchor {
        anchor-name: --test;
        anchor-scope: --test;
      }
      .positioned {
        position-anchor: --test;
      }
    `);
    preprocessSources([source]);
    expect(source.dirty).toBe(true);
    expect(source.css).toContain(`${ANCHOR_NAME_PROP}:--test`);
    expect(source.css).toContain(`${ANCHOR_SCOPE_PROP}:--test`);
    expect(source.css).toContain(`${POSITION_ANCHOR_PROP}:--test`);
  });

  it('should not change CSS that does not declare unsupported properties', () => {
    const css = `
      .some-el {
        color: red
      }
    `;
    const source = createCssSource(css);
    preprocessSources([source]);
    expect(source.dirty).toBeFalsy();
    expect(source.css).toBe(css);
  });

  it('should parse static anchor functions', () => {
    const source = createCssSource(`
      .positioned {
        left: anchor(--anchor top);
      }
    `);
    const { anchorValuesByUuid } = preprocessSources([source]);
    expect([...anchorValuesByUuid.values()]).toEqual([
      {
        uuid: expect.any(String),
        polyfilledValue: expect.any(String),
        anchorFunctions: [
          {
            functionName: 'anchor',
            customProperty: expect.any(String),
            anchorSpecifier: '--anchor',
            side: 'top',
          },
        ],
      },
    ]);
  });

  it('should not parse dyanmic anchor functions', () => {
    const source = createCssSource(`
      .positioned {
        left: anchor(--anchor var(--side));
      }
    `);
    const { anchorValuesByUuid } = preprocessSources([source]);
    expect([...anchorValuesByUuid.values()]).toEqual([]);
  });

  it('should add reference to parsed selectors in metadata', () => {
    const source = createCssSource(`
      .anchor {
        anchor-name: --test;
      }
    `);
    const { selectorsByUuid } = preprocessSources([source]);
    const [uuid] = selectorsByUuid.keys();
    expect(source.dirty).toBe(true);
    expect(source.css).toContain(` selector${METADATA_DELIMETER}${uuid}`);
  });

  it('should add reference to parsed anchors in metadata', () => {
    const source = createCssSource(`
      .positioned {
        left: anchor(--anchor top);
      }
    `);
    const { anchorValuesByUuid } = preprocessSources([source]);
    const [uuid] = anchorValuesByUuid.keys();
    expect(source.css).toContain(` parsed${METADATA_DELIMETER}${uuid}`);
  });

  it('should note dynamic values in metadata', () => {
    const source = createCssSource(`
      .anchor {
        anchor-name: var(--name);
      }
    `);
    preprocessSources([source]);
    expect(source.css).toContain(` dynamic${METADATA_DELIMETER}true`);
  });
});
