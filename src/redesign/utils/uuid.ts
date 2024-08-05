import { DashedIdent } from './types.js';

let nextId = 0;

/** A unique identifier. */
export type Uuid = `odd-ap${string}`;

/** A unique html attribute. */
export type UuidAttribute = `data-${string}-${Uuid}`;

/** A unique CSS property. */
export type UuidCssProperty = `${DashedIdent}${Uuid}`;

/** Create a unique id. */
export function makeUuid(): Uuid {
  return `odd-ap${nextId++}`;
}

/** Create a unique attribute name. */
export function makeAttribute(name: string): UuidAttribute {
  return `data-${name}-${makeUuid()}`;
}

/** Create a unique CSS property name. */
export function makeProperty(name: string): UuidCssProperty {
  return `--${name}-${makeUuid()}`;
}
