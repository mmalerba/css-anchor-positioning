import { parseCss } from '../../../src/redesign/phases/parse.js';
import { createCssSource } from './helpers.js';

describe('parseCss', () => {
  it('should map properties to selectors that set them', () => {
    const source = createCssSource(`
      .anchor1 {
        anchor-name: --test1;
        anchor-scope: --test1;
      }
      .anchor2 {
        anchor-name: --test2;
      }
      .other {
        color: red;
      }
    `);
    const polyfilledPropertySelectors = parseCss([source]);
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
});
