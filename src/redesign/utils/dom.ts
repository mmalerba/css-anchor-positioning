import { type VirtualElement } from '@floating-ui/dom';
import { POLYFILLED_PROPERTIES } from './const.js';
import type { PolyfilledProperty, Selector } from './types.js';
import { makeCssId, Uuid, UUID_PREFIX } from './uuid.js';

const FAKE_PSEUDO_ELEMENT_STYLES_ID = makeCssId('fake-pseudo-element-styles');
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
    private selectors: Map<Uuid, Selector>,
  ) {}

  /** Map of selector uuid to elements selected by that selector. */
  private elements: Map<Uuid, (HTMLElement | PseudoElement)[]> | undefined;

  /** Gets the computed value of a CSS property. */
  getCssPopertyValue(element: HTMLElement | PseudoElement, property: string) {
    // Read the computed value from the polyfilled custom property.
    const { customProperty, inherit } = POLYFILLED_PROPERTIES.get(
      property as PolyfilledProperty,
    ) ?? { customProperty: property, inherit: true };
    const [computedValue, selectorId] = this.getComputedStyle(element)
      .getPropertyValue(customProperty)
      .trim()
      .split(` ${UUID_PREFIX}`);
    if (inherit) {
      return computedValue;
    }

    // If the property is not inherited, verify that the selector the value came
    // from actually selects this element.
    const uuid = `${UUID_PREFIX}${selectorId}` as Uuid;
    const selector = this.selectors.get(uuid);
    if (selector && this.matchesSelector(element, selector)) {
      return computedValue;
    }
    return null;
  }

  /** Checks whether the given element matches the given selector. */
  matchesSelector(element: HTMLElement | PseudoElement, selector: Selector) {
    if (element instanceof HTMLElement) {
      return element.matches(selector.full);
    }
    return (
      element.pseudoPart === selector.pseudoPart &&
      !!element.contextElement.matches(selector.elementPart)
    );
  }

  getAllPolyfilledElements(): Map<Uuid, (HTMLElement | PseudoElement)[]> {
    if (!this.elements) {
      throw Error('Must create fake pseudo-elements first.');
    }
    return this.elements;
  }

  /**
   * Gets a map of selector uuid to elements selected by that selector, for all
   * selectors with polyfilled properties.
   */
  createFakePseudoElements() {
    if (this.elements) {
      return;
    }

    // Get all the elements. For pseudo-elements, get their host real element
    // for now, we'll replace them once we create the fake pseudo-elements.
    this.elements = new Map();
    const pseudoSelectors: (Selector & { pseudoPart: string })[] = [];
    for (const [uuid, selector] of this.selectors) {
      this.elements.set(uuid, [
        ...document.querySelectorAll<HTMLElement>(selector.elementPart),
      ]);
      if (selector.pseudoPart) {
        pseudoSelectors.push(selector as Selector & { pseudoPart: string });
      }
    }

    // Create the fake pseudo-elements, tracking which psuedo-parts have been
    // created for each element, so we don't double create any.
    const fakePseudoElements = new Map<HTMLElement, PseudoElement[]>();
    for (const selector of pseudoSelectors) {
      const elements =
        (this.elements.get(selector.uuid) as HTMLElement[]) ?? [];
      for (const element of elements) {
        const pseudos = fakePseudoElements.get(element) ?? [];
        if (
          !pseudos.find(({ pseudoPart }) => pseudoPart === selector.pseudoPart)
        ) {
          pseudos.push(
            this.createFakePseudoElement(element, selector.pseudoPart),
          );
        }
        fakePseudoElements.set(element as HTMLElement, pseudos);
      }
    }

    // Create styles to mirror the pseudo-elements `content` property, and hide
    // the real pseudo-elements.
    const fakePseudoElementList = [...fakePseudoElements.values()].flat();
    const styles = fakePseudoElementList.map(
      ({ fakePseudoElement, pseudoPart, computedStyle }) =>
        `#${fakePseudoElement.id}${pseudoPart} { content: ${computedStyle.content}; }`,
    );
    const allRealPseudoElementsSelectors = pseudoSelectors
      .map(({ full }) => full)
      .join(',');
    styles.push(`${allRealPseudoElementsSelectors} { display: none; }`);
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
    for (const [uuid, { pseudoPart }] of this.selectors) {
      if (!pseudoPart) {
        continue;
      }
      const hostElements = this.elements.get(uuid) ?? [];
      const pseudoElements = hostElements
        .map((element) => {
          const fakePseudoElement =
            fakePseudoElements.get(element as HTMLElement) ?? [];
          return fakePseudoElement.find(
            (pseudo) => pseudo.pseudoPart === pseudoPart,
          );
        })
        .filter((element): element is PseudoElement => !!element);
      this.elements.set(uuid, pseudoElements);
    }
  }

  /** Removes all fake-pseudo elements. */
  removeFakePseudoElements() {
    if (!this.elements) {
      return;
    }
    document
      .querySelectorAll(
        `.${FAKE_PSEUDO_ELEMENT_CLASS},#${FAKE_PSEUDO_ELEMENT_STYLES_ID}`,
      )
      .forEach((element) => element.remove());
    this.elements = undefined;
  }

  /** Gets the computed styles for the given element. */
  private getComputedStyle(
    element: HTMLElement | PseudoElement,
  ): CSSStyleDeclaration {
    return element instanceof HTMLElement
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
      if (this.getCssPopertyValue(currentElement, 'overflow') === 'scroll') {
        return currentElement;
      }

      currentElement = currentElement.parentElement;
    }

    return currentElement;
  }
}
