import * as csstree from 'css-tree';

import { type Selector } from './dom.js';
import { parseAnchorFunctions, ValueWithAnchorFunctions } from './parse.js';
import { type CssSource } from './source.js';
import {
  clone,
  generateCss,
  isPseudoElementSelector,
  isSelector,
  isSelectorList,
  parseCss,
} from './utils/ast.js';
import {
  INSET_PROPERTIES,
  InsetProperty,
  isAnchorName,
  isAnchorScope,
  isPositionAnchor,
  POLYFILLED_PROPERTIES,
  SIZING_PROPERTIES,
  SizingProperty,
  type PolyfilledProperty,
} from './utils/properties.js';
import { makeUuid, type Uuid } from './utils/uuid.js';

/** Delimiter used to attach metadata to custom property values. */
export const METADATA_DELIMETER = '⚓';

const CONTAINS_ANCHORS_PATTERN = /(anchor|anchor-size)\(/;

/** Metadata attached to custom property values. */
export interface ValueMetadata {
  selector: Uuid;
  dynamic?: boolean;
  parsed?: Uuid;
}

/** Result data from preprocessing. */
export interface PreprocessingResult {
  /** Map of polyfilled properties to selectors that declare them. */
  selectorsByProperty: Map<PolyfilledProperty, Selector[]>;
  /** Map of uuid to selector for all parsed selectors. */
  selectorsByUuid: Map<Uuid, Selector>;
  /** Map of uuid to parsed values with anchor functions. */
  anchorValuesByUuid: Map<Uuid, ValueWithAnchorFunctions>;
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
  const selectorsByRule = new Map<csstree.Rule, Selector[]>();
  const selectorsByProperty = new Map<PolyfilledProperty, Selector[]>();
  const selectorsByUuid = new Map<Uuid, Selector>();
  const anchorValuesByUuid = new Map<Uuid, ValueWithAnchorFunctions>();
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
          // Parse and cache the selector for this rule.
          const parsedSelectors =
            selectorsByRule.get(this.rule) ?? parseSelectors(this.rule.prelude);
          selectorsByRule.set(this.rule, parsedSelectors);
          for (const selector of parsedSelectors) {
            // Polyfill the property.
            if (
              polyfillProperty(
                node,
                this.rule.block,
                selector.uuid,
                anchorValuesByUuid,
              )
            ) {
              dirty = true;
            }

            // Record that this selector contains the polyfilled property.
            selectorsByUuid.set(selector.uuid, selector);
            const propertySelectors = selectorsByProperty.get(property) ?? [];
            propertySelectors.push(selector);
            selectorsByProperty.set(property, propertySelectors);
          }
        }
      },
    });

    if (dirty) {
      source.css = generateCss(ast);
      source.dirty = true;
    }
  }
  return {
    selectorsByUuid,
    selectorsByProperty,
    anchorValuesByUuid,
  };
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

/**
 * Polyfills a given property by copying its value into a custom property.
 * Returns a boolean indicating if the CSS was changed.
 */
function polyfillProperty(
  node: csstree.Declaration,
  block: csstree.Block,
  selectorUuid: Uuid,
  anchorValuesByUuid: Map<Uuid, ValueWithAnchorFunctions>,
): boolean {
  // Add the polyfill custom property.
  const property = node.property as PolyfilledProperty;
  const value = generateCss(node.value);
  let polyfilledValue: string | null = value;
  const metadata: ValueMetadata = { selector: selectorUuid };

  // If the value is dynamic, we can't parse it during the preprocessing phase,
  // we'll just do it later on a per-element basis. Otherwise, validate & parse
  // the value up front now, so we don't have to do it later for every element
  // matching the selector.
  if (value.includes('var(')) {
    metadata.dynamic = true;
  } else {
    if (property === 'anchor-name') {
      polyfilledValue = isAnchorName(value) ? value : null;
    } else if (property === 'position-anchor') {
      polyfilledValue = isPositionAnchor(value) ? value : null;
    } else if (property === 'anchor-scope') {
      polyfilledValue = isAnchorScope(value) ? value : null;
    } else if (
      (INSET_PROPERTIES.has(property as InsetProperty) ||
        SIZING_PROPERTIES.has(property as SizingProperty)) &&
      CONTAINS_ANCHORS_PATTERN.test(value)
    ) {
      const valueWithAnchors = parseAnchorFunctions(node.value);
      if (valueWithAnchors) {
        metadata.parsed = valueWithAnchors.uuid;
        anchorValuesByUuid.set(valueWithAnchors.uuid, valueWithAnchors);
      }
      // Note: even if we didn't parse any anchors, the value could still be a
      // valid value for the inset or sizing property, which we want to
      // participate in the cascade for our custom property, so we don't null
      // out the value.
    }
  }

  // If the value didn't parse, just skip it and don't add the custom property.
  if (polyfilledValue === null) {
    return false;
  }

  // Add the metadata to the polyfilled value.
  const serializedMetadata = serializeMetadata(metadata);
  if (serializedMetadata) {
    polyfilledValue = `${polyfilledValue} ${METADATA_DELIMETER} ${serializedMetadata}`;
  }

  // Add a declaration for our custom property.
  const customProperty = POLYFILLED_PROPERTIES.get(property)!;
  block.children.appendData(
    clone(node, {
      property: customProperty,
      value: { type: 'Raw', value: polyfilledValue },
    }),
  );
  return true;
}

function serializeMetadata(metadata: ValueMetadata): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}${METADATA_DELIMETER}${value}`)
    .join(' ');
}

export function deserializeMetadata(
  serlializedMetadata: string,
): ValueMetadata {
  const metadata: { [key: string]: string | boolean } = {};
  for (const kv of serlializedMetadata.split(' ')) {
    const delimeterIndex = kv.indexOf(METADATA_DELIMETER);
    const key = kv.slice(0, delimeterIndex) as string;
    const value = kv.slice(delimeterIndex + 1) as string;
    if (key === 'dynamic') {
      metadata.dynamic = value === 'true';
    }
    metadata[key] = value;
  }
  return metadata as unknown as ValueMetadata;
}
