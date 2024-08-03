import * as csstree from 'css-tree';

import {
  clone,
  generateCss,
  getAST,
  isPseudoElementSelector,
  isSelectorList,
} from '../utils/ast.js';
import { POLYFILLED_PROPERTIES } from '../utils/const.js';
import type {
  CssSource,
  PolyfilledProperty,
  Selector,
} from '../utils/types.js';
import { makeUuid } from '../utils/uuid.js';

/**
 * Parse the given CSS sources and collect all of the selectors that set
 * properties we want to polyfill.
 */
export function parseCss(
  sources: CssSource[],
): Map<PolyfilledProperty, Selector[]> {
  const ruleSelectors = new Map<csstree.Rule, Selector>();
  const polyfilledPropertySelectors = new Map<PolyfilledProperty, Selector[]>();
  for (const source of sources) {
    const ast = getAST(source.css);
    csstree.walk(ast, {
      visit: 'Declaration',
      enter: function (node) {
        const property = node.property as PolyfilledProperty;
        if (
          POLYFILLED_PROPERTIES.get(property) &&
          this.rule &&
          isSelectorList(this.rule.prelude)
        ) {
          const selector =
            ruleSelectors.get(this.rule) ?? parseSelector(this.rule.prelude);
          ruleSelectors.set(this.rule, selector);
          const propertySelectors =
            polyfilledPropertySelectors.get(property) ?? [];
          propertySelectors.push(selector);
          polyfilledPropertySelectors.set(property, propertySelectors);
        }
      },
    });
  }
  return polyfilledPropertySelectors;
}

/** Parses a CSS selector. */
function parseSelector(selectorList: csstree.SelectorList): Selector {
  let pseudoElement: csstree.CssNode | undefined;
  let element: csstree.CssNode | undefined;
  const last = selectorList.children.last;
  if (last && isPseudoElementSelector(last)) {
    pseudoElement = last;
    element = clone(selectorList);
    element.children.pop();
  }
  const full = generateCss(selectorList);
  const elementPart = element ? generateCss(element) : full;
  const pseudoPart = pseudoElement ? generateCss(pseudoElement) : undefined;
  return {
    uuid: makeUuid(),
    full,
    elementPart,
    ...(pseudoPart ? { pseudoPart } : {}),
  };
}
