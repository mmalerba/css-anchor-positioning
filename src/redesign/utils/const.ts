import { PolyfilledProperty, PolyfilledPropertyData } from './types.js';
import { makeAttr } from './uuid.js';

/** Attribute used to link an element to a uuid. */
export const UUID_ATTRIBUTE = makeAttr('uuid');

/**
 * Map of CSS properties that we polyfill, either to support unknown properties
 * or unknown property values.
 */

export const POLYFILLED_PROPERTIES = new Map<
  PolyfilledProperty,
  PolyfilledPropertyData
>([
  ['anchor-name', { customProperty: makeAttr('anchor-name') }],
  ['anchor-scope', { customProperty: makeAttr('anchor-scope') }],
  [
    'position-anchor',
    {
      customProperty: makeAttr('position-anchor'),
      inherit: true,
    },
  ],
]);
