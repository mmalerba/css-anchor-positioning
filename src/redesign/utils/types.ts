import type { Uuid } from './uuid.js';

/** CSS properties that we polyfill. */
export type PolyfilledProperty =
  | 'anchor-name'
  | 'anchor-scope'
  | 'position-anchor';

/** Data needed to polyfill a property with a custom property. */
export interface PolyfilledPropertyData {
  /** Custom property that the property's value is shifted into. */
  customProperty: string;
  /** Whether the property should be inherited down the DOM. */
  inherit?: boolean;
}

/** Represents a source of CSS styles applied to the document. */
export interface CssSource {
  /** The element the styles come from */
  element: HTMLElement;
  /** A unique identifier for these styles */
  uuid: Uuid;
  /** The CSS text of the styles */
  css: string;
  /** The URL of the stylesheet */
  url?: URL;
  /** Whether the CSS is dirty and needs to be synced back to the DOM. */
  dirty?: boolean;
}

/** Represents a CSS selector with element and pseudo-element parts. */
export interface Selector {
  /** Unique identifier for this selector. */
  uuid: Uuid;
  /** The full selector text. */
  full: string;
  /** The selector text for the element part of the selector. */
  elementPart: string;
  /** The selector text for the pseudo-element part of the selector. */
  pseudoPart?: string;
}
