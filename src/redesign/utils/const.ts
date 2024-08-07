import { PolyfilledPropertyData } from './types.js';
import { makeAttribute, makeCssProperty } from './uuid.js';

/** Attribute used to link an element to a uuid. */
export const UUID_ATTRIBUTE = makeAttribute('uuid');

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
          } as PolyfilledPropertyData,
        ] as const,
    ),
  ...INHERITED_ANCHOR_PROPERTIES.map(
    (property) =>
      [
        property,
        {
          customProperty: makeCssProperty(property),
          inherit: true,
        } as PolyfilledPropertyData,
      ] as const,
  ),
]);
