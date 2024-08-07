import { makeCssProperty } from './uuid.js';

/** A dashed CSS identifier. */
export type DashedIdent = `--${string}`;

/** CSS properties that we polyfill. */
export type PolyfilledProperty =
  typeof POLYFILLED_PROPERTIES extends Map<infer K, any> ? K : never;

/** A property used to specify an inset. */
export type InsetProperty = (typeof INSET_PROPERTIES)[number];

/** A property used to specify a size. */
export type SizingProperty = (typeof SIZING_PROPERTIES)[number];

/** Data needed to polyfill a property with a custom property. */
export interface PolyfilledPropertyConfig {
  /** Custom property that the property's value is shifted into. */
  customProperty: string;
  /** Whether the property should be inherited down the DOM. */
  inherit?: boolean;
}

/** List of properties used to specify insets. */
export const INSET_PROPERTIES = [
  'left',
  'right',
  'top',
  'bottom',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end',
  'inset-block',
  'inset-inline',
  'inset',
] as const;

/** List of properties used to specify sizes. */
export const SIZING_PROPERTIES = [
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
] as const;

/** List of anchor position properties that inherit. */
const INHERITED_ANCHOR_PROPERTIES = ['position-anchor'] as const;

/** List of anchor position properties that do not inherit. */
const NON_INHERITED_ANCHOR_PROPERTIES = [
  'anchor-name',
  'anchor-scope',
] as const;

/**
 * Map of CSS properties that we polyfill, either to support unknown properties
 * or unknown property values.
 */
export const POLYFILLED_PROPERTIES = new Map([
  ...[INSET_PROPERTIES, SIZING_PROPERTIES, NON_INHERITED_ANCHOR_PROPERTIES]
    .flat()
    .map(
      (property) =>
        [
          property,
          {
            customProperty: makeCssProperty(property),
          } as PolyfilledPropertyConfig,
        ] as const,
    ),
  ...INHERITED_ANCHOR_PROPERTIES.map(
    (property) =>
      [
        property,
        {
          customProperty: makeCssProperty(property),
          inherit: true,
        } as PolyfilledPropertyConfig,
      ] as const,
  ),
]);
