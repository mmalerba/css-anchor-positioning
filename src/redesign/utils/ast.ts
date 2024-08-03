import * as csstree from 'css-tree';

/** Gets the AST for the given CSS. */
export function getAST(cssText: string) {
  return csstree.parse(cssText, {
    parseAtrulePrelude: false,
    parseCustomProperty: true,
  });
}

/** Generates CSS for the given AST. */
export function generateCSS(ast: csstree.CssNode) {
  return csstree.generate(ast, {
    // Default `safe` adds extra (potentially breaking) spaces for compatibility
    // with old browsers.
    mode: 'spec',
  });
}

/** Checks if the givne node is a declaration. */
export function isDeclaration(
  node: csstree.CssNode,
): node is csstree.Declaration {
  return node.type === 'Declaration';
}
