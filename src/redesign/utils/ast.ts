import * as csstree from 'css-tree';
import { type Uuid } from './uuid.js';

/** Gets the AST for the given CSS. */
export function getAST(cssText: string) {
  return csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseCustomProperty: true,
  });
}

/** Generates CSS for the given AST. */
export function generateCss(ast: csstree.CssNode) {
  return csstree.generate(ast, {
    // Default `safe` adds extra (potentially breaking) spaces for compatibility
    // with old browsers.
    mode: 'spec',
  });
}

/** Clones an AST node, with optional overrides. */
export function clone<T extends csstree.CssNode>(
  node: T,
  override: Partial<T> = {},
) {
  const plain = csstree.toPlainObject(node);
  return csstree.fromPlainObject({ ...plain, ...override }) as T;
}

/** Adds a Uuid on to a CSS property value. */
export function addUuidToValue(value: csstree.Value | csstree.Raw, uuid: Uuid) {
  if (value.type === 'Raw') {
    value.value = `${value.value} ${uuid}`;
  } else {
    value.children.appendData({
      type: 'Identifier',
      name: `${uuid}`,
    });
  }
}

/** Checks if the given node is a declaration. */
export function isDeclaration(
  node: csstree.CssNode,
): node is csstree.Declaration {
  return node.type === 'Declaration';
}

/** Checks if the given node is a selector list. */
export function isSelectorList(
  node: csstree.CssNode,
): node is csstree.SelectorList {
  return node.type === 'SelectorList';
}

/** Checks if the given node is a selector. */
export function isSelector(node: csstree.CssNode): node is csstree.Selector {
  return node.type === 'Selector';
}

/** Checks if the given node is a pseudo-element selector. */
export function isPseudoElementSelector(
  node: csstree.CssNode,
): node is csstree.PseudoElementSelector {
  return node.type === 'PseudoElementSelector';
}
