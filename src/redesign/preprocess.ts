import * as csstree from 'css-tree';

import { type Selector } from './dom.js';
import { type CssSource } from './source.js';
import {
  addToValue,
  clone,
  generateCss,
  isPseudoElementSelector,
  isSelector,
  isSelectorList,
  parseCss,
} from './utils/ast.js';
import {
  POLYFILLED_PROPERTIES,
  type PolyfilledProperty,
} from './utils/properties.js';
import { makeUuid, type Uuid } from './utils/uuid.js';

/** Result data from preprocessing. */
export interface PreprocessingResult {
  /** Map of polyfilled properties to selectors that declare them. */
  polyfilledPropertySelectors: Map<PolyfilledProperty, Selector[]>;
  /** Map of selector uuid to selector for all parsed selectors. */
  selectors: Map<Uuid, Selector>;
}

/**
 * Prerpocesses the given CSS sources by.
 *
 * Polyfills unsupported properties by transfering their values into custom
 * properties. This may leave the sources in a dirty state.
 *
 * Parses and collects selectors that declare polyfilled properties.
 */
export function preprocessSources(sources: CssSource[]): PreprocessingResult {
  const ruleSelectors = new Map<csstree.Rule, Selector[]>();
  const polyfilledPropertySelectors = new Map<PolyfilledProperty, Selector[]>();
  const selectors = new Map<Uuid, Selector>();
  for (const source of sources) {
    let dirty = false;
    const ast = parseCss(source.css);
    csstree.walk(ast, {
      visit: 'Declaration',
      enter: function (node) {
        const property = node.property as PolyfilledProperty;
        if (
          POLYFILLED_PROPERTIES.has(property) &&
          this.rule &&
          this.rule.block &&
          isSelectorList(this.rule.prelude)
        ) {
          dirty = true;

          // Parse and cache the selector for this rule.
          const parsedSelectors =
            ruleSelectors.get(this.rule) ?? parseSelectors(this.rule.prelude);
          ruleSelectors.set(this.rule, parsedSelectors);
          for (const selector of parsedSelectors) {
            // Polyfill the property.
            polyfillProperty(node, this.rule.block, selector.uuid);

            // Record that this selector contains the polyfilled property.
            selectors.set(selector.uuid, selector);
            const propertySelectors =
              polyfilledPropertySelectors.get(property) ?? [];
            propertySelectors.push(selector);
            polyfilledPropertySelectors.set(property, propertySelectors);
          }
        }
      },
    });

    if (dirty) {
      source.css = generateCss(ast);
      source.dirty = true;
    }
  }
  return { selectors, polyfilledPropertySelectors };
}

/** Parses a list of CSS selectors from the given AST. */
function parseSelectors(selectorList: csstree.SelectorList): Selector[] {
  const selectors: Selector[] = [];
  for (const selector of selectorList.children) {
    if (!isSelector(selector)) {
      continue;
    }
    let pseudoElement: csstree.CssNode | undefined;
    let element: csstree.CssNode | undefined;

    // Check if the last part of the selector is a pseudo-selector.
    const last = selector.children.last;
    if (last && isPseudoElementSelector(last)) {
      pseudoElement = last;
      element = clone(selector);
      element.children.pop();
    }

    const full = generateCss(selector);
    const elementPart = element ? generateCss(element) : full;
    const pseudoPart = pseudoElement ? generateCss(pseudoElement) : undefined;
    selectors.push({
      uuid: makeUuid(),
      full,
      elementPart,
      ...(pseudoPart ? { pseudoPart } : {}),
    });
  }
  return selectors;
}

/** Polyfills a given property by shifting its value into a custom property. */
function polyfillProperty(
  node: csstree.Declaration,
  block: csstree.Block,
  selectorUuid: Uuid,
) {
  // Add the polyfill custom property.
  const { customProperty, inherit } = POLYFILLED_PROPERTIES.get(
    node.property as PolyfilledProperty,
  )!;
  const value = clone(node.value);

  // If this property is not supposed to be inherited, record the selector that
  // declared the polyfill custom property as part of the value. This will allow
  // us to later verify that the computed value is not inherited.
  if (!inherit) {
    addToValue(value, selectorUuid);
  }

  block.children.appendData(clone(node, { property: customProperty, value }));
}
