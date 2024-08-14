import { InsetProperty, SizingProperty } from '../parse.js';
import {
  ANCHOR_FUNCTION_NAME,
  ANCHOR_SIZE_FUNCTION_NAME,
  AnchorName,
  AnchorScope,
  INSET_PROPERTIES,
  isAnchorName,
  isAnchorScope,
  isPositionAnchor,
  PolyfilledProperty,
  PositionAnchor,
  SIZING_PROPERTIES,
} from './definitions.js';
import { Dom, PseudoElement, Selector } from './dom.js';
import { parseAnchorFunctions, ValueWithAnchorFunctions } from './parse.js';
import { Uuid } from './utils/uuid.js';

interface ResolvedAnchorsPropertyData {
  elementsByAnchorName: Map<AnchorName, (Element | PseudoElement)[]>;
  elementsByAnchorScope: Map<AnchorScope, (Element | PseudoElement)[]>;
  elementsByPositionAnchor: Map<PositionAnchor, (Element | PseudoElement)[]>;
  anchorsByElementAndProperty: Map<
    Element | PseudoElement,
    Map<InsetProperty | SizingProperty, ValueWithAnchorFunctions>
  >;
}

export function resolveAnchorProperties(
  dom: Dom,
  selectorsByProperty: Map<PolyfilledProperty, Selector[]>,
  anchorValuesByUuid: Map<Uuid, ValueWithAnchorFunctions>,
): ResolvedAnchorsPropertyData {
  const elementsByAnchorName = new Map<
    AnchorName,
    (Element | PseudoElement)[]
  >();
  const elementsByAnchorScope = new Map<
    AnchorScope,
    (Element | PseudoElement)[]
  >();
  const elementsByPositionAnchor = new Map<
    PositionAnchor,
    (Element | PseudoElement)[]
  >();
  const anchorsByElementAndProperty = new Map<
    Element | PseudoElement,
    Map<InsetProperty | SizingProperty, ValueWithAnchorFunctions>
  >();

  const elementsBySelector = dom.getAllPolyfilledElements();
  for (const [property, selectors] of selectorsByProperty) {
    for (const element of elementsBySelector.get(selectors[0]) ?? []) {
      let isInsetProperty: boolean;
      let { value, metadata } = dom.getCssPropertyValue(element, property);
      if (property === 'anchor-name') {
        value = !metadata?.dynamic || isAnchorName(value) ? value : '';
        if (value && value !== 'none') {
          addToMapList(elementsByAnchorName, value, element);
        }
      } else if (property === 'anchor-scope') {
        value = !metadata?.dynamic || isAnchorScope(value) ? value : '';
        if (value && value !== 'none') {
          addToMapList(elementsByAnchorScope, value, element);
        }
      } else if (property === 'position-anchor') {
        value = !metadata?.dynamic || isPositionAnchor(value) ? value : '';
        if (value && value !== 'auto') {
          addToMapList(elementsByPositionAnchor, value, element);
        }
      } else if (
        (isInsetProperty = INSET_PROPERTIES.has(property as InsetProperty)) ||
        SIZING_PROPERTIES.has(property as SizingProperty)
      ) {
        let valueWithAnchors: ValueWithAnchorFunctions | null | undefined;
        if (metadata?.dynamic) {
          valueWithAnchors = parseAnchorFunctions(
            value,
            isInsetProperty ? ANCHOR_FUNCTION_NAME : ANCHOR_SIZE_FUNCTION_NAME,
          );
        } else if (metadata?.parsed) {
          valueWithAnchors = anchorValuesByUuid.get(metadata.parsed);
        }
        if (valueWithAnchors) {
          const anchorsByProperty =
            anchorsByElementAndProperty.get(element) ?? new Map();
          anchorsByProperty.set(property, valueWithAnchors);
          anchorsByElementAndProperty.set(element, anchorsByProperty);
        }
      }
    }
  }

  return {
    elementsByAnchorName,
    elementsByAnchorScope,
    elementsByPositionAnchor,
    anchorsByElementAndProperty,
  };
}

/** Adds a value to a mapped list. */
function addToMapList<K, V>(map: Map<K, V[]>, key: K, value: V) {
  map.set(key, map.get(key) ?? []);
  map.get(key)!.push(value);
}
