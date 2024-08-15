import { platform, type VirtualElement } from '@floating-ui/dom';
import {
  POLYFILLED_PROPERTIES,
  type PolyfilledProperty,
} from './definitions.js';
import {
  deserializeMetadata,
  METADATA_DELIMETER,
  ValueMetadata,
} from './preprocess.js';
import { makeCssId, type Uuid } from './utils/uuid.js';

/** Represents a CSS selector with element and pseudo-element parts. */
export interface Selector {
  /** Unique identifier for this selector. */
  uuid: Uuid;
  /** The full selector text. */
  full: string;
  /** The selector text for the element part of the selector. */
  elementPart: string;
  /** The selector text for the pseudo-element part of the selector. */
  pseudoPart?: string;
}

/** The id for the fake-pseudo element styles tag. */
const FAKE_PSEUDO_ELEMENT_STYLES_ID = makeCssId('fake-pseudo-element-styles');

/** The CSS class applied to all fake pseudo-elements. */
const FAKE_PSEUDO_ELEMENT_CLASS = makeCssId('fake-pseudo-element');

/** Used instead of an HTMLElement as a handle for pseudo-elements. */
export interface PseudoElement extends VirtualElement {
  /** The pseudo-element part represented by this element. */
  pseudoPart: string;
  /** The real element used as a stand-in for the pseudo-element. */
  fakePseudoElement: HTMLElement;
  /** The computed styles for the pseudo-element. */
  computedStyle: CSSStyleDeclaration;
  /** The parent element for this pseudo-element. */
  contextElement: HTMLElement;
}

/** Class for working with the DOM in a polyfill-aware way. */
export class Dom {
  constructor(
    /** Map of uuid to selector for all known selectors. */
    private selectorsByUuid: Map<Uuid, Selector>,
  ) {}

  /** Map of selector uuid to elements selected by that selector. */
  private elementsBySelector:
    | Map<Selector, (HTMLElement | PseudoElement)[]>
    | undefined;

  /** Gets the computed value of a CSS property. */
  getCssPropertyValue(
    element: Element | PseudoElement,
    property: string,
  ): { value: string; metadata?: ValueMetadata } {
    // Read the computed value from the polyfilled custom property.
    const customProperty =
      POLYFILLED_PROPERTIES.get(property as PolyfilledProperty) ?? property;
    const [computedValue, serlializedMetadata] = this.getComputedStyle(element)
      .getPropertyValue(customProperty)
      .trim()
      .split(` ${METADATA_DELIMETER} `);
    if (!serlializedMetadata) {
      return { value: computedValue };
    }

    const metadata = deserializeMetadata(serlializedMetadata);
    const selector = this.selectorsByUuid.get(metadata.selector);
    if (selector && this.matchesSelector(element, selector)) {
      return { value: computedValue, metadata };
    }
    return { value: '' };
  }

  /** Checks whether the given element matches the given selector. */
  matchesSelector(element: Element | PseudoElement, selector: Selector) {
    if (element instanceof Element) {
      return element.matches(selector.full);
    }
    return (
      element.pseudoPart === selector.pseudoPart &&
      !!element.contextElement.matches(selector.elementPart)
    );
  }

  /**
   * Gets a mapping of all selector uuids to elements selected by that selector.
   */
  getAllPolyfilledElements(): Map<Selector, (HTMLElement | PseudoElement)[]> {
    if (!this.elementsBySelector) {
      throw Error('Must create fake pseudo-elements first.');
    }
    return this.elementsBySelector;
  }

  /**
   * Gets a map of selector uuid to elements selected by that selector, for all
   * selectors with polyfilled properties.
   */
  createFakePseudoElements() {
    if (this.elementsBySelector) {
      return;
    }

    // Get all the elements. For pseudo-elements, get their host real element
    // for now, we'll replace them once we create the fake pseudo-elements.
    this.elementsBySelector = new Map();
    const pseudoSelectors: (Selector & { pseudoPart: string })[] = [];
    for (const selector of this.selectorsByUuid.values()) {
      this.elementsBySelector.set(selector, [
        ...document.querySelectorAll<HTMLElement>(selector.elementPart),
      ]);
      if (selector.pseudoPart) {
        pseudoSelectors.push(selector as Selector & { pseudoPart: string });
      }
    }

    // Create the fake pseudo-elements, tracking which psuedo-parts have been
    // created for each element, so we don't double create any.
    const pseudoElementsByElement = new Map<HTMLElement, PseudoElement[]>();
    for (const selector of pseudoSelectors) {
      const elements =
        (this.elementsBySelector.get(selector) as HTMLElement[]) ?? [];
      for (const element of elements) {
        const pseudoElements = pseudoElementsByElement.get(element) ?? [];
        if (
          !pseudoElements.find(
            ({ pseudoPart }) => pseudoPart === selector.pseudoPart,
          )
        ) {
          pseudoElements.push(
            this.createFakePseudoElement(element, selector.pseudoPart),
          );
        }
        pseudoElementsByElement.set(element, pseudoElements);
      }
    }

    // Create styles to mirror the pseudo-elements `content` property, and hide
    // the real pseudo-elements.
    const fakePseudoElementList = [...pseudoElementsByElement.values()].flat();
    const styles = fakePseudoElementList.map(
      ({ fakePseudoElement, pseudoPart, computedStyle }) =>
        `#${fakePseudoElement.id}${pseudoPart} { content: ${computedStyle.content}; }`,
    );
    const allRealPseudoElementsSelectors = pseudoSelectors
      .map(({ full }) => full)
      .join(',');
    if (allRealPseudoElementsSelectors) {
      styles.push(`${allRealPseudoElementsSelectors} { display: none; }`);
    }
    const sheet = document.createElement('style');
    sheet.id = FAKE_PSEUDO_ELEMENT_STYLES_ID;
    sheet.innerHTML = styles.join('\n');

    // Attach the fake pseudo-elements and styles.
    for (const {
      pseudoPart,
      contextElement,
      fakePseudoElement,
    } of fakePseudoElementList) {
      const insertionPoint =
        pseudoPart === '::before' ? 'afterbegin' : 'beforeend';
      contextElement.insertAdjacentElement(insertionPoint, fakePseudoElement);
    }
    document.head.append(sheet);

    // Replace the host elements with the fake pseudo-elements in our internal
    // record.
    for (const [uuid, selector] of this.selectorsByUuid) {
      if (!selector.pseudoPart) {
        continue;
      }
      const hostElements = this.elementsBySelector.get(selector) ?? [];
      const pseudoElements = hostElements
        .map((element) => {
          const fakePseudoElement =
            pseudoElementsByElement.get(element as HTMLElement) ?? [];
          return fakePseudoElement.find(
            (pseudoEl) => pseudoEl.pseudoPart === selector.pseudoPart,
          );
        })
        .filter((element): element is PseudoElement => !!element);
      this.elementsBySelector.set(selector, pseudoElements);
    }
  }

  /** Removes all fake-pseudo elements. */
  removeFakePseudoElements() {
    if (!this.elementsBySelector) {
      return;
    }
    document
      .querySelectorAll(
        `.${FAKE_PSEUDO_ELEMENT_CLASS},#${FAKE_PSEUDO_ELEMENT_STYLES_ID}`,
      )
      .forEach((element) => element.remove());
    this.elementsBySelector = undefined;
  }

  isAbsolutelyPositioned(el: Element | PseudoElement) {
    return ['absolute', 'fixed'].includes(
      this.getCssPropertyValue(el, 'position').value,
    );
  }

  /**
   * A comparison function, usable with `.sort()`, that compares the tree order
   * of two elements.
   */
  compareTreeOrder(
    a: HTMLElement | PseudoElement,
    b: HTMLElement | PseudoElement,
  ): number {
    const aElement = a instanceof HTMLElement ? a : a.fakePseudoElement;
    const bElement = b instanceof HTMLElement ? b : b.fakePseudoElement;
    if (aElement === bElement) {
      return 0;
    }
    const position = aElement.compareDocumentPosition(bElement);
    return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
  }

  precedes(a: HTMLElement | PseudoElement, b: HTMLElement | PseudoElement) {
    return this.compareTreeOrder(a, b) < 0;
  }

  contains(parent: Element | PseudoElement, child: Element | PseudoElement) {
    const parentElement =
      parent instanceof Element ? parent : parent.fakePseudoElement;
    const childElement =
      child instanceof Element ? child : child.fakePseudoElement;
    return parentElement.contains(childElement);
  }

  /**
   * Given a container element and child element, determines if the child
   * element is a descendant of the container element.
   */
  isDescendant(
    child: HTMLElement | PseudoElement,
    container: Element | Document,
  ): boolean {
    const childElement =
      child instanceof HTMLElement ? child : child.fakePseudoElement;
    // Check is to see if child and parent are the same, in this case `contains`
    // would return `true`, because "a node is contained inside itself."
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Node/contains
    if (container === childElement) {
      return false;
    }
    return container.contains(childElement);
  }

  /**
   * Gets the containing block for the given element.
   * See: https://drafts.csswg.org/css-display-4/#containing-block
   */
  async getContainingBlock(element: Element | PseudoElement) {
    const el = element instanceof Element ? element : element.fakePseudoElement;
    if (!this.isAbsolutelyPositioned(el)) {
      return this.getFormattingContext(el);
    }

    let currentParent = el.parentElement;
    while (currentParent) {
      if (
        this.getCssPropertyValue(currentParent, 'position').value !==
          'static' &&
        this.getCssPropertyValue(currentParent, 'display').value === 'block'
      ) {
        return currentParent;
      }
      currentParent = currentParent.parentElement;
    }

    return el.ownerDocument;
  }

  getParentElement(element: Element | PseudoElement) {
    const el = element instanceof Element ? element : element.fakePseudoElement;
    return el.parentElement;
  }

  /**
   * Gets the formatting context for the given element.
   * See: https://drafts.csswg.org/css-display-4/#formatting-context
   */
  private async getFormattingContext(element: Element) {
    const parent = await platform.getOffsetParent(element);
    return parent instanceof Element ? parent : parent.document;
  }

  /** Gets the computed styles for the given element. */
  private getComputedStyle(
    element: Element | PseudoElement,
  ): CSSStyleDeclaration {
    return element instanceof Element
      ? getComputedStyle(element)
      : element.computedStyle;
  }

  /**
   * Create a fake pseudo-element as a stand-in for the given real pseudo
   * element.
   */
  private createFakePseudoElement(
    element: HTMLElement,
    pseudoPart: string,
  ): PseudoElement {
    // Read styles we need to create the fake pseudo-element.
    const computedStyle = getComputedStyle(element, pseudoPart);
    const { scrollY: startingScrollY, scrollX: startingScrollX } = globalThis;
    const containerScrollPosition = this.getContainerScrollPosition(element);

    // Floating UI needs `Element.getBoundingClientRect` to calculate the
    // position for the anchored element, since there isn't a way to get it for
    // pseudo-elements; we create a temporary "fake pseudo-element" that we use
    // as reference.
    const fakePseudoElement = document.createElement('div');
    fakePseudoElement.id = makeCssId('fake-pseudo-element');
    fakePseudoElement.classList.add(FAKE_PSEUDO_ELEMENT_CLASS);

    // Copy styles from pseudo-element to the fake pseudo-element, `.cssText`
    // does not work on Firefox.
    for (const property of computedStyle) {
      const value = computedStyle.getPropertyValue(property);
      fakePseudoElement.style.setProperty(property, value);
    }

    return {
      pseudoPart,
      fakePseudoElement,
      computedStyle,

      // For https://floating-ui.com/docs/autoupdate#ancestorscroll to work on
      // `VirtualElement`s.
      contextElement: element,

      // https://floating-ui.com/docs/virtual-elements
      getBoundingClientRect() {
        const { scrollY, scrollX } = globalThis;
        const { scrollTop, scrollLeft } = containerScrollPosition;
        const boundingClientRect = element.getBoundingClientRect();

        return DOMRect.fromRect({
          y:
            boundingClientRect.y +
            (startingScrollY - scrollY) +
            (containerScrollPosition.scrollTop - scrollTop),
          x:
            boundingClientRect.x +
            (startingScrollX - scrollX) +
            (containerScrollPosition.scrollLeft - scrollLeft),

          width: boundingClientRect.width,
          height: boundingClientRect.height,
        });
      },
    };
  }

  /**
   * Gets the scroll position of the first scrollable parent of the given
   * element (or the scroll position of the element itself, if it is
   * scrollable).
   */
  private getContainerScrollPosition(element: HTMLElement) {
    let containerScrollPosition: {
      scrollTop: number;
      scrollLeft: number;
    } | null = this.findFirstScrollingElement(element);

    // Avoid doubled scroll
    if (containerScrollPosition === document.documentElement) {
      containerScrollPosition = null;
    }

    return containerScrollPosition ?? { scrollTop: 0, scrollLeft: 0 };
  }

  /**
   * Finds the first scrollable parent of the given element (or the element
   * itself if the element is scrollable).
   */
  private findFirstScrollingElement(element: HTMLElement) {
    let currentElement: HTMLElement | null = element;
    while (currentElement) {
      if (
        this.getCssPropertyValue(currentElement, 'overflow').value === 'scroll'
      ) {
        return currentElement;
      }
      currentElement = currentElement.parentElement;
    }
    return null;
  }
}
