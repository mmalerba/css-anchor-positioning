import { makeCssProperty } from './utils/uuid.js';

/** Extracts the key type from a map. */
type KeyType<T> =
  T extends Map<infer K, any> ? K : T extends Set<infer K> ? K : never;

/** A dashed CSS identifier. */
export type DashedIdent = `--${string}`;

/** A CSS percent value. */
export type Percent = `${number}%`;

/** A CSS `calc()` expression. */
export type CalcExpression = `calc(${string})`;

/** CSS properties that we polyfill. */
export type PolyfilledProperty = KeyType<typeof POLYFILLED_PROPERTIES>;

/** A property used to specify an inset. */
export type InsetProperty = KeyType<typeof INSET_PROPERTIES>;

/** A property used to specify a size. */
export type SizingProperty = KeyType<typeof SIZING_PROPERTIES>;

/** An `anchor-name` value. */
export type AnchorName = DashedIdent | 'none';

/** A `position-anchor` value. */
export type PositionAnchor = DashedIdent | 'auto';

/** An `anchor-scope` value. */
export type AnchorScope = DashedIdent | 'all' | 'none';

/** An anchor specifier value used in an anchor function. */
export type AnchorSpecifier = AnchorName | 'implicit';

/** A keyword value for the `anchor()` function side parameter */
export type AnchorSideKeyword = KeyType<typeof ANCHOR_SIDE_VALUES>;

/** A value for the `anchor()` function side parameter */
export type AnchorSide = AnchorSideKeyword | Percent | CalcExpression;

/** A value for the `anchor-size()` function size parameter */
export type AnchorSize = KeyType<typeof ANCHOR_SIZE_VALUES>;

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

/** List of anchor position properties. */
const ANCHOR_PROPERTIES = [
  'anchor-name',
  'anchor-scope',
  'position-anchor',
] as const;

/** Map of CSS properties that we polyfill to custom properties. */
export const POLYFILLED_PROPERTIES = new Map(
  [...INSET_PROPERTIES, ...SIZING_PROPERTIES, ...ANCHOR_PROPERTIES].map(
    (property) => [property, makeCssProperty(property)] as const,
  ),
);

/** Checks if the given string is a dashed identifier. */
function isDashedIdent(value: string): value is DashedIdent {
  return value.startsWith('--');
}

/** Checks if the given string is an anchor-name. */
export function isAnchorName(value: string): value is AnchorName {
  return isDashedIdent(value) || value === 'none';
}

/** Checks if the given string is an anchor specifier. */
export function isAnchorSpecifier(value: string): value is AnchorSpecifier {
  return isAnchorName(value) || value === 'implicit';
}

/** Checks if the given string is a position-anchor. */
export function isPositionAnchor(value: string): value is PositionAnchor {
  return isDashedIdent(value) || value === 'auto';
}

/** Checks if the given string is an anchor-scope. */
export function isAnchorScope(value: string): value is AnchorScope {
  return isDashedIdent(value) || value === 'all' || value === 'none';
}
