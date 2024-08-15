import {
  ANCHOR_FUNCTION_NAME,
  ANCHOR_SIZE_FUNCTION_NAME,
  AnchorName,
  AnchorScope,
  INSET_PROPERTIES,
  InsetProperty,
  isAnchorName,
  isAnchorScope,
  isPositionAnchor,
  PolyfilledProperty,
  PositionAnchor,
  SIZING_PROPERTIES,
  SizingProperty,
} from './definitions.js';
import { Dom, PseudoElement, Selector } from './dom.js';
import { parseAnchorFunctions, ValueWithAnchorFunctions } from './parse.js';
import { Uuid } from './utils/uuid.js';

/**
 * Gets the full set of resolved anchor functions, linking query elements to
 * anchor elements.
 */
export async function resolveAnchors(
  dom: Dom,
  selectorsByProperty: Map<PolyfilledProperty, Selector[]>,
  anchorValuesByUuid: Map<Uuid, ValueWithAnchorFunctions>,
) {
  const elementsByAnchorName = new Map<
    Exclude<AnchorName, 'none'>,
    (HTMLElement | PseudoElement)[]
  >();
  const anchorScopeByElement = new Map<
    HTMLElement | PseudoElement,
    Exclude<AnchorScope, 'none'>
  >();
  const positionAnchorByElement = new Map<
    HTMLElement | PseudoElement,
    Exclude<PositionAnchor, 'auto'>
  >();
  const anchorsByElementAndProperty = new Map<
    HTMLElement | PseudoElement,
    Map<InsetProperty | SizingProperty, ValueWithAnchorFunctions>
  >();

  // Resolve the polyfilled property values for all elements, and collect them
  // into maps used to find the anchor element for each anchor function.
  // For each property, if the metadata indicates it is dynamic, we need to
  // re-parse / revalidate the value for this element, as it depends on `var()`
  // expressions.
  const elementsBySelector = dom.getAllPolyfilledElements();
  for (const [property, selectors] of selectorsByProperty) {
    for (const element of elementsBySelector.get(selectors[0]) ?? []) {
      let isInsetProperty: boolean;
      let { value, metadata } = dom.getCssPropertyValue(element, property);
      if (property === 'anchor-name') {
        value = !metadata?.dynamic || isAnchorName(value) ? value : '';
        if (value && value !== 'none') {
          const elements =
            elementsByAnchorName.get(value as Exclude<AnchorName, 'none'>) ??
            [];
          elements.push(element);
          elementsByAnchorName.set(
            value as Exclude<AnchorName, 'none'>,
            elements,
          );
        }
      } else if (property === 'anchor-scope') {
        value = !metadata?.dynamic || isAnchorScope(value) ? value : '';
        if (value && value !== 'none') {
          anchorScopeByElement.set(
            element,
            value as Exclude<AnchorScope, 'none'>,
          );
        }
      } else if (property === 'position-anchor') {
        value = !metadata?.dynamic || isPositionAnchor(value) ? value : '';
        if (value && value !== 'auto') {
          positionAnchorByElement.set(
            element,
            value as Exclude<PositionAnchor, 'auto'>,
          );
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

  await findAnchorElements(
    dom,
    anchorsByElementAndProperty,
    elementsByAnchorName,
    anchorScopeByElement,
    positionAnchorByElement,
  );

  return anchorsByElementAndProperty;
}

/**
 * Find the associated anchor element for each of the partially resolved anchor
 * functions.
 */
async function findAnchorElements(
  dom: Dom,
  anchorsByElementAndProperty: Map<
    HTMLElement | PseudoElement,
    Map<InsetProperty | SizingProperty, ValueWithAnchorFunctions>
  >,
  elementsByAnchorName: Map<AnchorName, (HTMLElement | PseudoElement)[]>,
  anchorScopeByElement: Map<HTMLElement | PseudoElement, AnchorScope>,
  positionAnchorByElement: Map<
    HTMLElement | PseudoElement,
    Exclude<PositionAnchor, 'auto'>
  >,
) {
  for (const [queryElement, valuesByProperty] of anchorsByElementAndProperty) {
    // Cache so we don't have to look up the same anchor name for the same query
    // element multiple times.
    const resovledAnchorElements = new Map<
      AnchorName,
      HTMLElement | PseudoElement | undefined
    >();
    for (const valueWithAnchors of valuesByProperty.values()) {
      for (const anchorFunction of valueWithAnchors.anchorFunctions) {
        const specifier = anchorFunction.anchorSpecifier
          ? anchorFunction.anchorSpecifier
          : positionAnchorByElement.get(queryElement) ?? 'implicit';

        // TODO: implement support for 'implicit' anchor specifier.
        if (specifier === 'implicit') {
          continue;
        }

        // Limit the potential anchor elements to only those that are in scope.
        let potentialAnchors = elementsByAnchorName.get(specifier) ?? [];
        let scope = getScope(
          dom,
          queryElement,
          specifier,
          anchorScopeByElement,
        );
        if (scope) {
          potentialAnchors = potentialAnchors.filter((anchor) =>
            dom.contains(scope, anchor),
          );
        }

        // Find the anchor element for the anchor function.
        const anchorElement = resovledAnchorElements.has(specifier)
          ? resovledAnchorElements.get(specifier)
          : await findAnchorElement(dom, queryElement, potentialAnchors);
        resovledAnchorElements.set(specifier, anchorElement);
        anchorFunction.anchor = anchorElement;
      }
    }
  }
}

/**
 * Find the anchor element for the given query element and specififer from among
 * the given potential anchor elements.
 */
async function findAnchorElement(
  dom: Dom,
  queryElement: HTMLElement | PseudoElement,
  potentialAnchorElements: (HTMLElement | PseudoElement)[],
): Promise<HTMLElement | PseudoElement | undefined> {
  // Only attempt to match query elements that are absolutely positioned.
  if (!dom.isAbsolutelyPositioned(queryElement)) {
    return undefined;
  }

  // Sort the potential anchor elements in reverse tree order, and return the
  // first one that is an acceptable anchor element.
  potentialAnchorElements.sort((a, b) => dom.compareTreeOrder(a, b) * -1);
  for (const anchorElement of potentialAnchorElements) {
    if (await isAcceptableAnchorElement(dom, anchorElement, queryElement)) {
      return anchorElement;
    }
  }

  return undefined;
}

/**
 * Checks if the given element is an acceptable anchor element for the given
 * query element.
 */
async function isAcceptableAnchorElement(
  dom: Dom,
  element: HTMLElement | PseudoElement,
  queryElement: HTMLElement | PseudoElement,
) {
  const anchorContainingBlock = await dom.getContainingBlock(element);
  const queryContainingBlock = await dom.getContainingBlock(queryElement);

  // Either el is a descendant of query el’s containing block, or query el’s
  // containing block is the initial containing block.
  if (
    !(
      dom.isDescendant(element, queryContainingBlock) ||
      isInitialContainingBlock(queryContainingBlock)
    )
  ) {
    return false;
  }

  // If el has the same containing block as query el, then either el is not
  // absolutely positioned, or el precedes query el in the tree order.
  if (
    anchorContainingBlock === queryContainingBlock &&
    !(
      !dom.isAbsolutelyPositioned(element) ||
      dom.precedes(element, queryElement)
    )
  ) {
    return false;
  }

  // If el has a different containing block from query el, then the last
  // containing block in el’s containing block chain before reaching query el’s
  // containing block is either not absolutely positioned or precedes query el
  // in the tree order.
  if (anchorContainingBlock !== queryContainingBlock) {
    let previousContainingBlock: Element | Document | undefined = undefined;
    let currentContainingBlock = anchorContainingBlock;

    while (
      currentContainingBlock !== queryContainingBlock &&
      !isInitialContainingBlock(currentContainingBlock)
    ) {
      previousContainingBlock = currentContainingBlock;
      currentContainingBlock = await dom.getContainingBlock(
        currentContainingBlock,
      );
    }

    if (
      previousContainingBlock instanceof HTMLElement &&
      !(
        !dom.isAbsolutelyPositioned(previousContainingBlock) ||
        dom.precedes(previousContainingBlock, queryElement)
      )
    ) {
      return false;
    }
  }

  // el is either an element, or a pseudo-element that acts like one.
  //
  // Note: There isnothing to check for this condition, because we currently
  // only consider elements and ::before/::after pseudo-elements as potential
  // anchors, and all of those meet this criteria.

  // el is not in the skipped contents of another element.
  let currentParent = dom.getParentElement(element);
  while (currentParent) {
    if (
      dom.getCssPropertyValue(currentParent, 'content-visibility').value ===
      'hidden'
    ) {
      return false;
    }

    currentParent = currentParent.parentElement;
  }

  return true;
}

/** Gets the anchor scope element for the given element and anchor name. */
function getScope(
  dom: Dom,
  element: HTMLElement | PseudoElement | null,
  anchorName: AnchorName,
  anchorScopeByElement: Map<HTMLElement | PseudoElement, AnchorScope>,
) {
  const matchingScopes = new Set(['all', anchorName]);
  while (element && !matchingScopes.has(anchorScopeByElement.get(element)!)) {
    element = dom.getParentElement(element);
  }
  return element;
}

/** Checks whether the given element is the initial containing block. */
function isInitialContainingBlock(block: Element | Document) {
  return block instanceof Document;
}
