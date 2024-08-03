import { preprocessCss } from '../../../src/redesign/phases/preprocess.js';
import { POLYFILLED_PROPERTIES } from '../../../src/redesign/utils/const.js';
import { createCssSource } from './helpers.js';

describe('preprocessCss', () => {
  it('should polyfill unsupported properties', () => {
    const source = createCssSource(`
      .anchor {
        anchor-name: --test;
        anchor-scope: --test;
      }
      .positioned {
        position-anchor: --test;
      }
    `);
    const dirty = preprocessCss([source]);
    expect(dirty).toBe(true);
    expect(source.css).toContain(
      `${POLYFILLED_PROPERTIES.get('anchor-name')?.customProperty}:--test`,
    );
    expect(source.css).toContain(
      `${POLYFILLED_PROPERTIES.get('anchor-scope')?.customProperty}:--test`,
    );
    expect(source.css).toContain(
      `${POLYFILLED_PROPERTIES.get('position-anchor')?.customProperty}:--test`,
    );
  });

  it('should not change CSS with no unsupported properties', () => {
    const source = createCssSource(`
      .some-el {
        color: red
      }
    `);
    const dirty = preprocessCss([source]);
    expect(dirty).toBe(false);
  });
});
