import { DashedIdent } from './types.js';

let nextId = 0;

export const UUID_PREFIX = '⚓' as const;

/** A unique identifier. */
export type Uuid = `${typeof UUID_PREFIX}${number}`;

/** A unique html attribute. */
export type UuidAttribute = `data-${string}-${Uuid}`;

/** A unique CSS property. */
export type UuidCssProperty = `${DashedIdent}-${Uuid}`;

export type UuidCssId = `${string}-${Uuid}`;

/** Create a unique id. */
export function makeUuid(): Uuid {
  return `${UUID_PREFIX}${nextId++}`;
}

/** Create a unique attribute name. */
export function makeAttribute(name: string): UuidAttribute {
  return `data-${name}-${makeUuid()}`;
}

/** Create a unique CSS property name. */
export function makeCssProperty(name: string): UuidCssProperty {
  return `--${name}-${makeUuid()}`;
}

export function makeCssId(name: string): UuidCssId {
  return `${name}-${makeUuid()}`;
}
