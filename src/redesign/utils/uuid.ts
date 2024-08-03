let nextId = 0;

/** A unique identifier. */
export type Uuid = `odd-ap${string}`;

/** A unique html attribute. */
export type Attribute = `data-${string}-${Uuid}`;

/** Create a unique id. */
export function makeUuid(): Uuid {
  return `odd-ap${nextId++}`;
}

/** Create a unique attribute name. */
export function makeAttr(name: string): Attribute {
  return `data-${name}-${makeUuid()}`;
}
