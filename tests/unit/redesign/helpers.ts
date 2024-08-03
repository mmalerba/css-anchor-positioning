import { CssSource } from '../../../src/redesign/phases/fetch.js';
import { makeUuid } from '../../../src/redesign/utils/uuid.js';

export function createCssSource(css: string): CssSource {
  return {
    element: document.createElement('style'),
    uuid: makeUuid(),
    css,
  };
}
