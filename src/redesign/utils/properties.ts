import { makeCssProperty } from './uuid.js';

type KeyType<T> =
  T extends Map<infer K, any> ? K : T extends Set<infer K> ? K : never;

/** A dashed CSS identifier. */
export type DashedIdent = `--${string}`;

/** A CSS percent value. */
export type Percent = `${number}%`;

/** A CSS `calc()` expression. */
export type CalcExpression = `calc(${string})`;

/** CSS properties that we polyfill. */
export type PolyfilledProperty = KeyType<typeof POLYFILL_CONFIG_BY_PROPERTY>;

/** A property used to specify an inset. */
export type InsetProperty = KeyType<typeof INSET_PROPERTIES>;

/** A property used to specify a size. */
export type SizingProperty = KeyType<typeof SIZING_PROPERTIES>;

/** An anchor name. */
export type AnchorName = DashedIdent | 'none';

/** An anchor name. */
export type AnchorScope = DashedIdent | 'all' | 'none';

/** A keyword value for the `anchor()` function side parameter */
export type AnchorSideKeyword = KeyType<typeof ANCHOR_SIDE_VALUES>;

/** A value for the `anchor()` function side parameter */
export type AnchorSide = AnchorSideKeyword | Percent | CalcExpression;

/** A value for the `anchor-size()` function size parameter */
export type AnchorSize = KeyType<typeof ANCHOR_SIZE_VALUES>;

/** Data needed to polyfill a property with a custom property. */
export interface PolyfilledPropertyConfig {
  /** Custom property that the property's value is shifted into. */
  customProperty: string;
  /** Whether the property should be inherited down the DOM. */
  inherit?: boolean;
}

/** List of properties used to specify insets. */
export const INSET_PROPERTIES = new Set([
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
] as const);

/** List of properties used to specify sizes. */
export const SIZING_PROPERTIES = new Set([
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
] as const);

/** Possible values for the anchor side. */
export const ANCHOR_SIDE_VALUES = new Set([
  'top',
  'left',
  'right',
  'bottom',
  'start',
  'end',
  'self-start',
  'self-end',
  'center',
] as const);

/** Possible values for the anchor size. */
export const ANCHOR_SIZE_VALUES = new Set([
  'width',
  'height',
  'block',
  'inline',
  'self-block',
  'self-inline',
] as const);

/** List of anchor position properties that inherit. */
const INHERITED_ANCHOR_PROPERTIES = new Set(['position-anchor'] as const);

/** List of anchor position properties that do not inherit. */
const NON_INHERITED_ANCHOR_PROPERTIES = [
  'anchor-name',
  'anchor-scope',
] as const;

/**
 * Map of CSS properties that we polyfill, either to support unknown properties
 * or unknown property values.
 */
export const POLYFILL_CONFIG_BY_PROPERTY = new Map(
  [
    [
      ...INSET_PROPERTIES,
      ...SIZING_PROPERTIES,
      ...NON_INHERITED_ANCHOR_PROPERTIES,
    ]
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
    [...INHERITED_ANCHOR_PROPERTIES].map(
      (property) =>
        [
          property,
          {
            customProperty: makeCssProperty(property),
            inherit: true,
          } as PolyfilledPropertyConfig,
        ] as const,
    ),
  ].flat(),
);
