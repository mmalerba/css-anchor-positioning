import { makeAttr } from './utils/uuid.js';

/** Data needed to polyfill a property with a custom property. */
export interface PolyfilledProperty {
  /** Custom property that the property's value is shifted into. */
  customProperty: string;
  /** Whether the property should be inherited down the DOM. */
  inherit?: boolean;
}

/** Attribute used to link an element to a uuid. */
export const UUID_ATTR = makeAttr('uuid');

/**
 * Map of CSS properties that we polyfill, either to support unknown properties
 * or unknown property values.
 */
export const POLYFILLED_PROPERTIES: { [property: string]: PolyfilledProperty } =
  {
    'position-anchor': {
      customProperty: makeAttr('position-anchor'),
      inherit: true,
    },
    'anchor-scope': { customProperty: makeAttr('anchor-scope') },
    'anchor-name': { customProperty: makeAttr('anchor-name') },
  };
