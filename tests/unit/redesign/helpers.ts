import { CssSource } from '../../../src/redesign/utils/types.js';
import { makeUuid } from '../../../src/redesign/utils/uuid.js';

export function createCssSource(css: string): CssSource {
  return {
    element: null!,
    uuid: makeUuid(),
    css,
  };
}
