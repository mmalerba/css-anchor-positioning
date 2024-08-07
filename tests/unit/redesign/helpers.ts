import { type CssSource } from '../../../src/redesign/source.js';
import { makeUuid } from '../../../src/redesign/utils/uuid.js';

/** Creates a fake CSS source. */
export function createCssSource(css: string): CssSource {
  return {
    element: null!,
    uuid: makeUuid(),
    css,
  };
}
