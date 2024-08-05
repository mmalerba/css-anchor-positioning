import { preprocessSources } from '../../../src/redesign/phases/preprocess.js';
import { POLYFILLED_PROPERTIES } from '../../../src/redesign/utils/const.js';
import { createCssSource } from './helpers.js';

const ANCHOR_NAME_PROP =
  POLYFILLED_PROPERTIES.get('anchor-name')?.customProperty;
const ANCHOR_SCOPE_PROP =
  POLYFILLED_PROPERTIES.get('anchor-scope')?.customProperty;
const POSITION_ANCHOR_PROP =
  POLYFILLED_PROPERTIES.get('position-anchor')?.customProperty;

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
    const { polyfilledPropertySelectors } = preprocessSources([source]);
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
    const { polyfilledPropertySelectors } = preprocessSources([source]);
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
    const { selectors } = preprocessSources([source]);
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
    const { selectors } = preprocessSources([source]);
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
    const { selectors } = preprocessSources([source]);
    expect([...selectors.values()]).toEqual([
      {
        uuid: expect.any(String),
        full: '.anchor',
        elementPart: '.anchor',
      },
    ]);
  });

  it('should transfer unsupported properties to custom properties', () => {
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

  it('should mark the selector that declared a non-inherited polyfilled property', () => {
    const source = createCssSource(`
      .anchor {
        anchor-name: --test;
      }
    `);
    const { selectors } = preprocessSources([source]);
    const [uuid] = selectors.keys();
    expect(source.dirty).toBe(true);
    expect(source.css).toContain(`${ANCHOR_NAME_PROP}-selector:${uuid}`);
  });

  it('should not mark the selector that declared an inherited polyfilled property', () => {
    const source = createCssSource(`
      .anchor {
        position-anchor: --test;
      }
    `);
    preprocessSources([source]);
    expect(source.dirty).toBe(true);
    expect(source.css).not.toContain(`${POSITION_ANCHOR_PROP}-selector:`);
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
});
