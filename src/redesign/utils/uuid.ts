import { type DashedIdent } from './properties.js';

/** Global counter for making Uuids. */
let nextId = 0;

/** Prefix used for Uuids. */
export const UUID_PREFIX = '⚓' as const;

/** Prefix used for Uuids when `⚓` is not allowed. */
const UUID_PREFIX_ALT = 'ANCHORPOLY' as const;

/** A unique identifier. */
export type Uuid = `${typeof UUID_PREFIX}${number}`;

/** A unique html attribute. */
export type UuidAttribute = `data-${string}-${typeof UUID_PREFIX_ALT}${number}`;

/** A unique CSS property. */
export type UuidCssProperty = `${DashedIdent}-${Uuid}`;

export type UuidCssId = `${string}-${Uuid}`;

/** Create a unique id. */
export function makeUuid(): Uuid {
  return `${UUID_PREFIX}${nextId++}`;
}

/** Create a unique attribute name. */
export function makeAttribute(name: string): UuidAttribute {
  return `data-${name}-${UUID_PREFIX_ALT}${nextId++}`;
}

/** Create a unique CSS property name. */
export function makeCssProperty(name: string): UuidCssProperty {
  return `--${name}-${makeUuid()}`;
}

export function makeCssId(name: string): UuidCssId {
  return `${name}-${makeUuid()}`;
}
