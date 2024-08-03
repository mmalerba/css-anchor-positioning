import * as csstree from 'css-tree';

import { clone, generateCss, getAST } from '../utils/ast.js';
import { POLYFILLED_PROPERTIES } from '../utils/const.js';
import type { CssSource, PolyfilledProperty } from '../utils/types.js';

/**
 * Preprocess the CSS by polyfilling all properties that are not natively
 * supported with custom properties.
 */
export function preprocessCss(sources: CssSource[]): boolean {
  for (const source of sources) {
    let dirty = false;
    const ast = getAST(source.css);
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const block = this.rule?.block;
        if (block) {
          dirty = polyfillUnsupportedProperties(node, block) || dirty;
        }
      },
    });

    if (dirty) {
      source.css = generateCss(ast);
      source.dirty = true;
    }
  }
  return sources.some((source) => source.dirty);
}

/**
 * Shift property declarations for properties that are not yet natively
 * supported into custom properties.
 */
function polyfillUnsupportedProperties(
  node: csstree.Declaration,
  block: csstree.Block,
) {
  const { customProperty, inherit } =
    POLYFILLED_PROPERTIES.get(node.property as PolyfilledProperty) || {};
  if (!customProperty) {
    return false;
  }

  block.children.appendData(clone(node, { property: customProperty }));
  if (!inherit) {
    // TODO: add a property we can use to verify the value was not inherited.
    //  Probably need to run this after the parse phase where we've linked our
    //  selectors to uuids.
  }
  return true;
}
