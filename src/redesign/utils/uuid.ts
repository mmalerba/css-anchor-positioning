let nextId = 0;

/** Create a unique id. */
export function makeUuid() {
  return `odd-ap${nextId++}`;
}

/** Create a unique attribute name. */
export function makeAttr(name: string) {
  return `data-${name}-${makeUuid()}`;
}
