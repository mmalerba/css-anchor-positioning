import * as csstree from 'css-tree';

/** Gets the AST for the given CSS. */
export function parseCss(cssText: string) {
  return csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseCustomProperty: true,
  });
}

/** Gets the AST for the given CSS value. */
export function parseCssValue(valueText: string): csstree.Value | csstree.Raw {
  return (
    (csstree.parse(`s{v:${valueText}}`) as any)?.children?.head?.data?.block
      ?.children?.head?.data?.value ?? { type: 'Raw', value: '' }
  );
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

/** Replaces the given node with a different node. */
export function replace(node: csstree.CssNode, replacement: csstree.CssNode) {
  const keys = Reflect.ownKeys(node);
  keys.forEach((key) => Reflect.deleteProperty(node, key));
  Object.assign(node, replacement);
}

/** Checks if the given node is an operator. */
export function isOperator(
  node: csstree.CssNode,
  operator?: string,
): node is csstree.Operator {
  return node.type === 'Operator' && (!operator || node.value === operator);
}

/** Checks if the given node is a declaration. */
export function isDeclaration(
  node: csstree.CssNode,
): node is csstree.Declaration {
  return node.type === 'Declaration';
}

/** Checks if the given node is a function. */
export function isFunction(
  node: csstree.CssNode,
  name?: string,
): node is csstree.FunctionNode {
  return node.type === 'Function' && (!name || node.name === name);
}

/** Checks if the given node is an identifier. */
export function isIdentifier(
  node: csstree.CssNode,
): node is csstree.Identifier {
  return node.type === 'Identifier';
}

/** Checks if the given node is a number value. */
export function isNumber(node: csstree.CssNode): node is csstree.NumberNode {
  return node.type === 'Number';
}

/** Checks if the given node is a parenthesized expression. */
export function isParentheses(
  node: csstree.CssNode,
): node is csstree.Parentheses {
  return node.type === 'Parentheses';
}

/** Checks if the given node is a percentage value. */
export function isPercentage(
  node: csstree.CssNode,
): node is csstree.Percentage {
  return node.type === 'Percentage';
}

/** Checks if the given node is a pseudo-element selector. */
export function isPseudoElementSelector(
  node: csstree.CssNode,
): node is csstree.PseudoElementSelector {
  return node.type === 'PseudoElementSelector';
}

/** Checks if the given node is a selector. */
export function isSelector(node: csstree.CssNode): node is csstree.Selector {
  return node.type === 'Selector';
}

/** Checks if the given node is a selector list. */
export function isSelectorList(
  node: csstree.CssNode,
): node is csstree.SelectorList {
  return node.type === 'SelectorList';
}

/** Checks if the given node is a property value. */
export function isValue(node: csstree.CssNode): node is csstree.Value {
  return node.type === 'Value';
}
