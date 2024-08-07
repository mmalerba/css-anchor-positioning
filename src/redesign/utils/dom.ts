import { POLYFILLED_PROPERTIES } from './const.js';
import type { PolyfilledProperty, Selector } from './types.js';
import { Uuid, UUID_PREFIX } from './uuid.js';

/** Class for working with the DOM in a polyfill-aware way. */
export class Dom {
  constructor(private selectors: Map<Uuid, Selector>) {}

  /** Gets the computed value of a CSS property. */
  getCssPopertyValue(element: HTMLElement, property: string) {
    // Read the computed value from the polyfilled custom property.
    const { customProperty, inherit } = POLYFILLED_PROPERTIES.get(
      property as PolyfilledProperty,
    ) ?? { customProperty: property, inherit: true };
    const computedStyle = getComputedStyle(element);
    const [computedValue, id] = computedStyle
      .getPropertyValue(customProperty)
      .trim()
      .split(` ${UUID_PREFIX}`);
    if (inherit) {
      return computedValue;
    }

    // If the property is not inherited, verify that the selector the value came
    // from actually selects this element.
    const uuid = `${UUID_PREFIX}${id}` as Uuid;
    const selector = this.selectors.get(uuid);
    if (selector && element.matches(selector.full)) {
      return computedValue;
    }
    return null;
  }
}
